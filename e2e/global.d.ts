import type { EngineDebugApi } from '../src/game/engine/GameEngine';
declare global {
  interface Window { __tsumimac?: EngineDebugApi; __shared?: ShareData | null }
}
export {};
