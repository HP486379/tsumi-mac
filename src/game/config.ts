/** 現行モードの定数。実寸モードの盤面寸法はboard.tsで分離し、画面ピクセルとも独立させる。 */
export const COLS = 10;
export const ROWS = 18;
export const CELL = 36;
export const FIELD_W = COLS * CELL; // 360
export const FIELD_H = ROWS * CELL; // 648

/** 危険ライン：上から2行目の下端（y=72）。これより上にボディがはみ出すと危険。 */
export const DANGER_ROWS = 2;
export const DANGER_Y = DANGER_ROWS * CELL;
/** 危険ライン超過がこの時間継続したらゲームオーバー（秒） */
export const DANGER_TIMEOUT_S = 2.0;

/** 物理の固定時間ステップ（60Hz） */
export const PHYSICS_HZ = 60;
export const STEP_MS = 1000 / PHYSICS_HZ;
/** 1フレームで処理する物理ステップ数の上限（フレーム遅延時のスパイラル防止） */
export const MAX_STEPS_PER_FRAME = 4;

/** 接地後に配置確定するまでの安定時間（秒） */
export const LOCK_DELAY_S = 0.8;
/** 安定とみなす速度しきい値（px/step, rad/step） */
export const LOCK_SPEED_EPS = 0.18;
export const LOCK_ANGULAR_EPS = 0.012;
/** 接地後に転がり続ける場合の強制確定（秒） */
export const LOCK_FORCE_S = 5.0;

/** セル占有判定のしきい値 */
export const OCCUPANCY_THRESHOLD = 0.9;

/** 落下速度（px/step） */
export const BASE_FALL_SPEED = 1.4;
export const FALL_SPEED_PER_LEVEL = 0.32;
export const MAX_FALL_SPEED = 6.0;
export const SOFT_DROP_SPEED = 7.5;
/** ハードドロップ速度。セル(36px)より十分小さく保ちトンネリングを防ぐ */
export const HARD_DROP_SPEED = 16;
export const LINES_PER_LEVEL = 5;
export const MAX_LEVEL = 15;

/** 横移動のオートリピート（ms） */
export const MOVE_STEP_PX = 4;
export const DAS_MS = 170;
/** 60Hzでは約33msごとに4px。細かさを保ちつつ長押しで盤面を横断できる。 */
export const ARR_MS = 25;

/** 壁の厚み（トンネリング防止のため厚くする） */
export const WALL_THICKNESS = 240;

/** 行判定の実行間隔（物理ステップ数） */
export const ROW_CHECK_INTERVAL = 10;

/** イベント発生間隔（秒） */
export const EVENT_MIN_S = 22;
export const EVENT_MAX_S = 38;

/** HUD（React）への通知間隔（ms）。毎フレームのstate更新はしない */
export const HUD_INTERVAL_MS = 120;
