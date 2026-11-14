import type { CountSnapshot } from '../game/count/CountSim';
import { formatTime } from '../app/share';

export function CountResultScreen({count,best,timeMs,onRetry,onTitle}:{count:CountSnapshot;best:number;timeMs:number;onRetry:()=>void;onTitle:()=>void}){
 return <main className="screen result-screen" data-testid="count-result-screen">
  <h2>最多積載台数チャレンジ</h2>
  <p>出現場所が3秒間塞がったため終了しました。</p>
  <dl className="result-table">
   <div className="hl"><dt>今回の最高積載台数</dt><dd data-testid="count-result-peak">{count.peak}台</dd></div>
   <div><dt>終了時の積載台数</dt><dd data-testid="count-result-current">{count.current}台</dd></div>
   <div><dt>歴代最高積載台数</dt><dd data-testid="count-result-best">{best}台</dd></div>
   <div><dt>プレイ時間</dt><dd>{formatTime(timeMs)}</dd></div>
  </dl>
  <div className="menu"><button className="btn primary big" data-testid="count-retry" onClick={onRetry}>もう一度挑戦</button><button className="btn" data-testid="count-title" onClick={onTitle}>タイトルへ</button></div>
 </main>;
}
