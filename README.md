# 積みMac — STACK YOUR MAC

> 買って満足。積んで絶望。

Mac風デバイスを積み上げる、物理演算付き2D落ち物パズル（Vite + React + TypeScript strict + Matter.js + Canvas）。

## 現行の3モード

- **テトリスモード**：旧通常モードの名称変更。360×648px、既存の物理積み上げ・全幅行消し・記録を維持します。
- **実寸モード**：540×900px。全6機種を共通縮尺で再現する既存モードです。
- **最多積載台数チャレンジ**：360×648px、旧通常と同じ筐体・物理。行消しなしで、固定済みのMacの同時台数を競います。崩れても続行し、出現場所が連続3秒間塞がった場合に終了。専用記録に最高台数を保存します。

新モードの仕様・検証と画面は [検証レポート](docs/max-stack-count/README.md) を参照してください。以下には初期実装時の説明も残しています。

全3モードで左右は4pxずつ移動し、長押しで連続移動できます。回転後の位置を保ち、36pxグリッドへの吸着は行いません。詳細と実測値は [横移動の検証レポート](docs/fine-movement/README.md) を参照してください。

## 起動方法

```bash
npm install
npm run dev          # http://localhost:5173 （同一LANのスマホからは表示されたNetwork URLへ）
npm test             # Vitest 単体・統合テスト
npm run build        # tsc -b && vite build → dist/
npm run preview      # 本番ビルドの確認 http://localhost:4173
npx playwright install chromium   # 初回のみ
npm run test:e2e     # Playwright（desktop-chromium / mobile-chromium[Pixel 7]）
```

`dist/` は相対パス（`base: './'`）でビルドされるため、任意の静的ホスティングにそのまま置けます。
`?seed=123` を付けると出現順を固定できます（検証用）。

## 正面＋斜めビュー（dual-view）

- 正面ビューが従来どおりの操作・判定用メイン画面です。PCでは右側に閲覧専用の斜めビューを表示します。
- スマートフォンでは「斜めビュー」の見出しから開閉できます。初期状態は折りたたみで、開くと正面の下に表示します。横向きの低い画面では右側にコンパクト表示します。
- `GameEngine` の既存ループで得た**同じフレームの同じ `RenderState`**を、`frameViews.ts` が正面→斜めの順で渡します。物理ワールド・シミュレーション・入力・ゲームループは追加していません。
- `obliqueRenderer.ts` がCanvas 2Dの疑似3Dを担当します。正面のスプライトキャッシュを共有し、機種・回転・整備済タグ・行消去後の断片を反映します。追加ライブラリはありません。
- 斜めビューの全デバイス前面・床・グリッドは共通の投影面を使います。側面は装飾であり、接触位置や隙間の判断は正面で行ってください。完全な3Dの遮蔽・影・カメラ操作は扱いません。
- 閉じている間は追加描画を切り離します。背景はキャッシュし、追加キャンバスの解像度にも上限を設けています。ポーズ中の開閉・リサイズでは保存済みフレームを再描画し、物理時間は進めません。
- `npm test` は既存61件＋追加13件。`npm run test:e2e` はPC・Pixel 7相当で既存操作と同期表示を確認します。システムChromiumを使う場合は `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` を実行できます。
- 開発環境のChromiumでは開閉どちらも約60fpsを確認しました。N100・スマートフォン実機・Safariでの速度は未検証です。

この変更は `dual-view` ブランチ用です。`main` へのマージおよびGitHub Pagesへの公開は行いません。

## ディレクトリ構成

```
src/
  app/          App（画面遷移）, share（共有テキスト・Web Share/クリップボード）
  components/   Title / HowTo / Game / Pause / GameOver / Hud / TouchControls / SoundToggles
  data/         devices.ts（5種類の架空パラメータ）
  game/
    config.ts   盤面・物理・タイミング定数
    engine/     GameSim（DOM非依存のゲーム本体）, GameEngine（rAF・描画・入力・音）, loop（固定ステップ）
    physics/    world（Matter.js ワールド・ボディ生成）, geometry（SAT・クリップ・面積）
    grid/       occupancy（セル占有率・和集合）, rowClear（行消去・ボディ分割プラン）
    entities/   DeviceEntity
    systems/    scoring, danger, lock, spawner(イベント), input, audio, highscore, rng
    rendering/  renderer（Canvas）, sprites（オリジナルのデバイス絵・キャッシュ）
  hooks/        useStageSize（リサイズ・回転追従）
  styles/       app.css（レスポンシブ）
  tests/        Vitest
e2e/            Playwright
```

## 主な仕様の実装方法

| 項目 | 実装 |
|---|---|
| 座標系 | 論理 360×648（10×18セル、1セル36px）。表示は変換行列でスケーリング |
| 落下中の制御 | 操作対象のみ速度・角度を毎ステップ指定（4px移動、90°回転、細かな壁キック）。接地を検出したら制御を解除し完全に物理へ委ねる |
| 配置確定 | 接地後、速度・角速度・移動量が閾値以下の状態が0.8秒継続で確定（転がり続ける場合は5秒で強制確定）。確定後もボディは残り、衝撃で再び動く |
| 重量・摩擦 | `Body.setMass` に質量、軽量機ほど低摩擦。重い機体は衝突時に下の積みMacを押し動かす |
| 占有判定 | 回転後の多角形をセルでクリップ → 同一セル内は包除原理で**和集合面積**（6個超はサンプリング）→ 90%以上で占有 |
| 行消し | 行に交差するボディを行単位で**分割・再構築**し、消去部分のみ除去。残りは再び重力で落下。11.5°以上傾いたボディのみ簡易方式（消去帯に半分以上かかる場合に全体整理） |
| スコア | 台帳で一元管理。`散財総額 = 積みMac指数 + 整理額` を常に維持、部分消去は面積比で按分、同一IDの二重計上を防止 |
| ゲームオーバー | 確定済みボディの上端が危険ラインより上の状態が2秒連続／出現位置が塞がっている |
| 負荷対策 | 60Hz固定ステップ（1フレーム最大4ステップ）、背景・スプライトの事前描画キャッシュ、内部解像度上限、Matter.jsスリープ、HUDは120ms間隔かつ差分時のみReact更新、一時停止・非表示時はrAF停止 |

## 検証用デバッグAPI

ブラウザのコンソールから `window.__tsumimac` が使えます（e2eテストでも使用）。
`state()`, `forceNext('pro')`, `placeLocked(kind, col, row, quadrant)`, `triggerEvent('launch'|'refurb')`, `setTimeScale(n)`, `occupancy()`, `views()`

`views()` は両ビューの最終描画状態・斜めビューの描画回数・同一フレーム参照の一致を返します（同期検証用）。

## 注意

本作は非公式のパロディゲームです。デバイスのサイズ・質量・価格はゲーム用の架空パラメータで、実製品とは無関係です。
デバイスの絵はCanvasで描いたオリジナルで、Apple公式の画像・ロゴ・製品写真は使用していません。
