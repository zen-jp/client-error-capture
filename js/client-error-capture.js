/**
 * @file client-error-capture.js
 * @description Webフロントエンド専用の未キャッチエラーを捕捉し、ログサーバーに送信するためのライブラリ
 * @version 1.0.0
 * @license MIT
 */

(function (global, factory) {
  // UMD (Universal Module Definition)パターンでの実装
  // CommonJS, AMD, グローバル変数のいずれでも利用可能
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    global.ClientErrorCapture = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /**
   * ClientErrorCaptureライブラリのメインクラス
   */
  var ClientErrorCapture = {
    /**
     * デフォルト設定
     */
    defaultConfig: {
      enabled: true, // エラーキャプチャを有効にするかどうか
      logToConsole: true, // コンソールにエラーを出力するかどうか
      logToServer: false, // サーバーにエラーを送信するかどうか
      logServerUrl: "", // ログサーバーのURL
      appName: "application", // アプリケーション名
      environment: "production", // 環境（production, development, staging, etc）
      version: "1.0.0", // アプリケーションバージョン
      maxStackLength: 1000, // スタックトレースの最大長（増やすと省略を防げます）
      throttleTime: 1000, // エラー送信の制限時間(ms)
      disableSourceMapWarning: false, // ソースマップ警告を無効にするかどうか
      customHeaders: {}, // カスタムHTTPヘッダー
      handlePromiseRejections: true, // Promise拒否エラーをハンドルするかどうか
      onErrorCallback: null, // エラー捕捉時に実行するコールバック
      transformRequest: null, // リクエスト変換関数
      samplingSetting: 1.0, // サンプリング率（0.0-1.0）
      maxAttempts: 3, // 再試行の最大回数
      backoffFactor: 1.5, // バックオフ係数
      // 送信時の拡張設定（任意: ログサーバー仕様向け）
      snakeCasePayload: true, // 送信ペイロードのキーをsnake_caseに変換するか
      schemaName: undefined, // 送信時に付与するschema_name（任意）
      schemaVersion: undefined, // 送信時に付与するschema_version（任意）
      authKey: undefined, // 送信時に付与するauth_key（任意）
      protectReservedFields: true, // 予約フィールド(tag, service)をトップレベルから除外
      // デバイスID保存に関する設定
      deviceIdStorageKey: "cec_device_id",
      deviceIdCookieName: "cec_did",
      deviceIdCookieDomain: undefined,
      deviceIdExpiryDays: 3650,
      respectDoNotTrack: false,
    },

    /**
     * ユーザー設定
     */
    userConfig: {},

    /**
     * 有効な設定
     */
    config: {},

    /**
     * 元のウィンドウonerrorハンドラ
     */
    originalOnError: null,

    /**
     * 元のunhandledrejectionハンドラ
     */
    originalOnUnhandledRejection: null,

    /**
     * 最後のエラー時刻を記録（スロットリング用）
     */
    lastErrorTime: 0,

    /**
     * 初期化済みフラグ
     */
    initialized: false,

    /**
     * エラー送信キュー
     */
    errorQueue: [],

    /**
     * 処理中フラグ
     */
    isProcessingQueue: false,

    /**
     * ライブラリを初期化する
     * @param {Object} userConfig ユーザー設定
     * @return {Object} ClientErrorCaptureインスタンス
     */
    init: function (userConfig) {
      try {
        if (this.initialized) {
          this._log("ClientErrorCapture has already been initialized.");
          return this;
        }

        // 設定をマージ
        this.userConfig = userConfig || {};
        this.config = this._mergeConfig(this.defaultConfig, this.userConfig);

        // 元のエラーハンドラを保存
        this.originalOnError = window.onerror;
        this.originalOnUnhandledRejection = window.onunhandledrejection;

        // デバイスIDを初期化
        try {
          this.deviceId = this._getOrCreateDeviceId();
        } catch (_) {
          this.deviceId = this._generateEventId();
        }

        // エラーハンドラをインストール
        this._installHandler();

        this.initialized = true;
        if (this.config.logToConsole) {
          this._log("ClientErrorCapture initialized with config:", this.config);
        }

        return this;
      } catch (err) {
        console.error("Failed to initialize ClientErrorCapture:", err);
        return this;
      }
    },

    /**
     * グローバルエラーハンドラをインストールする
     * @private
     */
    _installHandler: function () {
      // thisを束縛したメソッドの参照を作成
      const handleError = this._handleError.bind(this);
      const originalOnError = this.originalOnError;
      const originalOnUnhandledRejection = this.originalOnUnhandledRejection;
      const config = this.config;

      // window.onerrorハンドラを設定
      window.onerror = function (message, source, lineno, colno, error) {
        const handled = handleError({
          type: "uncaught",
          message: message,
          source: source,
          lineno: lineno,
          colno: colno,
          error: error,
        });

        // 元のハンドラが存在する場合は呼び出す
        if (typeof originalOnError === "function") {
          return originalOnError.apply(this, arguments) || handled;
        }

        // trueを返すと、ブラウザのデフォルトエラー処理が抑制される
        return handled;
      };

      // Promise拒否エラーのハンドリングが有効な場合、そのハンドラも設定
      if (config.handlePromiseRejections) {
        window.onunhandledrejection = function (event) {
          const reason = event.reason || "Promise rejection reason unavailable";
          const message =
            reason instanceof Error ? reason.message : String(reason);

          const handled = handleError({
            type: "unhandledrejection",
            message: message,
            error: reason instanceof Error ? reason : new Error(message),
            event: event,
          });

          // 元のハンドラが存在する場合は呼び出す
          if (typeof originalOnUnhandledRejection === "function") {
            return (
              originalOnUnhandledRejection.apply(this, arguments) || handled
            );
          }

          // falseを返すとブラウザのデフォルト処理が続行される
          return handled;
        };
      }
    },

    /**
     * エラーを処理する
     * @param {Object} errorData エラーデータ
     * @private
     * @return {Boolean} エラーハンドル結果
     */
    _handleError: function (errorData) {
      try {
        // サンプリング率に基づいてエラーをフィルタリング
        if (Math.random() > this.config.samplingSetting) {
          return false;
        }

        // スロットリング処理
        var now = Date.now();
        if (now - this.lastErrorTime < this.config.throttleTime) {
          if (this.config.logToConsole) {
            this._log("Error throttled");
          }
          return false;
        }
        this.lastErrorTime = now;

        // エラー情報をフォーマット
        var errorInfo = this._formatErrorInfo(errorData);

        // ユーザーが指定したコールバックがある場合、実行
        if (typeof this.config.onErrorCallback === "function") {
          try {
            this.config.onErrorCallback(errorInfo);
          } catch (callbackError) {
            if (this.config.logToConsole) {
              console.error(
                "Error in ClientErrorCapture callback:",
                callbackError
              );
            }
          }
        }

        // コンソールにエラーを出力
        if (this.config.logToConsole) {
          console.error(
            "ClientErrorCapture caught error:",
            errorInfo.message,
            errorInfo
          );
        }

        // リクエスト変換関数がある場合、適用
        if (typeof this.config.transformRequest === "function") {
          try {
            const transformedErrorInfo =
              this.config.transformRequest(errorInfo);

            // transformRequestがnullを返した場合、エラーは送信されない
            if (transformedErrorInfo === null) {
              if (this.config.logToConsole) {
                this._log("Error log suppressed by transformRequest function");
              }
              return true;
            }

            // 変換されたエラー情報を使用
            errorInfo = transformedErrorInfo;
          } catch (transformError) {
            if (this.config.logToConsole) {
              console.error(
                "Error in transformRequest function:",
                transformError
              );
            }
          }
        }

        // サーバーへのログ送信が有効な場合、エラーをキューに追加
        if (this.config.logToServer && this.config.logServerUrl) {
          this._queueError(errorInfo);
        }

        return true;
      } catch (handlerError) {
        console.error("Error in ClientErrorCapture handler:", handlerError);
        return false;
      }
    },

    /**
     * エラー情報をフォーマットする
     * @param {Object} errorData エラーデータ
     * @private
     * @return {Object} フォーマットされたエラー情報
     */
    /**
     * 一意のIDを生成する
     * @private
     * @return {String} 生成されたID
     */
    // 互換維持: 旧API名は内部的にeventId生成へ委譲
    _generateUniqueId: function () {
      return this._generateEventId();
    },

    /**
     * イベントごと一意のIDを生成（UUID v4優先）
     * @private
     * @return {String} 生成されたeventId
     */
    _generateEventId: function () {
      try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return crypto.randomUUID();
        }
      } catch (_) {}
      try {
        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
          var buf = new Uint8Array(16);
          crypto.getRandomValues(buf);
          buf[6] = (buf[6] & 0x0f) | 0x40; // version 4
          buf[8] = (buf[8] & 0x3f) | 0x80; // variant 10
          var hex = Array.prototype.map.call(buf, function (b) {
            return (b + 0x100).toString(16).slice(1);
          });
          return (
            hex[0] + hex[1] + hex[2] + hex[3] + '-' +
            hex[4] + hex[5] + '-' +
            hex[6] + hex[7] + '-' +
            hex[8] + hex[9] + '-' +
            hex[10] + hex[11] + hex[12] + hex[13] + hex[14] + hex[15]
          );
        }
      } catch (_) {}
      // 最終フォールバック
      return (
        Date.now().toString(36) + Math.random().toString(36).slice(2, 12)
      ).toUpperCase();
    },

    /**
     * 端末ごと一意のIDを取得または生成して永続化
     * @private
     * @return {String} deviceId
     */
    _getOrCreateDeviceId: function () {
      try {
        var key = (this.config && this.config.deviceIdStorageKey) || 'cec_device_id';
        var cookieName = (this.config && this.config.deviceIdCookieName) || 'cec_did';
        var prefix = 'device-';

        // 1) localStorage
        try {
          var ls = window.localStorage;
          var existing = ls && ls.getItem(key);
          if (existing) return existing.indexOf(prefix) === 0 ? existing : (prefix + existing);
        } catch (_) {}

        // 2) cookie
        try {
          var m = document.cookie.match(new RegExp('(?:^|; )' + cookieName.replace(/([.$?*|{}()\[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
          if (m) {
            var cookieVal = decodeURIComponent(m[1]);
            return cookieVal.indexOf(prefix) === 0 ? cookieVal : (prefix + cookieVal);
          }
        } catch (_) {}

        // 3) 新規生成
        var newId = prefix + this._generateEventId();

        // DNT配慮: respectDoNotTrack=true かつ DNT=1 の場合は sessionStorage のみ
        var dnt = (navigator && (navigator.doNotTrack === '1')) || (window && (window.doNotTrack === '1'));
        if (this.config && this.config.respectDoNotTrack && dnt) {
          try { sessionStorage.setItem(key, newId); } catch (_) {}
          return newId;
        }

        // 4) localStorage 保存、不可なら Cookie 保存
        var saved = false;
        try {
          var ls2 = window.localStorage;
          if (ls2) { ls2.setItem(key, newId); saved = true; }
        } catch (_) {}
        if (!saved) {
          try {
            var days = (this.config && this.config.deviceIdExpiryDays) || 3650;
            var domain = this.config && this.config.deviceIdCookieDomain;
            var exp = new Date(Date.now() + days * 86400000).toUTCString();
            var cookie = cookieName + '=' + encodeURIComponent(newId) + '; Expires=' + exp + '; Path=/; SameSite=Lax';
            if (location && location.protocol === 'https:') cookie += '; Secure';
            if (domain) cookie += '; Domain=' + domain;
            document.cookie = cookie;
          } catch (_) {}
        }
        return newId;
      } catch (_) {
        return this._generateEventId();
      }
    },

    /**
     * エラー情報をフォーマットする
     * @param {Object} errorData エラーデータ
     * @private
     * @return {Object} フォーマットされたエラー情報
     */
    _formatErrorInfo: function (errorData) {
      var errorType = errorData.type || "unknown";
      var errorObj = errorData.error || {};
      var errorMessage = "";
      var stack = "";

      // エラーメッセージを取得
      if (typeof errorData.message === "string") {
        errorMessage = errorData.message;
      } else if (errorObj instanceof Error) {
        errorMessage = errorObj.message || "Unknown error";
      } else if (typeof errorObj === "string") {
        errorMessage = errorObj;
      } else {
        try {
          errorMessage = JSON.stringify(errorObj);
        } catch {
          errorMessage = "Unstringifiable error object";
        }
      }

      // スタックトレースを取得
      if (errorObj instanceof Error && errorObj.stack) {
        stack = errorObj.stack;

        // スタックトレースが長すぎる場合は切り詰める
        if (
          this.config.maxStackLength > 0 &&
          stack.length > this.config.maxStackLength
        ) {
          stack = stack.substring(0, this.config.maxStackLength) + "...";
        }
      }

      // ブラウザ情報を収集
      var browserInfo = this._getBrowserInfo();

      // エラー行番号と列番号を取得（手動キャプチャの場合は既定値を使用）
      var lineNo = typeof errorData.lineno === "number" ? errorData.lineno : 0;
      var colNo = typeof errorData.colno === "number" ? errorData.colno : 0;

      // 手動キャプチャ時のスタックトレースから行番号・列番号を抽出
      if (
        errorType === "manual" &&
        errorObj instanceof Error &&
        errorObj.stack
      ) {
        var stackLines = errorObj.stack.split("\n");
        var errorPosition = this._extractErrorPositionFromStack(stackLines);
        if (errorPosition) {
          if (errorPosition.lineNo && lineNo === 0) {
            lineNo = errorPosition.lineNo;
          }
          if (errorPosition.colNo && colNo === 0) {
            colNo = errorPosition.colNo;
          }
        }
      }

      // 現在のタイムスタンプ
      const currentTimestamp = new Date().toISOString();

      // metaオブジェクト（一部のフィールドはトップレベルに移動）
      var meta = {
        source: errorData.source || window.location.href,
        lineno: lineNo,
        colno: colNo,
        stack: stack,
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer,
        browser: browserInfo,
        timestamp: currentTimestamp,
        // オプションの追加情報
        ...(errorData.additionalInfo || {}),
      };

      return {
        id: this._getOrCreateDeviceId(),
        eventId: this._generateEventId(),
        message: errorMessage,
        level: "error",
        timestamp: currentTimestamp,
        type: errorType,
        appName: this.config.appName,
        appVersion: this.config.version,
        environment: this.config.environment,
        meta: meta,
      };
    },

    /**
     * スタックトレースから行番号と列番号を抽出する
     * @param {Array} stackLines スタックトレースの行配列
     * @private
     * @return {Object|null} 行番号と列番号を含むオブジェクトまたはnull
     */
    _extractErrorPositionFromStack: function (stackLines) {
      if (!stackLines || stackLines.length === 0) {
        return null;
      }

      // Chrome/Firefox/Safari形式のスタックトレースをパース
      // 例: "    at functionName (file.js:123:45)"
      // 例: "    at file.js:123:45"
      for (var i = 0; i < stackLines.length; i++) {
        var line = stackLines[i].trim();

        // "at "で始まる行を検索
        if (line.indexOf("at ") === 0) {
          // 括弧内のファイル情報を抽出
          var matches = line.match(/\((.+):(\d+):(\d+)\)$/);

          // 括弧がない場合（例：at file.js:123:45）
          if (!matches) {
            matches = line.match(/at\s+(.+):(\d+):(\d+)$/);
          }

          if (matches && matches.length >= 4) {
            return {
              file: matches[1],
              lineNo: parseInt(matches[2], 10),
              colNo: parseInt(matches[3], 10),
            };
          }
        }
      }

      return null;
    },

    /**
     * エラーをキューに追加
     * @param {Object} errorInfo エラー情報
     * @private
     */
    _queueError: function (errorInfo) {
      this.errorQueue.push(errorInfo);

      if (!this.isProcessingQueue) {
        this.isProcessingQueue = true;
        this._processQueue();
      }
    },

    /**
     * エラーキューを処理
     * @private
     */
    _processQueue: function () {
      if (this.errorQueue.length === 0) {
        this.isProcessingQueue = false;
        return;
      }

      this._processNextInQueue();
    },

    /**
     * 次のエラーキューアイテムを処理
     * @private
     */
    _processNextInQueue: function () {
      if (this.errorQueue.length === 0) {
        this.isProcessingQueue = false;
        return;
      }

      var errorInfo = this.errorQueue.shift();

      if (!errorInfo) {
        this.isProcessingQueue = false;
        return;
      }

      // エラーをサーバーに送信
      this._sendErrorToServer(errorInfo)
        .then(
          function () {
            if (this.config.logToConsole) {
              this._log("Error log sent successfully");
            }
          }.bind(this)
        )
        .catch(
          function (err) {
            if (this.config.logToConsole) {
              console.error("Failed to send error log to server:", err);
            }

            // 再試行ロジック
            if (errorInfo._attempts) {
              errorInfo._attempts += 1;
            } else {
              errorInfo._attempts = 1;
            }

            // 最大試行回数未満なら、再度キューに追加
            if (errorInfo._attempts < this.config.maxAttempts) {
              // 指数バックオフで再試行
              const backoffTime =
                this.config.throttleTime *
                Math.pow(this.config.backoffFactor, errorInfo._attempts - 1);

              setTimeout(
                function () {
                  this.errorQueue.push(errorInfo);
                }.bind(this),
                backoffTime
              );
            }
          }.bind(this)
        )
        .finally(
          function () {
            // キューの処理を続行
            setTimeout(
              function () {
                this._processQueue();
              }.bind(this),
              0
            );
          }.bind(this)
        );
    },

    /**
     * エラーをサーバーに送信
     * @param {Object} errorInfo エラー情報
     * @private
     * @return {Promise} 送信Promise
     */
    _sendErrorToServer: function (errorInfo) {
      return new Promise(
        function (resolve, reject) {
          var xhr = new XMLHttpRequest();
          xhr.open("POST", this.config.logServerUrl, true);
          xhr.setRequestHeader("Content-Type", "application/json");

          // カスタムヘッダーを設定
          for (var header in this.config.customHeaders) {
            if (this.config.customHeaders.hasOwnProperty(header)) {
              xhr.setRequestHeader(header, this.config.customHeaders[header]);
            }
          }

          xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(xhr.response);
            } else {
              reject(new Error("HTTP error: " + xhr.status));
            }
          }.bind(this);

          xhr.onerror = function () {
            reject(new Error("Network error occurred"));
          }.bind(this);

          // 送信前にペイロードを構築（snake_case変換やschema付与など）
          var payload = this._buildRequestPayload(errorInfo);
          xhr.send(JSON.stringify(payload));
        }.bind(this)
      );
    },

    /**
     * 送信ペイロードを構築（任意のschemaフィールド付与、snake_case変換、予約語保護）
     * @param {Object} errorInfo フォーマット済みのエラー情報（camelCase）
     * @private
     * @return {Object} 送信用エラーペイロード
     */
    _buildRequestPayload: function (errorInfo) {
      var payload = this._deepClone(errorInfo);

      // 任意のschemaフィールドを追加
      if (this.config && typeof this.config.schemaName === "string" && this.config.schemaName) {
        payload.schemaName = this.config.schemaName;
      }
      if (this.config && typeof this.config.schemaVersion === "string" && this.config.schemaVersion) {
        payload.schemaVersion = this.config.schemaVersion;
      }

      // 任意のauthKeyを追加（送信時のみ）
      if (this.config && typeof this.config.authKey === "string" && this.config.authKey) {
        payload.authKey = this.config.authKey;
      }

      // 予約フィールド(tag, service)のトップレベル保護
      if (this.config && this.config.protectReservedFields) {
        if (payload && Object.prototype.hasOwnProperty.call(payload, "tag")) {
          try { delete payload.tag; } catch (_) {}
        }
        if (payload && Object.prototype.hasOwnProperty.call(payload, "service")) {
          try { delete payload.service; } catch (_) {}
        }
      }

      // snake_case変換（必要な場合）
      if (this.config && this.config.snakeCasePayload) {
        payload = this._convertObjectKeysToSnakeCase(payload);
      }

      return payload;
    },

    /**
     * オブジェクトを深くクローン
     * @param {any} value クローン対象
     * @private
     * @return {any} クローン結果
     */
    _deepClone: function (value) {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (_) {
        return value;
      }
    },

    /**
     * 文字列をsnake_caseに変換
     * @param {String} str 入力文字列
     * @private
     * @return {String} snake_case文字列
     */
    _toSnakeCase: function (str) {
      return String(str)
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[-\s]+/g, "_")
        .toLowerCase();
    },

    /**
     * オブジェクトのキーを再帰的にsnake_caseへ変換
     * @param {any} input 入力データ
     * @private
     * @return {any} 変換後データ
     */
    _convertObjectKeysToSnakeCase: function (input) {
      if (input === null || input === undefined) return input;
      if (Array.isArray(input)) {
        var arr = new Array(input.length);
        for (var i = 0; i < input.length; i++) {
          arr[i] = this._convertObjectKeysToSnakeCase(input[i]);
        }
        return arr;
      }
      if (Object.prototype.toString.call(input) === "[object Object]") {
        var output = {};
        for (var key in input) {
          if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
          var newKey = this._toSnakeCase(key);
          // 予約フィールド保護はトップレベルで実施。ここでは純粋に変換のみ。
          output[newKey] = this._convertObjectKeysToSnakeCase(input[key]);
        }
        return output;
      }
      return input;
    },

    /**
     * 設定をマージする
     * @param {Object} defaultConfig デフォルト設定
     * @param {Object} userConfig ユーザー設定
     * @private
     * @return {Object} マージされた設定
     */
    _mergeConfig: function (defaultConfig, userConfig) {
      var merged = {};
      var key;

      // デフォルト設定をコピー
      for (key in defaultConfig) {
        if (defaultConfig.hasOwnProperty(key)) {
          merged[key] = defaultConfig[key];
        }
      }

      // ユーザー設定をマージ
      for (key in userConfig) {
        if (userConfig.hasOwnProperty(key) && userConfig[key] !== undefined) {
          merged[key] = userConfig[key];
        }
      }

      return merged;
    },

    /**
     * デバッグログを出力
     * @private
     */
    _log: function () {
      if (this.config && this.config.logToConsole) {
        var args = Array.prototype.slice.call(arguments);
        args.unshift("[ClientErrorCapture]");
        console.log.apply(console, args);
      }
    },

    /**
     * エラーを手動で記録
     * @param {Error|Object|String} error エラーオブジェクトまたはメッセージ
     * @param {Object} additionalInfo 追加情報（オプション）
     * @return {Object} ClientErrorCaptureインスタンス
     */
    captureError: function (error, additionalInfo) {
      if (!this.initialized) {
        console.error(
          "ClientErrorCapture must be initialized before capturing errors. Call ClientErrorCapture.init() first."
        );
        return this;
      }

      if (!this.config.enabled) {
        if (this.config.logToConsole) {
          this._log("Error not captured - ClientErrorCapture is disabled");
        }
        return this;
      }

      // Errorオブジェクトがない場合は作成
      var errorObj;
      if (error instanceof Error) {
        errorObj = error;
      } else if (typeof error === "string") {
        errorObj = new Error(error);
        // スタックトレースを整形（Errorを作成した場所を起点にする）
        if (Error.captureStackTrace) {
          Error.captureStackTrace(errorObj, this.captureError);
        }
      } else {
        var errorMessage;
        try {
          errorMessage = JSON.stringify(error);
        } catch {
          errorMessage = "Unstringifiable error object";
        }
        errorObj = new Error(errorMessage);
        // スタックトレースを整形
        if (Error.captureStackTrace) {
          Error.captureStackTrace(errorObj, this.captureError);
        }
      }

      // 現在のスクリプトの位置情報を取得するための試み
      var errorPosition = { lineno: 0, colno: 0 };
      if (errorObj.stack) {
        var stackInfo = this._extractErrorPositionFromStack(
          errorObj.stack.split("\n")
        );
        if (stackInfo) {
          errorPosition.lineno = stackInfo.lineNo;
          errorPosition.colno = stackInfo.colNo;
        }
      }

      var errorData = {
        type: "manual",
        error: errorObj,
        message: errorObj.message,
        lineno: errorPosition.lineno,
        colno: errorPosition.colno,
        additionalInfo: additionalInfo || {},
      };

      this._handleError(errorData);
      return this;
    },

    /**
     * 設定を更新する
     * @param {Object} newConfig 新しい設定
     * @return {Object} ClientErrorCaptureインスタンス
     */
    updateConfig: function (newConfig) {
      if (!this.initialized) {
        console.error(
          "ClientErrorCapture must be initialized before updating config. Call ClientErrorCapture.init() first."
        );
        return this;
      }

      this.userConfig = this._mergeConfig(this.userConfig, newConfig);
      this.config = this._mergeConfig(this.defaultConfig, this.userConfig);

      if (this.config.logToConsole) {
        this._log("Config updated:", this.config);
      }

      return this;
    },

    /**
     * エラーキャプチャを無効にする
     * @return {Object} ClientErrorCaptureインスタンス
     */
    disable: function () {
      if (!this.initialized) {
        console.error(
          "ClientErrorCapture must be initialized before disabling. Call ClientErrorCapture.init() first."
        );
        return this;
      }

      this.config.enabled = false;

      // 元のエラーハンドラを復元
      if (this.originalOnError !== null) {
        window.onerror = this.originalOnError;
      }

      if (this.originalOnUnhandledRejection !== null) {
        window.onunhandledrejection = this.originalOnUnhandledRejection;
      }

      if (this.config.logToConsole) {
        this._log("ClientErrorCapture disabled");
      }

      return this;
    },

    /**
     * エラーキャプチャを有効にする
     * @return {Object} ClientErrorCaptureインスタンス
     */
    enable: function () {
      if (!this.initialized) {
        console.error(
          "ClientErrorCapture must be initialized before enabling. Call ClientErrorCapture.init() first."
        );
        return this;
      }

      this.config.enabled = true;

      // エラーハンドラを再インストール
      this._installHandler();

      if (this.config.logToConsole) {
        this._log("ClientErrorCapture enabled");
      }

      return this;
    },

    /**
     * ブラウザ情報を取得する
     * @private
     * @return {Object} ブラウザ情報
     */
    _getBrowserInfo: function () {
      var ua = navigator.userAgent || "";
      var platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform;

      var browserName = "Unknown";
      var browserVersion = "Unknown";

      var isAndroid = /Android/i.test(ua);
      var isIOS = /iPhone|iPad|iPod/i.test(ua);

      var extract = function (regex) {
        try {
          var m = ua.match(regex);
          return m && m[1] ? m[1] : "Unknown";
        } catch (e) {
          return "Unknown";
        }
      };

      // UA-CH (Chromium) が使える場合のヒント
      var uaDataBrand = null;
      var uaDataVersion = null;
      try {
        if (navigator.userAgentData && navigator.userAgentData.brands && navigator.userAgentData.brands.length) {
          for (var i = 0; i < navigator.userAgentData.brands.length; i++) {
            var b = navigator.userAgentData.brands[i];
            if (b && b.brand && b.brand !== "Not:A-Brand" && b.brand !== "Not)A;Brand") {
              uaDataBrand = b.brand;
              uaDataVersion = b.version;
              break;
            }
          }
        }
      } catch (e) {}

      // 1) 新Edge系 (優先)
      if (/EdgiOS\//.test(ua)) {
        browserName = "Edge (iOS)";
        browserVersion = extract(/EdgiOS\/([0-9.]+)/);
      } else if (/EdgA\//.test(ua)) {
        browserName = "Edge (Android)";
        browserVersion = extract(/EdgA\/([0-9.]+)/);
      } else if (/Edg\//.test(ua)) {
        browserName = "Edge";
        browserVersion = extract(/Edg\/([0-9.]+)/);
      } else if (/\bEdge\//.test(ua)) {
        browserName = "Edge (Legacy)";
        browserVersion = extract(/Edge\/([0-9.]+)/);
      // 2) Opera/Vivaldi/Whale/Yandex/Samsung/UC
      } else if (/OPR\//.test(ua) || /Opera\//.test(ua)) {
        browserName = "Opera";
        browserVersion = /OPR\//.test(ua) ? extract(/OPR\/([0-9.]+)/) : extract(/Opera\/([0-9.]+)/);
      } else if (/Vivaldi\//.test(ua)) {
        browserName = "Vivaldi";
        browserVersion = extract(/Vivaldi\/([0-9.]+)/);
      } else if (/Whale\//.test(ua)) {
        browserName = "Whale";
        browserVersion = extract(/Whale\/([0-9.]+)/);
      } else if (/YaBrowser\//.test(ua)) {
        browserName = "Yandex";
        browserVersion = extract(/YaBrowser\/([0-9.]+)/);
      } else if (/SamsungBrowser\//.test(ua)) {
        browserName = "Samsung Internet";
        browserVersion = extract(/SamsungBrowser\/([0-9.]+)/);
      } else if (/UCBrowser\//.test(ua)) {
        browserName = "UC Browser";
        browserVersion = extract(/UCBrowser\/([0-9.]+)/);
      // 3) iOS専用ブラウザの識別
      } else if (isIOS && /CriOS\//.test(ua)) {
        browserName = "Chrome (iOS)";
        browserVersion = extract(/CriOS\/([0-9.]+)/);
      } else if (isIOS && /FxiOS\//.test(ua)) {
        browserName = "Firefox (iOS)";
        browserVersion = extract(/FxiOS\/([0-9.]+)/);
      // 4) WebView の検出
      } else if (isAndroid && (/\bwv\b/.test(ua) || /Version\/\d+/.test(ua))) {
        browserName = "Android WebView";
        browserVersion = extract(/Chrome\/([0-9.]+)/);
      } else if (isIOS && /AppleWebKit/.test(ua) && !/Safari/.test(ua)) {
        browserName = "iOS WebView";
        browserVersion = "Unknown";
      // 5) 主要ブラウザ
      } else if (/Chrome\//.test(ua) && !/(OPR|Edg|EdgiOS|EdgA|SamsungBrowser|UCBrowser|YaBrowser|Vivaldi|Whale)\//.test(ua)) {
        // Brave はUAではChrome互換。navigator.brave があれば Brave として扱う
        if (typeof navigator.brave === "object") {
          browserName = "Brave";
          browserVersion = extract(/Chrome\/([0-9.]+)/);
        } else {
          browserName = "Chrome";
          browserVersion = extract(/Chrome\/([0-9.]+)/);
        }
      } else if (/Firefox\//.test(ua)) {
        browserName = "Firefox";
        browserVersion = extract(/Firefox\/([0-9.]+)/);
      } else if (/Safari\//.test(ua) && /Version\//.test(ua)) {
        browserName = "Safari";
        browserVersion = extract(/Version\/([0-9.]+)/);
      } else if (/MSIE/.test(ua) || /Trident\//.test(ua)) {
        browserName = "Internet Explorer";
        browserVersion = /MSIE\s([0-9.]+)/.test(ua) ? extract(/MSIE\s([0-9.]+)/) : extract(/rv:([0-9.]+)/);
      }

      // UA-CHの補助情報で補完（未確定時のみ、またはバージョンが不明な場合）
      if (uaDataBrand) {
        var mappedName = null;
        if (/Edge/i.test(uaDataBrand)) mappedName = "Edge";
        else if (/Chrome/i.test(uaDataBrand)) mappedName = browserName === "Unknown" ? "Chrome" : browserName;
        else if (/Opera/i.test(uaDataBrand)) mappedName = "Opera";
        else if (/Chromium/i.test(uaDataBrand)) mappedName = browserName === "Unknown" ? "Chromium" : browserName;
        else if (/Samsung/i.test(uaDataBrand)) mappedName = "Samsung Internet";

        if (browserName === "Unknown" && mappedName) {
          browserName = mappedName;
        }
        if ((browserVersion === "Unknown" || browserVersion === "0") && uaDataVersion) {
          browserVersion = String(uaDataVersion);
        }
      }

      return {
        name: browserName,
        version: browserVersion,
        platform: platform,
        language: navigator.language,
        cookiesEnabled: navigator.cookieEnabled,
      };
    },
  };

  return ClientErrorCapture;
});
