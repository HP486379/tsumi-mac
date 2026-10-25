# 積みMac — STACK YOUR MAC

> 買って満足。積んで絶望。

Mac風デバイスを積み上げる、物理演算付き2D落ち物パズル（Vite + React + TypeScript strict + Matter.js + Canvas）。

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
| 落下中の制御 | 操作対象のみ速度・角度を毎ステップ指定（列スナップ移動、90°回転、壁キック）。接地を検出したら制御を解除し完全に物理へ委ねる |
| 配置確定 | 接地後、速度・角速度・移動量が閾値以下の状態が0.8秒継続で確定（転がり続ける場合は5秒で強制確定）。確定後もボディは残り、衝撃で再び動く |
| 重量・摩擦 | `Body.setMass` に質量、軽量機ほど低摩擦。重い機体は衝突時に下の積みMacを押し動かす |
| 占有判定 | 回転後の多角形をセルでクリップ → 同一セル内は包除原理で**和集合面積**（6個超はサンプリング）→ 90%以上で占有 |
| 行消し | 行に交差するボディを行単位で**分割・再構築**し、消去部分のみ除去。残りは再び重力で落下。11.5°以上傾いたボディのみ簡易方式（消去帯に半分以上かかる場合に全体整理） |
| スコア | 台帳で一元管理。`散財総額 = 積みMac指数 + 整理額` を常に維持、部分消去は面積比で按分、同一IDの二重計上を防止 |
| ゲームオーバー | 確定済みボディの上端が危険ラインより上の状態が2秒連続／出現位置が塞がっている |
| 負荷対策 | 60Hz固定ステップ（1フレーム最大4ステップ）、背景・スプライトの事前描画キャッシュ、内部解像度上限、Matter.jsスリープ、HUDは120ms間隔かつ差分時のみReact更新、一時停止・非表示時はrAF停止 |

## 検証用デバッグAPI

ブラウザのコンソールから `window.__tsumimac` が使えます（e2eテストでも使用）。
`state()`, `forceNext('pro')`, `placeLocked(kind, col, row, quadrant)`, `triggerEvent('launch'|'refurb')`, `setTimeScale(n)`, `occupancy()`

## 注意

本作は非公式のパロディゲームです。デバイスのサイズ・質量・価格はゲーム用の架空パラメータで、実製品とは無関係です。
デバイスの絵はCanvasで描いたオリジナルで、Apple公式の画像・ロゴ・製品写真は使用していません。
