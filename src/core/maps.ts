// Bản đồ chuẩn Ticket-02 (Phần 2). Góc đo từ +X, ngược chiều kim đồng hồ nhìn từ trên xuống:
// điểm ở góc a, bán kính r = (r·cos a, y, r·sin a) → 90° là +Z.
import { TUNING, sec } from './config';

export type Vec3 = [number, number, number];

export interface Pad { pos: Vec3; vy: number; hDir: [number, number]; hSpeed: number }

export interface NightMap {
  night: number;
  name: string;
  durationS: number;
  start: Vec3;
  startFacing: [number, number];
  lanterns: { id: string; pos: Vec3 }[];
  motePoints: Vec3[];
  shadePoints: Vec3[];
  shadeInterval: number;
  shadeMax: number;
  shadeSpeed: number;
  pads: Pad[];
  charms: Vec3[];
  drifters: boolean;
  wind: boolean;
  /** Độ cao mặt đất đi được tại (x, z); null = khoảng không (rơi). */
  ground(x: number, z: number): number | null;
  /** Vật cản đặc (tháp chuông). */
  solid(x: number, z: number, y: number): boolean;
}

const rad = (d: number) => (d * Math.PI) / 180;
export const polar = (r: number, deg: number, y = 0, cx = 0, cz = 0): Vec3 =>
  [cx + r * Math.cos(rad(deg)), y, cz + r * Math.sin(rad(deg))];
const ring = (r: number, startDeg: number, stepDeg: number, count: number, y = 0, cx = 0, cz = 0): Vec3[] =>
  Array.from({ length: count }, (_, i) => polar(r, startDeg + i * stepDeg, y, cx, cz));
const lid = (pos: Vec3[]) => pos.map((p, i) => ({ id: `L${i + 1}`, pos: p }));
const norm2 = (x: number, z: number): [number, number] => {
  const l = Math.hypot(x, z);
  return [x / l, z / l];
};
const noSolid = () => false;

// ---------- Đêm 1 — Đảo Bến ----------
const night1: NightMap = {
  night: 1,
  name: 'Đảo Bến',
  durationS: TUNING.night1_duration_s,
  start: [0, 0, 0],
  startFacing: [0, 1],
  lanterns: lid([[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]),
  motePoints: [...ring(12, 0, 45, 8), ...ring(33, 0, 22.5, 16)],
  shadePoints: ring(37, 15, 30, 12),
  shadeInterval: sec(8),
  shadeMax: 6,
  shadeSpeed: TUNING.shade_speed,
  pads: [],
  charms: [],
  drifters: false,
  wind: false,
  ground: (x, z) => (Math.hypot(x, z) <= 40 ? 0 : null),
  solid: noSolid,
};

// ---------- Đêm 2 — Đảo Cau ----------
const B = 70;
const night2: NightMap = {
  night: 2,
  name: 'Đảo Cau',
  durationS: TUNING.night2_duration_s,
  start: [0, 0, 0],
  startFacing: [0, 1],
  lanterns: lid([[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]),
  motePoints: [
    ...ring(10, 0, 90, 4), ...ring(22, 0, 45, 8),
    ...ring(10, 0, 90, 4, 0, B), ...ring(22, 0, 45, 8, 0, B),
  ],
  shadePoints: [...ring(26, 22.5, 45, 8), ...ring(26, 22.5, 45, 8, 0, B)],
  shadeInterval: sec(7),
  shadeMax: 8,
  shadeSpeed: TUNING.shade_speed,
  pads: [
    { pos: [20, 0, 18], vy: 14, hSpeed: 24, hDir: norm2(B - 20, 0 - 18) },
    { pos: [50, 0, -18], vy: 14, hSpeed: 24, hDir: norm2(0 - 50, 0 + 18) },
  ],
  charms: [[35, 0, 0]],
  drifters: true,
  wind: false,
  ground: (x, z) => {
    if (Math.hypot(x, z) <= 28 || Math.hypot(x - B, z) <= 28) return 0;
    if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0;
    return null;
  },
  solid: noSolid,
};

// ---------- Đêm 3 — Đảo Chuông ----------
const RAMP_DEGS = [30, 150];
function ground3(x: number, z: number): number | null {
  const r = Math.hypot(x, z);
  if (r > 45) return null;
  let h = 0;
  if (r <= 8) h = 6;
  else if (z > 0 && r >= 12 && r <= 24) h = 3;
  for (const d of RAMP_DEGS) {
    const ux = Math.cos(rad(d));
    const uz = Math.sin(rad(d));
    const s = x * ux + z * uz; // khoảng cách dọc theo bán kính
    const lat = Math.abs(x * uz - z * ux); // khoảng cách ngang so với trục dốc
    if (lat <= 1.5 && s >= 24 && s <= 30) h = Math.max(h, (3 * (30 - s)) / 6);
  }
  return h;
}
const night3: NightMap = {
  night: 3,
  name: 'Đảo Chuông',
  durationS: TUNING.night3_duration_s,
  start: [0, 0, -30],
  startFacing: [0, 1],
  lanterns: lid([[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]),
  motePoints: [...ring(34, 0, 20, 18), ...ring(18, 20, 20, 8, 3), ...ring(5, 45, 90, 4, 6)],
  shadePoints: ring(43, 0, 22.5, 16),
  shadeInterval: sec(6),
  shadeMax: 10,
  shadeSpeed: 4.5,
  pads: [{ pos: [0, 3, 13], vy: 12, hSpeed: 8, hDir: [0, -1] }],
  charms: [[30, 0, 25], [-30, 0, 25]],
  drifters: true,
  wind: true,
  ground: ground3,
  solid: (x, z, y) => Math.hypot(x, z) < 2 && y < 6 + 8, // tháp chuông r = 2, cao 8 m trên tầng 2
};

export const MAPS: Record<number, NightMap> = { 1: night1, 2: night2, 3: night3 };
