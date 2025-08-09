# ClientErrorCapture ライブラリ

ClientErrorCaptureは、Webフロントエンド専用のエラーキャプチャライブラリです。このドキュメントでは、ClientErrorCaptureの詳細な使用方法と設定オプションについて説明します。

> **📌 基本情報**: ライブラリの基本情報、概要、特徴、インストール方法などの基本的な使い方については、[README.md](./README.md)を参照してください。

## 目次

1. [インストール](#インストール)
2. [基本的な使用方法](#基本的な使用方法)
3. [詳細な設定オプション](#詳細な設定オプション)
4. [メソッド](#メソッド)
5. [エラー情報のフォーマット](#エラー情報のフォーマット)
6. [サーバー側の実装](#サーバー側の実装)
7. [高度な使用例](#高度な使用例)
8. [トラブルシューティング](#トラブルシューティング)

## インストール

### npmを使用する場合

```bash
npm install github:zen-jp/zen-client-error-capture
```

### bunを使用する場合

```bash
bun add github:zen-jp/zen-client-error-capture
```

### 直接スクリプトを読み込む場合

```html
<script src="/js/client-error-capture.js"></script>
```

### 直接ダウンロード

[リリースページ](https://github.com/zen-jp/zen-client-error-capture/releases)からファイルをダウンロードして、プロジェクトに追加してください。

## 基本的な使用方法

### HTMLでの使用例

```html
<script src="path/to/client-error-capture.js"></script>
<script>
    // ライブラリの初期化
    ClientErrorCapture.init({
        logToConsole: true,             // コンソールにエラーを出力
        logToServer: true,              // サーバーにエラーログを送信
        logServerUrl: 'https://your-log-server.com/api/logs',  // ログサーバーのURL
        appName: 'YourAppName',         // アプリケーション名
        environment: 'production'       // 環境設定
    });
</script>
```

### モジュールとしての使用例

```javascript
import ClientErrorCapture from 'client-error-capture';

// ライブラリの初期化
ClientErrorCapture.init({
    logToConsole: true,
    logToServer: true,
    logServerUrl: 'https://your-log-server.com/api/logs',
    appName: 'YourAppName',
    environment: 'production'
});

// 手動でエラーをキャプチャ
try {
    // 何らかの処理
} catch (error) {
    ClientErrorCapture.captureError(error, {
        context: 'operation context',
        userId: 'user123'
    });
}
```

### Next.jsでの使用例

```javascript
// pages/_app.js
import { useEffect } from 'react';
import ClientErrorCapture from 'client-error-capture';

function MyApp({ Component, pageProps }) {
    useEffect(() => {
        // クライアントサイドでのみ初期化
        if (typeof window !== 'undefined') {
            ClientErrorCapture.init({
                logToConsole: true,
                logToServer: true,
                logServerUrl: process.env.NEXT_PUBLIC_ERROR_LOG_URL,
                appName: 'NextJsApp',
                environment: process.env.NODE_ENV
            });
        }
    }, []);

    return <Component {...pageProps} />;
}

export default MyApp;
```

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

- `error`: エラーオブジェクト、文字列、または任意の値
- `additionalInfo`: 追加情報を含むオブジェクト（オプション）

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
    
    id: "1723208045388320804538811400000",  // 一意のID
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

## サーバー側の実装

エラーログを受け取るサーバー側のAPIエンドポイントは、以下のようなコードで実装できます：

### Express.jsの例

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
        
        // ログをデータベースに保存したり、ログファイルに書き込んだりする処理
        await saveErrorToDatabase(errorLog);
        
        // 成功レスポンス
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

### フレームワーク固有のエラーハンドラと統合

```javascript
// Reactコンポーネント用のエラーバウンダリにClientErrorCaptureを統合
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // ClientErrorCaptureでエラーをキャプチャ
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

1. ログサーバーがCORSヘッダーを正しく設定していることを確認してください：

```javascript
// サーバーサイド（Node.js/Express）
app.use(cors({
    origin: ['https://your-app.com', 'https://other-allowed-domain.com'],
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
```

2. ログサーバーURLが`https://`で始まることを確認してください（セキュアな接続が推奨されます）。

### 既存のエラーハンドラとの競合

ClientErrorCaptureと既存のグローバルエラーハンドラが競合する場合：

1. ClientErrorCaptureを先に初期化し、既存のハンドラを後で追加してください。
2. または、既存のハンドラ内からClientErrorCaptureを手動で呼び出してください：

```javascript
window.onerror = function(message, source, lineno, colno, error) {
    // 既存のエラーハンドリングロジック
    customErrorHandler(message, source, lineno, colno, error);
    
    // ClientErrorCaptureでエラーを手動でキャプチャ
    ClientErrorCapture.captureError(error || message, {
        source: source,
        lineno: lineno,
        colno: colno
    });
    
    // falseを返すとブラウザのデフォルトエラーハンドリングも実行される
    return true;
};
```

### ソースマップの警告

ソースマップを使用していて、ClientErrorCaptureが以下の警告を出力する場合：

```
ClientErrorCapture警告: ソースマップが検出されましたが、エラーレポートに含まれていません。
本番環境でのエラーデバッグを容易にするため、ソースマップへのアクセスまたは保存を検討してください。
```

この警告を無効にするには：

```javascript
ClientErrorCapture.init({
    disableSourceMapWarning: true,
    // 他の設定...
});
```

### 注意事項とベストプラクティス

1. **センシティブデータ**: エラーメッセージやスタックトレースにパスワードやトークンなどのセンシティブ情報が含まれていないか確認し、必要に応じて`transformRequest`オプションを使用して削除してください。

2. **エラーボリューム**: 大量のエラーが発生する場合は、`throttleTime`や`samplingSetting`を調整して、サーバーへの負荷を軽減してください。

3. **ストレージ容量**: エラーログのサイズが大きくなる可能性があるため、サーバー側でのログローテーションや定期的なクリーンアップを検討してください。

4. **このライブラリはWebブラウザ環境専用**: Node.jsなどのサーバー環境では動作しません。サーバーサイドのエラー捕捉には別のライブラリを使用してください。
