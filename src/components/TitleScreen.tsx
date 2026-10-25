import { formatYen } from '../data/devices';
import type { HighScore, Settings } from '../game/systems/highscore';
import { SoundToggles } from './SoundToggles';

interface Props {
  highScore: HighScore;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onStart: () => void;
  onHowTo: () => void;
}

export function TitleScreen({ highScore, settings, onSettings, onStart, onHowTo }: Props) {
  return (
    <main className="screen title-screen" data-testid="title-screen">
      <div className="title-stack" aria-hidden="true">
        <div className="ts-box ts-pro" />
        <div className="ts-box ts-studio" />
        <div className="ts-box ts-mini" />
        <div className="ts-box ts-m4" />
      </div>
      <h1 className="logo">
        <span className="logo-ja">積みMac</span>
        <span className="logo-en">STACK YOUR MAC</span>
      </h1>
      <p className="catch">買って満足。積んで絶望。</p>
      <div className="menu">
        <button type="button" className="btn primary big" data-testid="start-button" onClick={onStart}>
          積みはじめる
        </button>
        <button type="button" className="btn" data-testid="howto-button" onClick={onHowTo}>
          遊び方
        </button>
      </div>
      <SoundToggles settings={settings} onChange={onSettings} />
      <dl className="hiscore" data-testid="title-highscore">
        <div><dt>最高散財額</dt><dd data-testid="hs-spent">{formatYen(highScore.bestSpent)}</dd></div>
        <div><dt>最多整理行数</dt><dd>{highScore.bestLines}行</dd></div>
        <div><dt>プレイ回数</dt><dd>{highScore.plays}回</dd></div>
      </dl>
      <p className="disclaimer">
        本作は非公式のファンメイド・パロディゲームです。登場デバイスのサイズ・質量・価格はゲーム用の架空パラメータで、実製品の仕様・価格とは関係ありません。
        Mac、Mac mini、Mac Studio、Mac Pro は Apple Inc. の商標です。
      </p>
    </main>
  );
}
