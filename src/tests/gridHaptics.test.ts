import { describe, expect, it } from 'vitest';
import { crossedGridBoundary } from '../game/systems/gridHaptics';

describe('touch-grid haptic boundary detection', () => {
  it('does not trigger while the device remains inside the same cell', () => {
    expect(crossedGridBoundary(4, 35)).toBe(false);
    expect(crossedGridBoundary(35, 4)).toBe(false);
    expect(crossedGridBoundary(36, 36)).toBe(false);
  });

  it('fires once per pointer update crossing a 36px boundary in either direction', () => {
    expect(crossedGridBoundary(35, 37)).toBe(true);
    expect(crossedGridBoundary(37, 35)).toBe(true);
    expect(crossedGridBoundary(72, 71)).toBe(true);
    expect(crossedGridBoundary(71, 72)).toBe(true);
  });

  it('recognizes a fast swipe across multiple cells without changing movement', () => {
    expect(crossedGridBoundary(9, 155)).toBe(true);
    expect(crossedGridBoundary(155, 9)).toBe(true);
  });

  it('ignores invalid positions and floating point boundary noise', () => {
    expect(crossedGridBoundary(NaN, 37)).toBe(false);
    expect(crossedGridBoundary(34, Infinity)).toBe(false);
    expect(crossedGridBoundary(36, 36 - 1e-9)).toBe(false);
  });
});
