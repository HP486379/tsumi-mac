import { describe, expect, it } from "vitest";
import {
  clipCell,
  coverage,
  fullRows,
  intersectsRow,
  unionArea,
} from "../game/grid/occupancy";
const rect = (x: number, y: number, w: number, h: number) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];
describe("polygon union occupancy", () => {
  it("accepts exactly 90%, rejects below 90%, clamps at 100%", () => {
    expect(coverage([rect(0, 0, 32.4, 36)], 0, 0)).toBeCloseTo(0.9, 10);
    expect(fullRows([rect(0, 0, 32.4, 36)], 36, 1, 1)).toEqual([0]);
    expect(fullRows([rect(0, 0, 32.39, 36)], 36, 1, 1)).toEqual([]);
    expect(coverage([rect(-50, -50, 500, 500)], 0, 0)).toBe(1);
  });
  it("uses a union instead of double-counting overlaps", () => {
    const p = rect(0, 0, 18, 36);
    expect(coverage([p, p, p], 0, 0)).toBeCloseTo(0.5);
    expect(fullRows([p, p], 36, 1, 1)).toEqual([]);
    expect(coverage([p, rect(18, 0, 18, 36)], 0, 0)).toBe(1);
    expect(unionArea([rect(0, 0, 20, 20), rect(10, 10, 20, 20)])).toBeCloseTo(
      700,
    );
  });
  it("handles rotated bodies, crossing polygon edges, and cell clipping", () => {
    const diamond = [
      { x: 18, y: 0 },
      { x: 36, y: 18 },
      { x: 18, y: 36 },
      { x: 0, y: 18 },
    ];
    expect(coverage([diamond], 0, 0)).toBeCloseTo(0.5);
    const a = [
        { x: 0, y: 0 },
        { x: 36, y: 0 },
        { x: 0, y: 36 },
      ],
      b = [
        { x: 0, y: 36 },
        { x: 36, y: 36 },
        { x: 36, y: 0 },
      ];
    expect(coverage([a, b], 0, 0)).toBeCloseTo(1);
    expect(unionArea([clipCell(rect(-10, -10, 30, 30), 0, 0, 36)])).toBeCloseTo(
      400,
    );
  });
  it("finds multiple full rows and only positive intersections", () => {
    const p = rect(0, 576, 360, 72);
    expect(fullRows([p])).toEqual([17, 16]);
    expect(intersectsRow(rect(0, 576, 36, 36), 17)).toBe(false);
    expect(intersectsRow(rect(0, 576, 36, 36.1), 17)).toBe(false);
    expect(intersectsRow(rect(0, 576, 36, 37.1), 17)).toBe(true);
    expect(
      intersectsRow(
        [
          { x: 0, y: 600 },
          { x: 36, y: 620 },
          { x: 0, y: 620 },
        ],
        17,
      ),
    ).toBe(true);
  });
});
