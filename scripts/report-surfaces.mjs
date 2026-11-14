import { chromium } from '@playwright/test';
import { readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.env.SURFACE_OUTPUT||'test-results/surfaces'),docs='docs/surface-validation';await mkdir(docs,{recursive:true});
const before=JSON.parse(await readFile(path.join(out,'before-surfaces.json'),'utf8'));
const after=JSON.parse(await readFile(path.join(out,'after-surfaces.json'),'utf8'));
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page=await browser.newPage({viewport:{width:1100,height:1350},deviceScaleFactor:1.5});
const pictures=await Promise.all(['before','after'].map(async label=>(await readFile(path.join(out,`${label}-surfaces.png`))).toString('base64')));
await page.setContent(`<body style="margin:12px;background:#111620;color:white;font:18px system-ui"><h2>Before: original real-size fitting policy</h2><img width="1060" src="data:image/png;base64,${pictures[0]}"><h2>After: collision-aligned model / unchanged depth</h2><img width="1060" src="data:image/png;base64,${pictures[1]}"></body>`);
await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
await page.screenshot({path:path.join(out,'comparison-surfaces.png'),fullPage:true});await browser.close();
await copyFile(path.join(out,'comparison-surfaces.png'),path.join(docs,'comparison-surfaces.png'));
const csv=(rows)=>{const keys=Object.keys(rows[0]);return [keys.join(','),...rows.map(r=>keys.map(k=>JSON.stringify(r[k])).join(','))].join('\n')+'\n';};
const pairs=after.audit.pairs.map(p=>({lower:p.lowerKind,upper:p.upperKind,angle:p.angle,sharedZ:p.z,actualLowerTop:p.localLowerTop,actualUpperBottom:p.localUpperBottom,worldGap:p.worldGap,projectedGap:p.screenGap}));
for(const [name,rows] of [['contacts.csv',pairs],['ground.csv',after.audit.ground],['shape.csv',after.audit.morphology]]) {await writeFile(path.join(docs,name),csv(rows));await writeFile(path.join(out,name),csv(rows));}
const table=after.results.map((r,i)=>`| ${r.kind} | ${before.results[i].actual.worldGap.toFixed(9)} | ${r.actual.worldGap.toFixed(9)} | ${before.results[i].depth} → ${r.depth} |`).join('\n');
const shape=after.audit.morphology.map(m=>`| ${m.kind} | ${m.depth.toFixed(6)} | ${m.curvedNormals} | ${m.bevelNormals} |`).join('\n');
const report=`# 実筐体メッシュの接触・外観維持の追加検証

基準: verify-oblique-physics-sync / 05984e0b3d5d1276d6249fd0bf973cc41d0a3878。
作業ブランチ: verify-chassis-surface-contacts。検証日: 2026-10-28（日本時間）。

## 結果

選択肢1（物理セル優先）の配置を維持した。物理当たり判定は既存のMatter.js矩形/角丸矩形、外観は別のchassisMeshとして分離したまま、chassisProjectionで回転中心・XY寸法を対応づけている。
今回は包絡線の端点だけでなく、**実際の描画三角形と共有中線の交点**を測定した。旧フィット方式のmini M2で報告された22.915736pxの空隙は、実表面間でも再現され、物理セル優先の配置で0pxになった。

| 同機種2台 | 旧フィットの実表面間隙間 px | 現在の実表面間隙間 px | 奥行き px（前→後） |
|---|---:|---:|---:|
${table}

旧フィットは比較用の診断実行中だけ一時復元し、通常の実装へ戻していない。描画に与えるMatter座標は両方とも下段(160,630)、上段(160,594)、床Y=648で同じ。

## 外観を残す方法と変更範囲

- 正面スプライト、Matter.jsの生成形状・質量・接触設定、操作・スコア・ゲームルールは変更していない。
- mini/Studioの角丸水平断面、連続する面取り、アルミ材質・ポート、タワーのパンチング・脚・ハンドル、Late 2013の円筒は維持した。
- 奥行き値と投影の奥行き係数は変更していない。全機種を直方体へ置き換える処理はない。
- XY倍率と回転中心の対応は基準ブランチの選択肢1実装をそのまま使った。今回の製品描画コードの変更は、**タワーのハンドル中心線を0.4px上げる修正のみ**。

追加測定で、タワーを180度回転するとハンドル最上端が物理包絡線から0.4px内側にあることを発見した。半径1.2pxのパイプ中心を上端から1.6px→1.2pxに置き、実表面が物理境界へ届くようにした。パイプ半径・奥行き・筐体本体は変更していない。

| 機種 | 奥行き px | 斜め方向の曲面法線の種類数 | 中間法線を持つ面取り頂点数 |
|---|---:|---:|---:|
${shape}

全機種の既存奥行き値を固定値として検査し、曲面法線・面取りが消えた場合もテストを失敗させる。Late 2013は側面リングの全点が同一半径の円に乗ることも検査する。

## 数値テストと画像

mini M1/M2/M4、Studio、Late 2013の5種について25組合せ×6角度=150ケースで実表面の接触を検証。共有Zで、三角形をローカルYに沿う直線と交差させ、下段上面と上段下面の交点を求めてから実際の描画変換を適用した。最大の実表面間誤差は${after.audit.maxSurfaceGap.toExponential(6)}px。

全6機種×4象限=24ケースの接地は、実メッシュのワールドY最大値と床Yを比較した。修正後の最大差は${after.audit.maxGroundGap}px。物理中心のずれも0px。

Playwrightで生産用ChassisRendererを起動し、同一Matter状態のmini3機種を拡大撮影した。床面は診断用の奥行き付き参照面。色付き点・線は実表面の測定位置を手前へ重ねたデバッグ表示で、製品のLED等の装飾ではない。接触位置の点は手前の筐体で隠れる位置も示している。

![旧方式と物理セル優先方式の実メッシュ比較](comparison-surfaces.png)

現在の接触線に残る黒い細帯は既存の底部材質・面取りによる表現。筐体全体を矩形で埋めて線を消す変更はしていない。

全数値: [実表面の接触150ケース](contacts.csv)、[実表面の接地24ケース](ground.csv)、[外観・奥行きの検査](shape.csv)。完全な生JSONとbefore/after画像はoutputs/surfacesに保存した。

## 検証結果と制約

- npm test: 12ファイル・196件合格。
- npm run build: 成功。
- 本番preview上のPlaywright E2E: 9件合格、端末条件による対象外9件。
- 開発診断ツールもstrict TypeScript検査に合格。

E2Eの初回実行では既存キーボードテストの3回目の回転待ちが1回タイムアウトした。入力・ゲームコード・E2Eテストは変更せず、他の描画撮影と並行させない状態で全件を再実行して上記結果を確認した。この初回の不安定さは隠さず記録する。

物理セル優先なのでminiの高さ等はゲームのセル比率になり、実機の全寸法比をそのまま再現するものではない。実機らしさは曲面・材質・機種固有の形状で維持している。
接触検査は同じ軸に沿った共有面と四方向の接地を対象とする。任意の脚・ハンドル・角の全配置で外観表面と矩形当たり判定が完全一致するとの保証ではない。2D物理に存在しない奥行きの接触を新たに計算する処理も加えていない。

## 再実行

Viteを4173番で起動し、node scripts/verify-surfaces.mjs after を実行する。SURFACE_OUTPUTで保存先を指定できる。
beforeデータとafterデータがあれば node scripts/report-surfaces.mjs で比較画像・CSV・このレポートを生成できる。
診断ページ tools/surface/view.html は通常の製品画面や本番バンドルには組み込まれない。
`;
await writeFile(path.join(docs,'README.md'),report);await writeFile(path.join(out,'REPORT.md'),report);console.log(JSON.stringify({report:path.join(out,'REPORT.md'),maxSurfaceGap:after.audit.maxSurfaceGap,maxGroundGap:after.audit.maxGroundGap}));
