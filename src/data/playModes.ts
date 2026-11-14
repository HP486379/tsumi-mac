import type { GameMode } from './gameModes';
/** Play rules are separate from the unchanged classic/real physical profiles. */
export type PlayMode=GameMode|'count';
export const physicsMode=(mode:PlayMode):GameMode=>mode==='count'?'classic':mode;
