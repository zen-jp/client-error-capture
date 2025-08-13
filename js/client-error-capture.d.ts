/**
 * ClientErrorCaptureの設定オプション
 */
export interface ClientErrorCaptureConfig {
  /**
   * エラーキャプチャを有効にするかどうか
   * @default true
   */
  enabled?: boolean;

  /**
   * コンソールにエラーを出力するかどうか
   * @default true
   */
  logToConsole?: boolean;

  /**
   * サーバーにエラーを送信するかどうか
   * @default false
   */
  logToServer?: boolean;

  /**
   * ログサーバーのURL
   * @default ''
   */
  logServerUrl?: string;

  /**
   * アプリケーション名
   * @default 'application'
   */
  appName?: string;

  /**
   * 環境（production, development, staging, etc）
   * @default 'production'
   */
  environment?: 'production' | 'staging' | 'develop' | 'local' | 'preview' | string | unknown;

  /**
   * アプリケーションバージョン
   * @default '1.0.0'
   */
  version?: string;

  /**
   * スタックトレースの最大長
   * @default 50
   */
  maxStackLength?: number;

  /**
   * エラー送信の制限時間(ms)
   * @default 1000
   */
  throttleTime?: number;

  /**
   * ソースマップ警告を無効にするかどうか
   * @default false
   */
  disableSourceMapWarning?: boolean;

  /**
   * カスタムHTTPヘッダー
   * @default {}
   */
  customHeaders?: Record<string, string>;

  /**
   * Promise拒否エラーをハンドルするかどうか
   * @default true
   */
  handlePromiseRejections?: boolean;

  /**
   * エラー捕捉時に実行するコールバック
   * @default null
   */
  onErrorCallback?: (errorInfo: ErrorInfo) => void;

  /**
   * リクエスト変換関数
   * @default null
   */
  transformRequest?: (errorData: ErrorInfo) => ErrorInfo | null;

  /**
   * サンプリング率（0.0-1.0）
   * @default 1.0
   */
  samplingSetting?: number;

  /**
   * 再試行の最大回数
   * @default 3
   */
  maxAttempts?: number;

  /**
   * バックオフ係数
   * @default 1.5
   */
  backoffFactor?: number;

  /**
   * 送信ペイロードのキーをsnake_caseに変換するか
   * @default true
   */
  snakeCasePayload?: boolean;

  /**
   * 送信時に付与するスキーマ名（例: "default"）
   * ライブラリ内では任意で、送信時にのみpayloadへ反映されます
   */
  schemaName?: string;

  /**
   * 送信時に付与するスキーマバージョン（例: "0.1"）
   * ライブラリ内では任意で、送信時にのみpayloadへ反映されます
   */
  schemaVersion?: string;

  /**
   * 送信時に付与するauth_key（任意）
   * ライブラリ内では保持のみ、送信時にのみpayloadへ反映されます
   */
  authKey?: string;

  /**
   * 予約フィールド（tag, service）をトップレベルから除外するか
   * @default true
   */
  protectReservedFields?: boolean;
}

/**
 * エラー情報の形式
 */
export interface ErrorInfo {
  /**
   * エラーID（一意の識別子）
   */
  id: string;

  /**
   * エラーメッセージ
   */
  message: string;

  /**
   * エラーレベル
   */
  level: 'error' | 'warn' | 'info' | 'debug';

  /**
   * タイムスタンプ（ISO形式）
   */
  timestamp: string;

  /**
   * エラータイプ
   */
  type: 'uncaught' | 'unhandledrejection' | 'manual' | string;

  /**
   * アプリケーション名
   */
  appName: string;

  /**
   * アプリケーションバージョン
   */
  appVersion: string;

  /**
   * 環境（production, development, etc）
   */
  environment: 'production' | 'staging' | 'develop' | 'local' | 'preview' | string;

  /**
   * 追加のメタデータ
   */
  meta: {
    /**
     * エラー発生元URL
     */
    source?: string;

    /**
     * エラー行番号
     */
    lineno?: number;

    /**
     * エラー列番号
     */
    colno?: number;

    /**
     * スタックトレース
     */
    stack?: string;

    /**
     * ユーザーエージェント
     */
    userAgent?: string;

    /**
     * 現在のURL
     */
    url?: string;

    /**
     * リファラー
     */
    referrer?: string;

    /**
     * ブラウザ情報
     */
    browser?: {
      name?: string;
      version?: string;
      platform?: string;
      language?: string;
      cookiesEnabled?: boolean;
    };

    /**
     * その他の追加情報
     */
    [key: string]: unknown;
  };
}

/**
 * ClientErrorCaptureライブラリのインターフェース
 */
export interface ClientErrorCaptureInterface {
  /**
   * ライブラリを初期化する
   * @param userConfig ユーザー設定
   */
  init(userConfig?: ClientErrorCaptureConfig): ClientErrorCaptureInterface;

  /**
   * エラーを手動で記録
   * @param error エラーオブジェクトまたはメッセージ
   * @param additionalInfo 追加情報（オプション）
   */
  captureError(error: Error | string | unknown, additionalInfo?: Record<string, unknown>): ClientErrorCaptureInterface;

  /**
   * 設定を更新する
   * @param newConfig 新しい設定
   */
  updateConfig(newConfig: Partial<ClientErrorCaptureConfig>): ClientErrorCaptureInterface;

  /**
   * エラーキャプチャを無効にする
   */
  disable(): ClientErrorCaptureInterface;

  /**
   * エラーキャプチャを有効にする
   */
  enable(): ClientErrorCaptureInterface;
}

/**
 * グローバルClientErrorCaptureオブジェクト
 */
declare const ClientErrorCapture: ClientErrorCaptureInterface;

export default ClientErrorCapture;

/**
 * グローバル型宣言
 */
declare global {
  interface Window {
    ClientErrorCapture: ClientErrorCaptureInterface;
  }
}
