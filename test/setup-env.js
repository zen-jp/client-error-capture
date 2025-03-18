/**
 * テスト環境のセットアップヘルパー
 * ブラウザ環境をモックするための共通関数を提供
 */

// ウィンドウオブジェクトのモック
function setupWindowMock() {
  // すでにwindowが定義されている場合は何もしない
  if (typeof window !== 'undefined') {
    return;
  }

  // グローバルwindowオブジェクトを作成
  global.window = {
    onerror: null,
    onunhandledrejection: null
  };

  // その他のブラウザグローバルオブジェクト
  global.navigator = {
    language: 'ja',
    cookieEnabled: true,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  };

  global.document = {
    createElement: function() { return { style: {} }; },
    getElementById: function() { return null; },
    addEventListener: function() {}
  };

  // Date.nowのモック（初期値）
  if (!global.Date.now.isMockFunction) {
    global.Date.now = function() { return 1000; };
  }
}

// fetchのモック
function setupFetchMock() {
  if (typeof global.fetch === 'undefined') {
    global.fetch = function() {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: function() { return Promise.resolve({ success: true }); }
      });
    };
  }
}

// ライブラリのデフォルト状態をリセット
function resetLibraryState(ClientErrorCapture) {
  if (!ClientErrorCapture) return;
  
  ClientErrorCapture.initialized = false;
  ClientErrorCapture.config = {};
  ClientErrorCapture.userConfig = {};
  ClientErrorCapture.lastErrorTime = 0;
  ClientErrorCapture.errorQueue = [];
  ClientErrorCapture.isProcessingQueue = false;
}

import fs from 'fs';
import path from 'path';

/**
 * ブラウザ環境をエミュレートする関数
 * テスト実行時にグローバルオブジェクトをブラウザ環境に近い状態にセットアップします
 */
export function setupBrowserEnvironment() {
  // windowオブジェクト
  global.window = {
    onerror: null,
    onunhandledrejection: null
  };

  // navigatorオブジェクト
  global.navigator = {
    language: 'ja',
    cookieEnabled: true,
    userAgent: 'Mozilla/5.0 (Test Browser) AppleWebKit/537.36 Chrome/91.0.4472.124'
  };

  // documentオブジェクト
  global.document = {
    createElement: () => ({ style: {} }),
    getElementById: () => null,
    addEventListener: () => {}
  };

  // locationオブジェクト
  global.location = {
    href: 'https://example.com/test',
    hostname: 'example.com',
    pathname: '/test',
    search: '',
    hash: ''
  };

  // fetchモック
  global.fetch = (url, options) => {
    return Promise.resolve({
      ok: true, 
      status: 200,
      json: () => Promise.resolve({ success: true })
    });
  };

  // DOMイベント関連
  global.Event = class Event {
    constructor(type, options) {
      this.type = type;
      this.bubbles = options?.bubbles || false;
      this.cancelable = options?.cancelable || false;
    }
  };

  global.self = global;
}

/**
 * client-error-capture.jsライブラリを読み込む関数
 * テスト環境でライブラリを正しく評価し、グローバルスコープに展開します
 * @returns {Object} ClientErrorCaptureオブジェクト
 */
export function loadClientErrorCapture() {
  // ライブラリパスを取得
  const libraryPath = path.resolve(import.meta.dir, '../js/client-error-capture.js');
  const libraryCode = fs.readFileSync(libraryPath, 'utf8');

  // グローバル変数をクリア
  global.ClientErrorCapture = null;

  // ライブラリコードを評価
  new Function('window', 'document', 'navigator', 'location', 'fetch', 'self', libraryCode)(
    global.window, global.document, global.navigator, global.location, global.fetch, global.self
  );

  // ClientErrorCaptureをグローバルから取得
  const ClientErrorCapture = global.ClientErrorCapture || window.ClientErrorCapture;

  if (!ClientErrorCapture) {
    console.error('ClientErrorCaptureライブラリを正常にロードできませんでした');
    throw new Error('ライブラリのロードに失敗しました');
  }

  return ClientErrorCapture;
}

/**
 * ライブラリの状態をリセットする関数
 * テスト間の干渉を防ぐために使用します
 * @param {Object} ClientErrorCapture - リセット対象のClientErrorCaptureオブジェクト
 */
export function resetLibraryState(ClientErrorCapture) {
  if (ClientErrorCapture) {
    ClientErrorCapture.initialized = false;
    ClientErrorCapture.config = {};
    ClientErrorCapture.userConfig = {};
    ClientErrorCapture.lastErrorTime = 0;
    ClientErrorCapture.errorQueue = [];
    ClientErrorCapture.isProcessingQueue = false;
  }
}

/**
 * コンソール出力をモックする関数
 * テスト中のコンソール出力をキャプチャするために使用します
 * @returns {Object} モック関数と元の関数を含むオブジェクト
 */
export function setupConsoleMock() {
  const consoleOutput = {
    log: [],
    error: [],
    warn: [],
    info: []
  };
  
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  };
  
  console.log = (...args) => {
    consoleOutput.log.push(args);
  };
  
  console.error = (...args) => {
    consoleOutput.error.push(args);
  };
  
  console.warn = (...args) => {
    consoleOutput.warn.push(args);
  };
  
  console.info = (...args) => {
    consoleOutput.info.push(args);
  };
  
  return {
    consoleOutput,
    resetConsole: () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
    }
  };
}

/**
 * fetchをモックする関数
 * @returns {Object} モック関数と取得した呼び出し履歴を含むオブジェクト
 */
export function setupFetchMock() {
  const fetchCalls = [];
  const originalFetch = global.fetch;
  
  global.fetch = (url, options) => {
    fetchCalls.push({ url, options });
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true })
    });
  };
  
  return {
    fetchCalls,
    resetFetch: () => {
      global.fetch = originalFetch;
    }
  };
}

/**
 * サンプルエラーを作成する関数
 * テスト用のエラーオブジェクトを生成します
 * @param {string} message - エラーメッセージ
 * @returns {Error} エラーオブジェクト
 */
export function createSampleError(message = 'テストエラー') {
  try {
    throw new Error(message);
  } catch (e) {
    return e;
  }
}

/**
 * カスタムスタックトレース付きのエラーを作成する関数
 * @param {string} message - エラーメッセージ
 * @param {string} stack - カスタムスタックトレース
 * @returns {Error} エラーオブジェクト
 */
export function createErrorWithStack(message, stack) {
  const error = new Error(message);
  error.stack = stack;
  return error;
}

// デフォルトエクスポート
export default {
  setupWindowMock,
  setupFetchMock,
  resetLibraryState,
  setupBrowserEnvironment,
  loadClientErrorCapture,
  setupConsoleMock,
  setupFetchMock,
  createSampleError,
  createErrorWithStack
};
