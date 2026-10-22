export type Point = { x: number; y: number };
type Polygon = readonly Point[];
const EPS = 1e-8;
/** Sutherland–Hodgman clipping against an axis-aligned cell. */
export function clipCell(
  poly: Polygon,
  x: number,
  y: number,
  size: number,
  height = size,
): Point[] {
  let out = [...poly];
  for (const [axis, edge, sign] of [
    ["x", x, 1],
    ["x", x + size, -1],
    ["y", y, 1],
    ["y", y + height, -1],
  ] as const) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i],
        b = input[(i + 1) % input.length];
      const insideA = (a[axis] - edge) * sign >= -EPS,
        insideB = (b[axis] - edge) * sign >= -EPS;
      if (insideA) out.push(a);
      if (insideA !== insideB) {
        const t = (edge - a[axis]) / (b[axis] - a[axis]);
        out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
      }
    }
  }
  return out;
}
/** Exact vertical-slab integration of the union of convex polygons.
 * Edge intersections split slabs so their union length is linear inside each slab.
 * Unlike summed areas this cannot count overlapping bodies twice.
 */
export function unionArea(polys: Polygon[]): number {
  const polygons = polys.filter((p) => p.length >= 3);
  const edges = polygons.flatMap((p) =>
    p.map((a, i) => [a, p[(i + 1) % p.length]] as const),
  );
  const xs = polygons.flatMap((p) => p.map((v) => v.x));
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i],
        [c, d] = edges[j];
      const rx = b.x - a.x,
        ry = b.y - a.y,
        sx = d.x - c.x,
        sy = d.y - c.y;
      const det = rx * sy - ry * sx;
      if (Math.abs(det) < EPS) continue;
      const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / det;
      const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / det;
      if (t > 0 && t < 1 && u > 0 && u < 1) xs.push(a.x + t * rx);
    }
  xs.sort((a, b) => a - b);
  let area = 0;
  for (let i = 1; i < xs.length; i++) {
    const width = xs[i] - xs[i - 1];
    if (width < EPS) continue;
    const x = (xs[i] + xs[i - 1]) / 2;
    const intervals: [number, number][] = [];
    for (const p of polygons) {
      const ys: number[] = [];
      for (let j = 0; j < p.length; j++) {
        const a = p[j],
          b = p[(j + 1) % p.length];
        if ((a.x <= x && b.x > x) || (b.x <= x && a.x > x))
          ys.push(a.y + ((x - a.x) * (b.y - a.y)) / (b.x - a.x));
      }
      if (ys.length >= 2) intervals.push([Math.min(...ys), Math.max(...ys)]);
    }
    intervals.sort((a, b) => a[0] - b[0]);
    let length = 0,
      end = -Infinity;
    for (const [a, b] of intervals) {
      length += Math.max(0, b - Math.max(a, end));
      end = Math.max(end, b);
    }
    area += width * length;
  }
  return area;
}
export function coverage(
  polys: Polygon[],
  x: number,
  y: number,
  size = 36,
): number {
  return Math.min(
    1,
    Math.max(
      0,
      unionArea(polys.map((p) => clipCell(p, x, y, size))) / (size * size),
    ),
  );
}
export function fullRows(
  polys: Polygon[],
  cell = 36,
  columns = 10,
  rows = 18,
): number[] {
  const result: number[] = [];
  const bounds = polys.map((p) => ({
    p,
    minX: Math.min(...p.map((v) => v.x)),
    maxX: Math.max(...p.map((v) => v.x)),
    minY: Math.min(...p.map((v) => v.y)),
    maxY: Math.max(...p.map((v) => v.y)),
  }));
  for (let row = rows - 1; row >= 0; row--) {
    const y = row * cell;
    const candidates = bounds.filter((b) => b.maxY > y && b.minY < y + cell);
    if (!candidates.length) continue;
    let full = true;
    for (let col = 0; col < columns; col++) {
      const x = col * cell;
      if (
        coverage(
          candidates
            .filter((b) => b.maxX > x && b.minX < x + cell)
            .map((b) => b.p),
          x,
          y,
          cell,
        ) <
        0.9 - 1e-9
      ) {
        full = false;
        break;
      }
    }
    if (full) result.push(row);
  }
  return result;
}
export function intersectsRow(poly: Polygon, row: number, cell = 36) {
  // Matter's contact solver permits slight penetration. Do not treat a device
  // merely resting on the next row as crossing the row being cleared.
  const contactTolerance = 1;
  return (
    unionArea([
      clipCell(
        poly,
        0,
        row * cell + contactTolerance,
        cell * 10,
        cell - 2 * contactTolerance,
      ),
    ]) > 1e-5
  );
}
