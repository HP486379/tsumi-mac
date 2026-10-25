import type { Settings } from '../game/systems/highscore';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
}

export function SoundToggles({ settings, onChange }: Props) {
  return (
    <div className="sound-toggles" role="group" aria-label="サウンド設定">
      <button
        type="button"
        className={`toggle ${settings.bgm ? 'on' : 'off'}`}
        aria-pressed={settings.bgm}
        data-testid="toggle-bgm"
        onClick={() => onChange({ ...settings, bgm: !settings.bgm })}
      >
        BGM {settings.bgm ? 'ON' : 'OFF'}
      </button>
      <button
        type="button"
        className={`toggle ${settings.se ? 'on' : 'off'}`}
        aria-pressed={settings.se}
        data-testid="toggle-se"
        onClick={() => onChange({ ...settings, se: !settings.se })}
      >
        効果音 {settings.se ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}
