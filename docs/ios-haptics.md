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

## 追加: 直接ドラッグのグリッド境界フィードバック（積みMax Build 5）

Webゲームは **直接横ドラッグで筐体の左端が36pxグリッド境界を越えたときだけ**
`{type:'tsumimac:haptic',kind:'grid',strength:1}` を送ります。

- 指の動きは従来どおり自由移動。**36pxへのスナップは行いません**。
- 同じ36pxマス内では送信しない。左右どちらも対応。
- 壁・他の筐体との衝突で移動できなかった場合は送信しない。
- 高速スワイプで複数マスを一度に越えた場合は、連続振動で固まらないよう **1 pointer moveにつき1回** にまとめます。
- キーボードや画面の左右ボタンは対象外。既存の配置確定・行消しの振動は変更しません。
- PCブラウザやネイティブ受信処理がない環境では触覚フィードバックはありません。

**重要：Expo側は別プロジェクトです。Web側のPRをマージしただけではiPhoneは振動しません。**

Expo iOSラッパーの `react-native-webview` で、既存の `onMessage` の
`tsumimac:haptic` 分岐に以下を追加してください。
既存の `place`/`clear` 分岐を消したり、別の `onMessage` で上書きしたりしないでください。

```tsx
import * as Haptics from 'expo-haptics';

// JSON.parse(event.nativeEvent.data) が成功し、
// message.type === 'tsumimac:haptic' を確認した後:
if (message.kind === 'grid') {
  void Haptics.selectionAsync().catch(() => {});
  return;
}
// existing place / clear processing follows...
```

Expoラッパーで `expo-haptics` が未導入なら
`npx expo install expo-haptics` を実行します。

TestFlight実機で、以下を確認してください。

1. 右へゆっくり横ドラッグすると36px境界ごとに弱いクリック感がある
2. 左へ戻しても同様にクリックする
3. 同じマス内だけの微移動では振動しない
4. 壁にぶつけて動かない状態で余分な振動が出ない
5. タップ回転、下スワイプ落下、配置確定・行消しは従来どおり
6. 低電力モードやiOSの触覚設定により、触感が弱い・再生されない場合がある

ネイティブ表示名・アイコンを「積みMax」に変更する場合も、
Expo設定と画像を変えたうえで新しい EAS Build が必要です。
