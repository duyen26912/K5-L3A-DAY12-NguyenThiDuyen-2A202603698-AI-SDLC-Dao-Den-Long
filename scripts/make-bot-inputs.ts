// Bot đơn giản chơi một Đêm trên chính core, ghi lại file inputs theo Test Contract (v1.1).
// Dùng để tạo bằng chứng "chơi được từ đầu tới thắng". Đêm 2: đi vòng qua cầu tre.
// Chạy: npx tsx scripts/make-bot-inputs.ts <night> <seed> <file-out>
import { writeFileSync } from 'node:fs';
import { createWorld, step, InputState, World, Vec3, capacity } from '../src/core/world';
import { TUNING } from '../src/core/config';

const night = Number(process.argv[2] ?? 1);
const seed = Number(process.argv[3] ?? 2026);
const outFile = process.argv[4] ?? `tests/scenarios/bot-win-n${night}-seed${seed}.inputs.json`;
const w: World = createWorld(seed, night);
const frames: Record<string, unknown>[] = [];
let prev: InputState | null = null;
let toggle = false;

const d = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const side = (x: number) => (x < 35 ? 'A' : 'B'); // Đêm 2: đảo A (x < 35) hay đảo B

/** Điểm đi tới kế tiếp; Đêm 2 khác đảo thì đi qua đầu cầu. */
function waypoint(from: Vec3, to: Vec3): Vec3 {
  if (night !== 2 || side(from[0]) === side(to[0])) return to;
  const onBridge = from[0] >= 25 && from[0] <= 45 && Math.abs(from[2]) <= 1.5;
  if (side(from[0]) === 'A') return onBridge ? [46, 0, 0] : [24, 0, 0];
  return onBridge ? [24, 0, 0] : [46, 0, 0];
}

function decide(): InputState {
  const p = w.player;
  const inp: InputState = { move: [0, 0], camYawDeg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  // Ticket-03: ưu tiên châm dầu đèn sắp cạn, sau đó thắp đèn chưa sáng
  const litN = w.lanterns.filter((l) => l.lit).length;
  const need3 = Math.ceil(0.6 * w.lanterns.length);
  const timeLeftS = w.startTimeLeft - w.simTick / 60;
  // đèn sẽ tắt trước bình minh thì cần châm; ngưỡng gấp: < 25 dầu
  const low = w.lanterns.filter((l) => l.lit && l.fuelU / 60 < Math.min(25, timeLeftS + 5));
  const unlit = w.lanterns.filter((l) => !l.lit).sort((a, b) => Number(b.everLit) - Number(a.everLit));
  const pool = low.length > 0 ? low : litN < need3 + 1 && unlit.length > 0 ? unlit : w.lanterns.filter((l) => l.lit && l.fuelU / 60 < timeLeftS);
  const target = [...(pool.length ? pool : w.lanterns)].sort((a, b) => d(p.pos, a.pos) - d(p.pos, b.pos))[0];
  const need = target.lit ? Math.ceil((6000 - target.fuelU) / 600) : (target.everLit ? TUNING.relight_cost : TUNING.lantern_cost) - target.deposited;
  let goal: Vec3;
  if (p.carried >= Math.min(need, capacity(w)) || (w.motes.length === 0 && p.carried > 0) || (target.lit && p.carried >= 3)) {
    goal = target.pos;
    if (d(p.pos, target.pos) <= TUNING.interact_radius - 0.3) { toggle = !toggle; inp.interact = toggle; }
  } else {
    // ưu tiên đom đóm cùng đảo
    const motes = [...w.motes].sort((a, b) => d(p.pos, a.pos) - d(p.pos, b.pos));
    goal = (motes.find((m) => night !== 2 || side(m.pos[0]) === side(p.pos[0])) ?? motes[0] ?? target).pos;
  }
  const active = w.shades.filter((s) => s.state === 'chase' || s.state === 'wander');
  const nearest = Math.min(Infinity, ...active.map((s) => d(p.pos, s.pos)));
  if (nearest < 4.2 && p.carried >= TUNING.pulse_cost && p.pulseCd === 0) inp.pulse = true;
  const wp = waypoint(p.pos, goal);
  let vx = wp[0] - p.pos[0];
  let vz = wp[2] - p.pos[2];
  let len = Math.hypot(vx, vz);
  if (len > 1e-6) { vx /= len; vz /= len; }
  // né Bóng Mực: đẩy ra xa những con trong 7 m (trừ khi đang đứng trong vùng an toàn)
  const safe = w.lanterns.some((l) => l.lit && d(p.pos, l.pos) < TUNING.safe_radius - 0.5);
  if (!safe) {
    for (const s of active) {
      const ds = d(p.pos, s.pos);
      if (ds < 7 && ds > 1e-6) {
        const k = ((7 - ds) / 7) * 2.2;
        vx += ((p.pos[0] - s.pos[0]) / ds) * k;
        vz += ((p.pos[2] - s.pos[2]) / ds) * k;
      }
    }
  }
  if (nearest < 2.2 && p.dashCd === 0 && !inp.pulse) inp.dash = true;
  len = Math.hypot(vx, vz);
  if (len > 0.05) inp.move = [Math.round((vx / len) * 1000) / 1000, Math.round((vz / len) * 1000) / 1000];
  // Đêm 2 đang trên cầu: giữ trên cầu
  if (night === 2 && p.pos[0] > 25 && p.pos[0] < 45) inp.move = [Math.sign(wp[0] - p.pos[0]) || 1, Math.max(-1, Math.min(1, -p.pos[2]))];
  return inp;
}

for (let k = 0; k < 21600 && w.state === 'playing'; k++) {
  const inp = decide();
  const f: Record<string, unknown> = { tick: k };
  if (!prev || prev.move[0] !== inp.move[0] || prev.move[1] !== inp.move[1]) f.move = inp.move;
  if (!prev || prev.interact !== inp.interact) f.interact = inp.interact;
  if (!prev || prev.pulse !== inp.pulse) f.pulse = inp.pulse;
  if (!prev || prev.dash !== inp.dash) f.dash = inp.dash;
  if (Object.keys(f).length > 1) frames.push(f);
  prev = inp;
  step(w, inp);
}
writeFileSync(outFile, JSON.stringify({ frames }) + '\n');
console.log(JSON.stringify({ night, seed, state: w.state, reason: w.reason, ticks: w.tick, score: w.score, flames: w.player.flames, frames: frames.length }));
