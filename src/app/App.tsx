import { useCallback, useMemo, useState } from 'react';
import { TitleScreen } from '../components/TitleScreen';
import { HowToScreen } from '../components/HowToScreen';
import { GameScreen } from '../components/GameScreen';
import { GameOverScreen } from '../components/GameOverScreen';
import { AudioManager } from '../game/systems/audio';
import { loadHighScore, loadSettings, saveSettings, submitResult, type HighScore, type Settings } from '../game/systems/highscore';
import type { ScoreSnapshot } from '../game/systems/scoring';

import type { GameMode } from '../data/gameModes';

type Screen = 'title' | 'howto' | 'game' | 'result';

function seedFromUrl(): number | undefined {
  try {
    const v = new URLSearchParams(location.search).get('seed');
    return v ? Number(v) || undefined : undefined;
  } catch {
    return undefined;
  }
}

export function App() {
  const [mode,setMode]=useState<GameMode>('classic');
  const [screen, setScreen] = useState<Screen>('title');
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const [highScore, setHighScore] = useState<HighScore>(() => loadHighScore());
  const [result, setResult] = useState<{ score: ScoreSnapshot; newRecord: boolean } | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const audio = useMemo(() => new AudioManager(settings.se, settings.bgm), []);
  const seed = useMemo(() => seedFromUrl(), []);

  const setSettings = useCallback((s: Settings) => {
    setSettingsState(s);
    saveSettings(s);
    audio.setSe(s.se);
    audio.setBgm(s.bgm);
  }, [audio]);

  const startGame = useCallback((nextMode:GameMode=mode) => {
    setMode(nextMode);setHighScore(loadHighScore(undefined,nextMode));
    audio.unlock();
    setResult(null);
    setGameKey((k) => k + 1);
    setScreen('game');
  }, [audio,mode]);

  const onGameOver = useCallback((score: ScoreSnapshot) => {
    const { hs, newRecord } = submitResult(score,undefined,mode);
    setHighScore(hs);
    setResult({ score, newRecord });
    setScreen('result');
  }, [mode]);

  const toTitle = useCallback(() => {
    setMode('classic');setHighScore(loadHighScore());
    audio.stopBgm();
    setScreen('title');
  }, [audio]);

  return (
    <div className="app" data-screen={screen}>
      {screen === 'title' && (
        <TitleScreen highScore={highScore} settings={settings} onSettings={setSettings} onStart={()=>startGame('classic')} onRealStart={()=>startGame('real')} onHowTo={() => setScreen('howto')} />
      )}
      {screen === 'howto' && <HowToScreen onBack={() => setScreen('title')} />}
      {screen === 'game' && (
        <GameScreen mode={mode} key={gameKey} audio={audio} settings={settings} onSettings={setSettings} onGameOver={onGameOver} onTitle={toTitle} seed={seed} />
      )}
      {screen === 'result' && result && (
        <GameOverScreen mode={mode} score={result.score} highScore={highScore} newRecord={result.newRecord} onRetry={()=>startGame(mode)} onTitle={toTitle} />
      )}
    </div>
  );
}
