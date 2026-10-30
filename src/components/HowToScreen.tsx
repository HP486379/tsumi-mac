import { DEVICE_KINDS, DEVICES, formatYen } from '../data/devices';
import { OCCUPANCY_THRESHOLD } from '../game/config';
import { deviceCells } from '../data/gameModes';

export function HowToScreen({ onBack }: { onBack: () => void }) {
  return (
    <main className="screen howto-screen" data-testid="howto-screen">
      <h2>遊び方</h2>
      <section><h3>3つのモード</h3><p>テトリスモードは従来の通常モードと同じルール・記録です。実寸モードは540×900pxで実機の寸法比を再現します。</p><p>最多積載台数チャレンジは360×648px。行消しはなく、固定済みのMacを1台ずつ数えます。崩れても続行し、出現場所が連続3秒間塞がったときだけ終了します。操作中のMacは台数に含めず、完全に盤外へ落ちたMacは現在台数から除外します。最高台数の記録は減りません。</p></section>
      <section>
        <h3>テトリスモード（旧通常）のルール</h3>
        <ul>
          <li>上から落ちてくる「Mac風デバイス」を積み上げます。重さ・摩擦・重心で挙動が変わります。</li>
          <li>重いデバイスは下の積みMacを押し動かし、軽いデバイスは衝撃で滑りやすくなります。</li>
          <li>接地して約0.8秒静止すると配置確定。確定後も物理演算は続き、強い衝撃で再び動きます。</li>
          <li>危険ライン（赤い点線）より上にはみ出した状態が2秒続くと「積みMac崩壊」です。</li>
        </ul>
      </section>
      <section>
        <h3>行消し（資産整理）の判定</h3>
        <ul>
          <li>盤面は10列×18行の仮想グリッドで判定します。</li>
          <li>各マスがデバイスに{Math.round(OCCUPANCY_THRESHOLD * 100)}%以上覆われると「占有」。1行10マスすべて占有で整理されます。</li>
          <li>整理されるのは<strong>その行にかかる部分だけ</strong>。デバイスは切断され、残りは重力で落下します。</li>
          <li>大きく傾いた（約11°以上）デバイスは分割せず、行に半分以上かかっている場合のみ丸ごと整理します。</li>
          <li>整理額は消えた面積の割合で按分。連続で整理すると「断捨離成功！」コンボ。</li>
        </ul>
      </section>
      <section>
        <h3>操作</h3>
        <table className="keys">
          <tbody>
            <tr><th>← →</th><td>左右移動</td></tr>
            <tr><th>↑ / X</th><td>右回転</td></tr>
            <tr><th>Z</th><td>左回転</td></tr>
            <tr><th>↓</th><td>高速落下</td></tr>
            <tr><th>Space</th><td>ハードドロップ</td></tr>
            <tr><th>P / Esc</th><td>一時停止</td></tr>
          </tbody>
        </table>
        <p>スマートフォンでは画面下のボタン（左・右・回転・高速落下・一時停止）で操作します。</p>
      </section>
      <section>
        <h3>登場デバイス（通常モード・架空パラメータ）</h3>
        <table className="devices">
          <thead><tr><th>名称</th><th>サイズ</th><th>質量</th><th>散財額</th></tr></thead>
          <tbody>
            {DEVICE_KINDS.map((k) => {
              const d = DEVICES[k];
              const cells = deviceCells(k, 'classic');
              return (
                <tr key={k}>
                  <td>{d.name}</td>
                  <td>{cells.w}×{Number(cells.h.toFixed(3))}</td>
                  <td>{d.mass}</td>
                  <td>{formatYen(d.price)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="note">サイズは36px単位。薄型のM1・M2は約13.16px高で、2層では1行に足りず、3層で整理できます。M4は従来のM1・M2と同じ72×36pxです。</p>
        <p className="note">イベント「新製品発表」で高額機が続けて入荷、「整備済製品入荷」で次の3台が15%オフになります。</p>
      </section>
      <button type="button" className="btn primary" data-testid="howto-back" onClick={onBack}>
        タイトルへ戻る
      </button>
    </main>
  );
}
