// Cảnh benchmark chuẩn (Ticket-04 mục 1): Đêm 1, 200 Bóng Mực wander rải đều trên đảo, 100 đom đóm,
// L1–L3 sáng fuel 100; tắt sinh thêm, sát thương, nhặt, hao dầu, kết thúc Đêm. Mây đứng yên tại (0,0,0).
import { createWorld, addMoteAt, addShade, World, Vec3 } from './world';
import * as C from './config';

export const BENCH_SHADES = 200;
export const BENCH_MOTES = 100;
export const BENCH_ISLAND_R = 38;

export function createBenchWorld(seed = 42): World {
  const w = createWorld(seed, 1);
  w.mode = { noSpawn: true, noDamage: true, noPickup: true, noFuelDecay: true, noEnd: true };
  w.randomMotes = false;
  w.randomShades = false;
  w.motes = [];
  w.shades = [];
  w.nextMoteId = 1;
  w.nextShadeId = 1;
  // rải đều theo diện tích trên đảo (r ≤ 38 m), theo seed
  const point = (): Vec3 => {
    const a = w.rng.range(0, Math.PI * 2);
    const r = Math.sqrt(w.rng.next()) * BENCH_ISLAND_R;
    return [Math.cos(a) * r, 0, Math.sin(a) * r];
  };
  for (let i = 0; i < BENCH_SHADES; i++) {
    const p = point();
    addShade(w, [p[0], C.SHADE_HOVER, p[2]], undefined, 'wander');
  }
  for (let i = 0; i < BENCH_MOTES; i++) addMoteAt(w, point(), 'random');
  for (const l of w.lanterns.slice(0, 3)) {
    l.lit = true;
    l.everLit = true;
    l.fuelU = C.FUEL_MAX_U;
    l.deposited = C.CAPACITY_BASE;
  }
  w.player.pos = [0, 0, 0];
  return w;
}
