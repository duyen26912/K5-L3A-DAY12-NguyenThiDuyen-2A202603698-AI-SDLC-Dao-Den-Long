// Soak test (Ticket-04 mục 2): <soak_cmd> --seed 7 --nights 10 --out soak.json
// 10 Đêm liên tiếp trong cùng tiến trình (Đêm 1 → 2 → 3 xoay vòng), Đêm thứ i dùng seed + i,
// input ngẫu nhiên theo seed: mỗi 30 tick đổi hướng; mỗi tick 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác.
import { writeFileSync } from 'node:fs';
import { createWorld, step, InputState, World } from './core/world';
import { Rng } from './core/rng';
import { TICK_RATE } from './core/config';

function arg(name: string, def?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] !== undefined) return process.argv[i + 1];
  if (def === undefined) throw new Error(`thiếu --${name}`);
  return def;
}
const rssMb = () => Math.round((process.memoryUsage().rss / 1048576) * 10) / 10;
const gc = (globalThis as { gc?: () => void }).gc;
const collect = () => { if (gc) { gc(); gc(); } };

/** Chạy một Đêm với input ngẫu nhiên theo seed; trả về kết quả. */
export function runNight(w: World, seed: number): string {
  const rng = new Rng((seed * 2654435761) >>> 0);
  let move: [number, number] = [0, 0];
  const maxTicks = Math.ceil(w.startTimeLeft * TICK_RATE) + 10;
  for (let k = 0; k < maxTicks && w.state === 'playing'; k++) {
    if (k % 30 === 0) {
      const a = rng.range(0, Math.PI * 2);
      move = [Math.round(Math.cos(a) * 1000) / 1000, Math.round(Math.sin(a) * 1000) / 1000];
    }
    const inp: InputState = {
      move, camYawDeg: 0,
      jump: rng.next() < 0.05, dash: rng.next() < 0.03, pulse: rng.next() < 0.02, interact: rng.next() < 0.1,
      pause: false,
    };
    step(w, inp);
  }
  return w.state === 'playing' ? 'lost' : w.state;
}

function main(): number {
  try {
    const seed = Number(arg('seed'));
    const nights = Number(arg('nights', '10'));
    const out = arg('out');
    if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) throw new Error('--seed và --nights phải là số nguyên, nights ≥ 1');
    const t0 = performance.now();
    const results: string[] = [];
    let crashes = 0;
    let memStart = 0;
    for (let i = 0; i < nights; i++) {
      const night = (i % 3) + 1;
      let w: World | null = createWorld(seed + i, night);
      if (i === 0) { collect(); memStart = rssMb(); } // RSS sau khi tải xong Đêm đầu tiên
      try {
        results.push(runNight(w, seed + i));
      } catch (e) {
        crashes++;
        results.push('crash');
        process.stderr.write(`Đêm ${i + 1} lỗi: ${(e as Error).message}\n`);
      }
      w = null; // reset: bỏ thế giới cũ
    }
    collect();
    const memEnd = rssMb(); // RSS sau khi reset xong Đêm cuối
    const res = {
      nights, crashes, results, mem_start_mb: memStart, mem_end_mb: memEnd,
      duration_s: Math.round((performance.now() - t0) / 100) / 10,
    };
    writeFileSync(out, JSON.stringify(res, null, 2) + '\n');
    process.stdout.write(JSON.stringify(res) + '\n');
    return crashes === 0 ? 0 : 1;
  } catch (e) {
    process.stderr.write(`soak error: ${(e as Error).message}\n`);
    return 1;
  }
}

if (process.argv[1] && /soak\.(m?js|ts)$/.test(process.argv[1])) process.exitCode = main();
