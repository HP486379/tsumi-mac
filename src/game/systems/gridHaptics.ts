import { CELL } from '../config';

/**
 * Touch dragging remains free-form (no snapping). Give feedback when the
 * active chassis' LEFT edge crosses an actual 36px board-grid boundary.
 *
 * The visual grid is 36px even for upright thin devices that have a
 * smaller keyboard movement lattice. A quick swipe may cross several
 * cells in one pointer event; the host should emit one feedback pulse,
 * not flood the native haptics queue.
 */
export function crossedGridBoundary(beforeLeft: number, afterLeft: number, cell = CELL): boolean {
  if (!Number.isFinite(beforeLeft) || !Number.isFinite(afterLeft) ||
      !Number.isFinite(cell) || cell <= 0) return false;
  const epsilon = 1e-6;
  return Math.floor((beforeLeft + epsilon) / cell) !==
    Math.floor((afterLeft + epsilon) / cell);
}
