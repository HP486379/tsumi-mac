import type { Settings } from '../game/systems/highscore';
import { SoundToggles } from './SoundToggles';

interface Props {
  settings: Settings;
  onSettings: (s: Settings) => void;
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
}

export function PauseOverlay({ settings, onSettings, onResume, onRestart, onTitle }: Props) {
  return (
    <div className="overlay pause-overlay" role="dialog" aria-modal="true" aria-label="一時停止" data-testid="pause-overlay">
      <div className="panel">
        <h2>一時停止中</h2>
        <p className="sub">積みMacは逃げません（たぶん）</p>
        <button type="button" className="btn primary big" data-testid="resume-button" onClick={onResume} autoFocus>
          再開する
        </button>
        <SoundToggles settings={settings} onChange={onSettings} />
        <div className="row">
          <button type="button" className="btn" data-testid="pause-restart" onClick={onRestart}>最初から</button>
          <button type="button" className="btn" data-testid="pause-title" onClick={onTitle}>タイトルへ</button>
        </div>
      </div>
    </div>
  );
}
