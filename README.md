# ClientErrorCapture

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

ClientErrorCaptureは、Webフロントエンド専用のJavaScriptエラーキャプチャライブラリです。ブラウザでの未キャッチエラーやPromise拒否を捕捉し、サーバーへのログ送信、コンソール出力などを行います。

> **📖 詳細なドキュメント**: このREADMEでは基本的な使い方を説明しています。詳細な設定オプションや高度な使用例、トラブルシューティングについては、[USAGE.md](./USAGE.md)を参照してください。

## 概要

ClientErrorCaptureは、Webフロントエンドアプリケーションの未処理エラーを捕捉し、構造化されたフォーマットでログサーバーに送信するライブラリです。Next.js、React、VueなどのモダンフレームワークやプレーンなHTMLサイトでシームレスに利用できます。

## 特徴

- 🔄 既存のエラーハンドラと共存可能
- 📊 Vercel Log Drain形式準拠のJSONフォーマット
- 🔧 柔軟な設定オプション
- ⚙️ Promise拒否エラーのハンドリング
- 🔍 手動エラーキャプチャ機能
- ⏱️ スロットリングとリトライロジック
- 📦 UMD形式で様々な環境で利用可能

## インストール

### npmを使用する場合

```bash
npm install client-error-capture
```

### bunを使用する場合

```bash
bun add client-error-capture
```

### 直接スクリプトを読み込む場合

```html
<script src="https://cdn.example.com/client-error-capture.min.js"></script>
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
```

詳細な使用方法や高度な設定オプション、トラブルシューティングについては、[USAGE.md](./USAGE.md)を参照してください。

## サポート

問題や質問がある場合は、[GitHub Issues](https://github.com/your-org/client-error-capture/issues)にてご連絡ください。

## ライセンス

MIT License
