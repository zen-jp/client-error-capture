# ClientErrorCapture

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

ClientErrorCaptureは、Webフロントエンド専用のJavaScriptエラーキャプチャライブラリです。ブラウザでの未キャッチエラーやPromise拒否を捕捉し、サーバーへのログ送信、コンソール出力などを行います。

> このREADMEに、基本から詳細設定、サンプル、トラブルシューティングまでドキュメントを統合しました。

## 概要

ClientErrorCaptureは、Webフロントエンドアプリケーションの未処理エラーを捕捉し、構造化されたフォーマットでログサーバーに送信するライブラリです。Next.js、React、VueなどのモダンフレームワークやプレーンなHTMLサイトでシームレスに利用できます。

## 特徴

- 🔄 既存のエラーハンドラと共存可能
- 📊 Vercel Log Drain形式準拠のJSONフォーマット（一意のID付き）
- 🔧 柔軟な設定オプション
- ⚙️ Promise拒否エラーのハンドリング
- 🔍 手動エラーキャプチャ機能
- ⏱️ スロットリングとリトライロジック
- 📦 UMD形式で様々な環境で利用可能

## インストール

### npmを使用する場合

```bash
npm install github:zen-jp/client-error-capture
```

### bunを使用する場合

```bash
bun add github:zen-jp/client-error-capture
```

### 直接スクリプトを読み込む場合

```html
<script src="/js/client-error-capture.js"></script>
```

## 基本的な使用方法

```javascript
// ライブラリの初期化
ClientErrorCapture.init({
  logToConsole: true,             // コンソールにエラーを出力
  logToServer: true,              // サーバーにエラーログを送信
  logServerUrl: 'https://your-logging-server.com/api/logs', // ログサーバーのURL
  appName: 'YourAppName',         // アプリケーション名
  environment: 'production'       // 環境設定
});

// 手動でエラーをキャプチャする例
try {
  // リスキーな操作
  riskyOperation();
} catch (error) {
  ClientErrorCapture.captureError(error, {
    context: 'カスタムコンテキスト',
    component: 'ComponentName'
  });
}
```

## 高度な設定例

```javascript
ClientErrorCapture.init({
  logToConsole: true,
  logToServer: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging',
  logServerUrl: '{例：https://your-logging-server.com/api/error_logs}',
  appName: '{例：YourAppName}',
  environment: process.env.NODE_ENV || 'local',
  version: '1.2.3',
  maxStackLength: 1000,
  throttleTime: 2000,
  customHeaders: {
    'Authorization': 'Bearer your-auth-token',
    'X-Custom-Header': 'CustomValue'
  },
  handlePromiseRejections: true,
  onErrorCallback: function(errorInfo) {
    // エラー発生時のカスタム処理
    notifyUser(errorInfo.message);
  },
  transformRequest: function(errorData) {
    // リクエストデータの変換
    errorData.meta.customField = 'カスタム値';
    return errorData;
  },
  samplingSetting: 0.5, // エラーの50%のみを送信
  maxAttempts: 5,
  backoffFactor: 2.0
});
```

## Next.jsでの使用例

```jsx
// pages/_app.js または app/providers.js (App Router)
import { useEffect } from 'react';
import ClientErrorCapture from 'client-error-capture';

function initErrorCapture() {
  try {
    ClientErrorCapture.init({
      logToConsole: true,
      logToServer: true,
      logServerUrl: process.env.NEXT_PUBLIC_ERROR_LOG_SERVER_URL,
      appName: '{例：YourNextJSApp}',
      environment: process.env.NODE_ENV
    });
  } catch (e) {
    console.error('Failed to initialize ClientErrorCapture:', e);
  }
}

// Pages Router
function MyApp({ Component, pageProps }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initErrorCapture();
    }
  }, []);

  return <Component {...pageProps} />;
}

// App Router
export function ErrorCaptureProvider({ children }) {
  useEffect(() => {
    initErrorCapture();
  }, []);

  return children;
}

// layout.tsx で ErrorCaptureProvider を使用します。
<ErrorCaptureProvider>
  {children}
</ErrorCaptureProvider>
```

## プレーンなHTMLサイトへの導入

### インストール方法

GitHubリポジトリから直接インストールするには：
```bash
# npmの場合
npm install github:zen-jp/client-error-capture

# yarnの場合
yarn add github:zen-jp/client-error-capture

# bunの場合
bun add github:zen-jp/client-error-capture
```

### 自動コピースクリプトの設定

HTMLプロジェクトでは、ライブラリファイルを適切な場所に自動的にコピーするスクリプトを設定することをお勧めします。

`package.json`に以下のスクリプトを追加してください：

```json
{
  "scripts": {
    "prebuild": "npm run copy-libs",
    "predev": "npm run copy-libs", 
    "build": "あなたのビルドコマンド",
    "dev": "あなたの開発サーバー起動コマンド",
    "copy-libs": "mkdir -p public/js && cp node_modules/client-error-capture/js/client-error-capture.js public/js/"
  }
}
```

このようにすることで：

- 開発サーバーを起動する前（`bun run dev`）
- ビルドを実行する前（`bun run build`）

に自動的にライブラリファイルがコピーされるようになります。

### HTMLでの使用方法

1. HTMLファイルの`<head>`セクションにスクリプトを追加：

```html
<head>
  <!-- エラーキャプチャライブラリを読み込み -->
  <script src="./js/client-error-capture.js"></script>
  
  <script>
    // ライブラリの初期化
    document.addEventListener('DOMContentLoaded', function() {
      try {
        ClientErrorCapture.init({
          logToConsole: true,             // コンソールにエラーを出力
          logToServer: true,              // サーバーにエラーログを送信
          logServerUrl: 'あなたのログサーバーのURL', // ログ送信先URL
          appName: 'アプリケーション名',      // アプリケーション名
          environment: 'production',      // 環境設定（production/staging/development等）
          version: '1.0.0',               // アプリバージョン
          maxStackLength: 1000,           // スタックトレースの最大長
          
          // オプション: エラー捕捉時のカスタムコールバック
          onErrorCallback: function(errorInfo) {
            console.log('エラーが捕捉されました:', errorInfo);
          }
        });
        
        console.log('ClientErrorCaptureライブラリが初期化されました');
      } catch (e) {
        console.error('ClientErrorCaptureライブラリの初期化に失敗:', e);
      }
    });
  </script>
</head>
```

### 主な機能

#### 自動エラーキャプチャ

初期化すると、以下のエラーが自動的に捕捉されます：

- 未処理の例外（`window.onerror`）
- Promise拒否エラー（`unhandledrejection`）
- コンソールエラー（`console.error`のオーバーライド）

#### 手動エラーキャプチャ

try-catchブロック内でエラーを手動でキャプチャする場合：

```javascript
try {
  // エラーが発生する可能性のあるコード
  someRiskyOperation();
} catch (e) {
  // エラーを手動でキャプチャ
  ClientErrorCapture.captureError(e, {
    context: 'コンテキスト情報',
    component: 'コンポーネント名'
  });
}
```

#### 実装例

完全な実装例については、`node_modules/client-error-capture/example`ディレクトリ内のサンプルファイルを参照してください。または、公式GitHub リポジトリの[zen-jp/client-error-capture](https://github.com/zen-jp/client-error-capture)をご覧ください。

### トラブルシューティング

- ライブラリがロードされない場合は、パスが正しいことを確認してください
- サーバーにログが送信されない場合は、`logServerUrl`が正しく設定されていることを確認してください
- CORSエラーが発生する場合は、サーバー側でCORS設定を適切に構成してください



## サポート

問題や質問がある場合は、[GitHub Issues](https://github.com/zen-jp/client-error-capture/issues)にてご連絡ください。

## ライセンス

MIT License

## 詳細な設定オプション

ClientErrorCaptureは、以下の設定オプションをサポートしています：

| オプション | 型 | デフォルト | 説明 |
|------------|------|---------|-------------|
| enabled | boolean | true | エラーキャプチャを有効にするかどうか |
| logToConsole | boolean | true | コンソールにエラーを出力するかどうか |
| logToServer | boolean | false | サーバーにエラーを送信するかどうか |
| logServerUrl | string | '' | ログサーバーのURL |
| appName | string | 'application' | アプリケーション名 |
| environment | string/unknown | 'production' | 環境（production, staging, develop, local, previewなど） |
| version | string | '1.0.0' | アプリケーションバージョン |
| maxStackLength | number | 1000 | スタックトレースの最大長 |
| throttleTime | number | 1000 | エラー送信の制限時間(ms) |
| disableSourceMapWarning | boolean | false | ソースマップ警告を無効にするかどうか |
| customHeaders | object | {} | カスタムHTTPヘッダー |
| handlePromiseRejections | boolean | true | Promise拒否エラーをハンドルするかどうか |
| onErrorCallback | function | null | エラー捕捉時に実行するコールバック |
| transformRequest | function | null | リクエスト変換関数 |
| samplingSetting | number | 1.0 | サンプリング率（0.0-1.0） |
| maxAttempts | number | 3 | 再試行の最大回数 |
| backoffFactor | number | 1.5 | バックオフ係数 |
| snakeCasePayload | boolean | true | 送信ペイロードのキーをsnake_caseに変換 |
| schemaName | string | - | 送信時に付与するスキーマ名（例: default） |
| schemaVersion | string | - | 送信時に付与するスキーマバージョン（例: 0.1） |
| protectReservedFields | boolean | true | 予約フィールド（tag, service）をトップレベルから除外 |

### 設定オプションの詳細

#### transformRequest

エラーデータを送信前に変換するための関数を指定できます。

```javascript
ClientErrorCapture.init({
  // ...他の設定...
  transformRequest: function(errorData) {
    // センシティブ情報を削除
    if (errorData.meta && errorData.meta.stack) {
      errorData.meta.stack = errorData.meta.stack.replace(/password=\w+/g, 'password=REDACTED');
    }

    // 必要に応じてトップレベルフィールドも変換
    if (errorData.message) {
      errorData.message = errorData.message.replace(/password=\w+/g, 'password=REDACTED');
    }

    return errorData; // 変換後のデータを返す（nullを返すとログが送信されません）
  }
});
```

#### onErrorCallback

エラーが捕捉されたときに実行されるコールバック関数を設定できます。

```javascript
ClientErrorCapture.init({
  // ...他の設定...
  onErrorCallback: function(errorInfo) {
    // カスタムアクション（例：ユーザーへの通知表示）
    showErrorNotification('エラーが発生しました。サポートにお問い合わせください。');

    // 別のモニタリングサービスに送信
    otherMonitoringService.trackError(errorInfo);
  }
});
```

## メソッド

ClientErrorCaptureは以下のメソッドを提供します：

### init(config)

ライブラリを初期化します。設定オプションについては前述の表を参照してください。

```javascript
ClientErrorCapture.init({
  logToConsole: true,
  logToServer: true,
  logServerUrl: 'https://your-log-server.com/api/logs'
});
```

### captureError(error, additionalInfo)

エラーを手動でキャプチャします。

- error: エラーオブジェクト、文字列、または任意の値
- additionalInfo: 追加情報を含むオブジェクト（オプション）

```javascript
try {
  // エラーが発生する可能性のある処理
} catch (error) {
  ClientErrorCapture.captureError(error, {
    context: 'ファイルアップロード処理',
    userId: '12345',
    fileSize: '2.5MB'
  });
}
```

### updateConfig(newConfig)

実行時に設定を更新します。

```javascript
ClientErrorCapture.updateConfig({
  logToServer: false,  // サーバーへのログ送信を一時的に無効化
  throttleTime: 2000   // スロットリング時間を更新
});
```

### disable()

エラーキャプチャを無効にします。

```javascript
ClientErrorCapture.disable();
```

### enable()

エラーキャプチャを有効にします。

```javascript
ClientErrorCapture.enable();
```

## エラー情報のフォーマット

ClientErrorCaptureがサーバーに送信するエラー情報は以下の形式です：

```javascript
{
  id: "a7fb4d5e-...",                     // デバイス一意のID（永続保存）
  eventId: "550e8400-e29b-41d4-a716-446655440000", // イベント一意のID（毎イベント）
  message: "TypeError: Cannot read property 'foo' of null",
  level: "error",
  timestamp: "2023-03-15T12:34:56.789Z",
  type: "uncaught",                       // エラータイプ（uncaught, unhandledrejection, manual）
  appName: "YourAppName",                 // アプリケーション名
  appVersion: "1.0.0",                    // アプリケーションバージョン
  environment: "production",              // 環境
  meta: {
    source: "https://example.com/script.js",
    lineno: 42,
    colno: 13,
    stack: "TypeError: Cannot read...",
    userAgent: "Mozilla/5.0 (Windows...)",
    url: "https://example.com/page",
    browser: {
      name: "Chrome",
      version: "89.0.4389.82",
      platform: "Win32",
      language: "ja",
      cookiesEnabled: true
    },
    // 任意項目
    referrer: "https://example.com/",
    context: "user dashboard",
    userId: "user123"
  }
}
```

このフォーマットはVercel Log Drain形式に準拠しており、エラー情報の主要なフィールドがトップレベルに配置されています。

### 送信時のオプション変換（デフォルト: true）
- `snakeCasePayload: true`の場合、送信時にキーがすべてsnake_caseへ変換されます。
- `schemaName`/`schemaVersion`を設定した場合、送信時ペイロードに`schema_name`/`schema_version`が付与されます。
- 予約フィールド（`tag`, `service`）はトップレベルでは使用できないため、送信前に除外されます。

送信例：

```json
{
  "schema_name": "default",
  "schema_version": "0.1",
  "id": "1731465600...",
  "level": "error",
  "message": "TypeError: ...",
  "timestamp": "2025-08-13T12:34:56.789Z",
  "app_name": "YourAppName",
  "app_version": "1.0.0",
  "environment": "production",
  "meta": {
    "user_agent": "Mozilla/5.0 ...",
    "stack": "...",
    "additional_field": "value"
  }
}
```

## サーバー側の実装（例）

```javascript
const express = require('express');
const app = express();
const cors = require('cors');

app.use(express.json());
app.use(cors()); // CORSを有効化

app.post('/api/logs', async (req, res) => {
  try {
    const errorLog = req.body;

    // エラーログを検証
    if (!errorLog.message || !errorLog.timestamp) {
      return res.status(400).json({ error: 'Invalid error log format' });
    }

    // ログ保存処理など
    await saveErrorToDatabase(errorLog);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3000, () => {
  console.log('Error logging server running on port 3000');
});
```

## 高度な使用例

### React ErrorBoundaryとの統合

```javascript
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    ClientErrorCapture.captureError(error, {
      componentStack: errorInfo.componentStack,
      component: this.constructor.name
    });
  }

  render() {
    if (this.state.hasError) {
      return <h1>エラーが発生しました。</h1>;
    }
    return this.props.children;
  }
}
```

### サンプリングレートの設定

```javascript
// 本番環境では10%のエラーのみをログに記録
ClientErrorCapture.init({
  logToServer: true,
  logServerUrl: 'https://your-log-server.com/api/logs',
  environment: 'production',
  samplingSetting: 0.1 // 10%のエラーのみをログに記録
});

// 開発環境ではすべてのエラーをログに記録
if (process.env.NODE_ENV === 'development') {
  ClientErrorCapture.updateConfig({
    samplingSetting: 1.0 // すべてのエラーをログに記録
  });
}
```

## トラブルシューティング

### CORS関連の問題

ClientErrorCaptureがログサーバーにエラーを送信する際にCORSエラーが発生する場合：

```javascript
// サーバーサイド（Node.js/Express）
app.use(cors({
  origin: ['https://your-app.com', 'https://other-allowed-domain.com'],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 既存のエラーハンドラとの競合

ClientErrorCaptureと既存のグローバルエラーハンドラが競合する場合：

```javascript
window.onerror = function(message, source, lineno, colno, error) {
  customErrorHandler(message, source, lineno, colno, error);
  ClientErrorCapture.captureError(error || message, { source, lineno, colno });
  return true;
};
```

### ソースマップの警告

```text
ClientErrorCapture警告: ソースマップが検出されましたが、エラーレポートに含まれていません。
本番環境でのエラーデバッグを容易にするため、ソースマップへのアクセスまたは保存を検討してください。
```

無効にするには：

```javascript
ClientErrorCapture.init({
  disableSourceMapWarning: true,
});
```
