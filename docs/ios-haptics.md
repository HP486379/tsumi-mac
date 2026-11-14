# iOS（Expo WebView）振動連携

Webゲーム側は実装済みで、配置確定時に `{type:'tsumimac:haptic',kind:'place',strength:0..1}`、行消去時に `{type:'tsumimac:haptic',kind:'clear',strength:行数}` を `window.ReactNativeWebView.postMessage(JSON.stringify(payload))` で送ります。

**iOSのWKWebView/Safariは navigator.vibrate() に非対応です。** このため、EASでビルドするExpo iOSアプリのWebViewコンポーネントでメッセージを受け、`expo-haptics` を実行する必要があります。Web版だけの更新ではiOSの振動は有効になりません。

1. Expo側プロジェクトで `npx expo install expo-haptics` を実行。
2. 既存の `<WebView ... />` に `onMessage={handleTsumimacMessage}` を追加（すでにonMessageがある場合は、その中から下記を呼び出す）。
3. アプリのビルド番号を上げて `eas build -p ios` で再ビルド。

```tsx
import * as Haptics from 'expo-haptics';
import type { WebViewMessageEvent } from 'react-native-webview';

function handleTsumimacMessage(event: WebViewMessageEvent) {
  let message: {type?:string;kind?:string;strength?:number};
  try { message = JSON.parse(event.nativeEvent.data); } catch { return; }
  if (message.type !== 'tsumimac:haptic') return;
  if (message.kind === 'place') {
    const style = (message.strength ?? 0) >= 0.7
      ? Haptics.ImpactFeedbackStyle.Heavy
      : Haptics.ImpactFeedbackStyle.Light;
    void Haptics.impactAsync(style).catch(() => {});
  } else if (message.kind === 'clear') {
    // iOSのTaptic Engineは振動時間をミリ秒指定できないため、
    // 明確に長めに感じる2段のフィードバックにする。
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setTimeout(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, (message.strength ?? 1) >= 2 ? 180 : 130);
  }
}

// 既存WebViewのpropsに追加:
// onMessage={handleTsumimacMessage}
```

## 動作チェック
- iPhone実機でMacが配置確定すると短い振動（物理的な接触ごとには振動しない）
- 行消しは重めの振動＋成功パターン（複数行では間隔を長くする）
- ポーズ中・ゲームオーバー中は操作/振動なし
- Webブラウザは非対応環境で無音・無振動でもゲームは動作

※ iOSの「システムの触覚」設定・端末状態によって実際の体感は異なります。
