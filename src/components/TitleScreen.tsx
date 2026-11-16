import type { HighScore, Settings } from '../game/systems/highscore';
import { SoundToggles } from './SoundToggles';

interface Props {
  highScore: HighScore;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onStart: () => void;
  onRealStart:()=>void;
  onCountStart:()=>void;
  onHowTo: () => void;
}

export function TitleScreen({ settings, onSettings, onStart, onRealStart,onCountStart,onHowTo }: Props) {
  return (
    <main className="screen title-screen" data-testid="title-screen">
      <div className="title-stack" aria-hidden="true">
        <div className="ts-box ts-pro" />
        <div className="ts-box ts-studio" />
        <div className="ts-box ts-mini" />
        <div className="ts-box ts-m4" />
      </div>
      <h1 className="logo">
        <span className="logo-ja">積みMax</span>
        <span className="logo-en">STACK YOUR MAX</span>
      </h1>
      <p className="catch">買って満足。積んで絶望。</p>
      <div className="menu">
        <button type="button" className="btn primary big" data-testid="start-button" onClick={onStart}>
          テトリスモード
        </button>
        <button type="button" className="btn" data-testid="real-start-button" onClick={onRealStart}>実寸モード</button>
        <small className="mode-description">540×900の広い盤面で実機の寸法比を再現。テトリスモードとは別に記録を保存。</small>
        <button type="button" className="btn" data-testid="count-start-button" onClick={onCountStart}>最多積載台数チャレンジ</button>
        <small className="mode-description">行消しなし。崩れても続行！ 盤内に残るMaxの最高台数に挑戦。</small>
        <button type="button" className="btn" data-testid="howto-button" onClick={onHowTo}>
          遊び方
        </button>
      </div>
      <SoundToggles settings={settings} onChange={onSettings} />
      <p className="disclaimer">
        本作は非公式のファンメイド・パロディゲームです。テトリス・最多積載モードのサイズと、全モードの質量・価格はゲーム用パラメータです。実寸モードは実機の寸法比を反映します。
        本作は独立して制作されたゲームであり、実在する企業による提携・後援・承認を受けたものではありません。
      </p>
    </main>
  );
}
