export const CELL = 36,
  WIDTH = 360,
  HEIGHT = 648,
  DANGER = 72;
export const DEVICES = [
  {
    id: "m1",
    name: "mini M1",
    cols: 2,
    rows: 1,
    mass: 1.2,
    price: 50000,
    color: "#bfcdd1",
    friction: 0.38,
  },
  {
    id: "m2",
    name: "mini M2",
    cols: 2,
    rows: 1,
    mass: 1.3,
    price: 70000,
    color: "#c8c8df",
    friction: 0.4,
  },
  {
    id: "m4",
    name: "mini M4",
    cols: 1,
    rows: 1,
    mass: 0.7,
    price: 115000,
    color: "#efb58e",
    friction: 0.24,
  },
  {
    id: "studio",
    name: "Studio",
    cols: 3,
    rows: 2,
    mass: 2.7,
    price: 330000,
    color: "#a8c6b3",
    friction: 0.48,
  },
  {
    id: "pro",
    name: "Pro",
    cols: 2,
    rows: 4,
    mass: 7,
    price: 1000000,
    color: "#b5bac0",
    friction: 0.6,
  },
] as const;
export type Device = (typeof DEVICES)[number];
export const yen = (value: number) =>
  `¥${Math.round(value).toLocaleString("ja-JP")}`;
