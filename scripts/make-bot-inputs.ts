// Bot đơn giản chơi Đêm 1 trên chính core, ghi lại file inputs theo định dạng Test Contract.
// Dùng để tạo scenario "chơi trọn đêm" làm bằng chứng game chơi được từ đầu tới thắng.
// Chạy: npx tsx scripts/make-bot-inputs.ts <seed> <file-out>
import { writeFileSync } from 'node:fs';
import { createWorld, step, InputState, World, Vec3 } from '../src/core/world';
import { TUNING } from '../src/core/config';

const seed = Number(process.argv[2] ?? 2026);
const outFile = process.argv[3] ?? 'tests/scenarios/bot-win.inputs.json';
const w: World = createWorld(seed, 1);
const frames: Record<string, unknown>[] = [];
let prev: InputState | null = null;
let toggle = false;

const d = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

function decide(): InputState {
  const p = w.player;
  const inp: InputState = { move: [0, 0], camYawDeg: 0, jump: false, interact: false, pulse: false, dash: false };
  const unlit = w.lanterns.filter((l) => !l.lit);
  const target = unlit.sort((a, b) => d(p.pos, a.pos) - d(p.pos, b.pos))[0];
  const need = TUNING.lantern_cost - target.deposited;
  let goal: Vec3;
  if (p.carried >= Math.min(need + 1, TUNING.carry_capacity) || (w.motes.length === 0 && p.carried > 0)) {
    goal = target.pos;
    if (d(p.pos, target.pos) <= TUNING.interact_radius - 0.5) { toggle = !toggle; inp.interact = toggle; }
  } else {
    goal = [...w.motes].sort((a, b) => d(p.pos, a.pos) - d(p.pos, b.pos))[0]?.pos ?? target.pos;
  }
  const near = w.shades.find((s) => s.state === 'chase' && d(p.pos, s.pos) < TUNING.pulse_radius - 1.5);
  if (near && p.carried > 1 && p.pulseCooldownTicks === 0) inp.pulse = true;
  const vx = goal[0] - p.pos[0];
  const vz = goal[2] - p.pos[2];
  const len = Math.hypot(vx, vz);
  if (len > 0.05) inp.move = [Math.round((vx / len) * 1000) / 1000, Math.round((vz / len) * 1000) / 1000];
  return inp;
}

for (let k = 0; k < TUNING.night1_duration_s * 60 && w.state === 'playing'; k++) {
  const inp = decide();
  const f: Record<string, unknown> = { tick: k };
  if (!prev || prev.move[0] !== inp.move[0] || prev.move[1] !== inp.move[1]) f.move = inp.move;
  if (!prev || prev.interact !== inp.interact) f.interact = inp.interact;
  if (!prev || prev.pulse !== inp.pulse) f.pulse = inp.pulse;
  if (Object.keys(f).length > 1) frames.push(f);
  prev = inp;
  step(w, inp);
}
writeFileSync(outFile, JSON.stringify({ frames }) + '\n');
console.log(JSON.stringify({ seed, state: w.state, reason: w.reason, ticks: w.steps, score: w.score, flames: w.player.flames, frames: frames.length }));
