import { useState } from 'react';
import { formatYen } from '../data/devices';
import type { ScoreSnapshot } from '../game/systems/scoring';
import type { HighScore } from '../game/systems/highscore';
import { buildShareText, formatTime, shareText } from '../app/share';
import type { GameMode } from '../data/gameModes';

interface Props {
  mode?:GameMode;
  score: ScoreSnapshot;
  highScore: HighScore;
  newRecord: boolean;
  onRetry: () => void;
  onTitle: () => void;
}

export function GameOverScreen({ score, highScore, newRecord, onRetry, onTitle,mode='classic' }: Props) {
  const [shareMsg, setShareMsg] = useState('');
  const onShare = async () => {
    const url = typeof location !== 'undefined' && location.protocol.startsWith('http') ? location.href.split('#')[0] : undefined;
    const r = await shareText((mode==='real'?'【実寸モード】\n':'')+buildShareText(score, url));
    setShareMsg(
      r === 'shared' ? '共有しました' : r === 'copied' ? '結果をクリップボードにコピーしました' : r === 'cancelled' ? '共有をキャンセルしました' : 'コピーできませんでした',
    );
  };
  return (
    <main className="screen result-screen" data-testid="result-screen">
      <h2 className="collapse-title">積みMac崩壊</h2>
      {mode==='real'&&<p data-testid="result-mode">実寸モードの記録</p>}
      {newRecord && <p className="new-record" data-testid="new-record">最高散財額を更新！</p>}
      <dl className="result-table">
        <div className="hl"><dt>散財総額</dt><dd data-testid="result-spent">{formatYen(score.spent)}</dd></div>
        <div><dt>整理額</dt><dd data-testid="result-cleared">{formatYen(score.cleared)}</dd></div>
        <div><dt>積みMac指数</dt><dd data-testid="result-index">{formatYen(score.fieldValue)}</dd></div>
        <div><dt>整理した行数</dt><dd data-testid="result-lines">{score.lines}行</dd></div>
        <div><dt>最大コンボ</dt><dd>{score.maxCombo}</dd></div>
        <div><dt>購入台数</dt><dd>{score.devices}台</dd></div>
        <div><dt>プレイ時間</dt><dd data-testid="result-time">{formatTime(score.timeMs)}</dd></div>
      </dl>
      <p className="boot-line" data-testid="boot-line">起動したMac：0台</p>
      <p className="best">最高散財額 {formatYen(highScore.bestSpent)}</p>
      <div className="menu">
        <button type="button" className="btn primary big" data-testid="retry-button" onClick={onRetry} autoFocus>
          もう一度積む
        </button>
        <button type="button" className="btn" data-testid="share-button" onClick={() => void onShare()}>
          結果をテキストで共有
        </button>
        <button type="button" className="btn ghost" data-testid="result-title" onClick={onTitle}>
          タイトルへ
        </button>
      </div>
      <p className="share-msg" data-testid="share-msg" aria-live="polite">{shareMsg}</p>
    </main>
  );
}
