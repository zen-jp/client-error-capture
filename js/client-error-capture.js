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

      var meta = {
        type: errorType,
        source: errorData.source || window.location.href,
        lineno: lineNo,
        colno: colNo,
        stack: stack,
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer,
        appName: this.config.appName,
        appVersion: this.config.version,
        environment: this.config.environment,
        browser: browserInfo,
        timestamp: new Date().toISOString(),
        // オプションの追加情報
        ...(errorData.additionalInfo || {}),
      };

      return {
        message: errorMessage,
        level: "error",
        timestamp: new Date().toISOString(),
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

          xhr.send(JSON.stringify(errorInfo));
        }.bind(this)
      );
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
      var ua = navigator.userAgent;
      var browserName = "";
      var browserVersion = "";
      var platform = navigator.platform;

      // ブラウザ名とバージョンを特定
      if (ua.indexOf("Firefox") > -1) {
        browserName = "Firefox";
        browserVersion = ua.match(/Firefox\/([0-9.]+)/)[1];
      } else if (ua.indexOf("Chrome") > -1) {
        browserName = "Chrome";
        browserVersion = ua.match(/Chrome\/([0-9.]+)/)[1];
      } else if (ua.indexOf("Safari") > -1 && ua.indexOf("Chrome") === -1) {
        browserName = "Safari";
        browserVersion = ua.match(/Version\/([0-9.]+)/)[1];
      } else if (ua.indexOf("MSIE") > -1 || ua.indexOf("Trident/") > -1) {
        browserName = "Internet Explorer";
        browserVersion = ua.match(/(?:MSIE |rv:)([0-9.]+)/)[1];
      } else if (ua.indexOf("Edge") > -1) {
        browserName = "Edge";
        browserVersion = ua.match(/Edge\/([0-9.]+)/)[1];
      } else {
        browserName = "Unknown";
        browserVersion = "Unknown";
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
