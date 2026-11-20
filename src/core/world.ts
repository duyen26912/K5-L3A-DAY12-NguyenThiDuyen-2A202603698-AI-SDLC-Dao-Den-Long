// Logic game thuần: không import gì về đồ họa. Dùng chung cho game có giao diện và headless.
import {
  TUNING, DT, TICK_RATE, ISLAND_RADIUS, LANTERN_RING_RADIUS, JUMP_SPEED, GRAVITY,
  SHADE_HEIGHT, INITIAL_MOTES, MAX_MOTES, MOTE_SPAWN_EVERY_TICKS, MOTE_MIN_R, MOTE_MAX_R,
  INITIAL_SHADES, MAX_SHADES, SHADE_SPAWN_EVERY_TICKS, SHADE_SPAWN_R, DROP_DISTANCE,
} from './config';
import { Rng } from './rng';

export type Vec3 = [number, number, number];
export type GameState = 'playing' | 'won' | 'lost';
export type ShadeState = 'chase' | 'stunned';

export interface Mote { id: string; pos: Vec3 }
export interface Lantern { id: string; pos: Vec3; lit: boolean; deposited: number }
export interface Shade { id: string; pos: Vec3; state: ShadeState; stunTicks: number }
export interface Player {
  pos: Vec3; vy: number; flames: number; carried: number;
  invulnTicks: number; pulseCooldownTicks: number;
}
export interface GameEvent { name: string; data: Record<string, unknown> }

/** Trạng thái nút/cần điều khiển đang giữ ở một tick. */
export interface InputState {
  move: [number, number];
  camYawDeg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
}

export const neutralInput = (): InputState => ({
  move: [0, 0], camYawDeg: 0, jump: false, interact: false, pulse: false, dash: false,
});

export interface World {
  rng: Rng;
  night: number;
  steps: number;
  startTimeLeft: number;
  state: GameState;
  reason: string | null;
  score: number;
  player: Player;
  lanterns: Lantern[];
  motes: Mote[];
  shades: Shade[];
  randomMotes: boolean;
  randomShades: boolean;
  nextMoteId: number;
  nextShadeId: number;
  prevInput: InputState;
}

export const timeLeft = (w: World): number => w.startTimeLeft - w.steps / TICK_RATE;

const distXZ = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[2] - b[2]);

function clampToIsland(p: Vec3, margin = 0): void {
  const r = Math.hypot(p[0], p[2]);
  const max = ISLAND_RADIUS - margin;
  if (r > max) {
    p[0] = (p[0] / r) * max;
    p[2] = (p[2] / r) * max;
  }
}

function randomPointOnIsland(rng: Rng, minR: number, maxR: number): Vec3 {
  const a = rng.range(0, Math.PI * 2);
  // phân bố đều theo diện tích
  const r = Math.sqrt(rng.range(minR * minR, maxR * maxR));
  return [Math.sin(a) * r, 0, Math.cos(a) * r];
}

export function lanternLayout(count: number): Lantern[] {
  const out: Lantern[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    out.push({
      id: `L${i + 1}`,
      pos: [Math.sin(a) * LANTERN_RING_RADIUS, 0, Math.cos(a) * LANTERN_RING_RADIUS],
      lit: false,
      deposited: 0,
    });
  }
  return out;
}

/** Dựng thế giới Đêm 1 theo seed. RNG luôn được tiêu thụ giống nhau, kể cả khi scenario thay danh sách. */
export function createWorld(seed: number, night = 1): World {
  const rng = new Rng(seed);
  const w: World = {
    rng, night, steps: 0,
    startTimeLeft: TUNING.night1_duration_s,
    state: 'playing', reason: null, score: 0,
    player: {
      pos: [0, 0, 0], vy: 0, flames: TUNING.flames, carried: 0,
      invulnTicks: 0, pulseCooldownTicks: 0,
    },
    lanterns: lanternLayout(TUNING.lantern_count_night1),
    motes: [], shades: [],
    randomMotes: true, randomShades: true,
    nextMoteId: 1, nextShadeId: 1,
    prevInput: neutralInput(),
  };
  for (let i = 0; i < INITIAL_MOTES; i++) addMote(w, randomPointOnIsland(rng, MOTE_MIN_R, MOTE_MAX_R));
  for (let i = 0; i < INITIAL_SHADES; i++) addShade(w, randomShadePos(rng));
  return w;
}

function randomShadePos(rng: Rng): Vec3 {
  const a = rng.range(0, Math.PI * 2);
  return [Math.sin(a) * SHADE_SPAWN_R, SHADE_HEIGHT, Math.cos(a) * SHADE_SPAWN_R];
}

export function addMote(w: World, pos: Vec3, id?: string): Mote {
  const m: Mote = { id: id ?? `M${w.nextMoteId++}`, pos: [pos[0], 0, pos[2]] };
  w.motes.push(m);
  return m;
}

export function addShade(w: World, pos: Vec3, id?: string): Shade {
  const s: Shade = { id: id ?? `S${w.nextShadeId++}`, pos: [pos[0], pos[1], pos[2]], state: 'chase', stunTicks: 0 };
  w.shades.push(s);
  return s;
}

function finish(w: World, result: 'won' | 'lost', reason: string, events: GameEvent[]): void {
  if (result === 'won') {
    w.score += TUNING.score.per_second_left * Math.max(0, Math.floor(timeLeft(w)))
      + TUNING.score.per_flame_left * w.player.flames;
  }
  w.state = result;
  w.reason = reason;
  events.push({ name: 'game_over', data: { result, reason } });
}

/**
 * Một bước mô phỏng (1/60 giây): đọc input của tick k, tạo trạng thái k+1.
 * Trả về các sự kiện xảy ra trong bước này (được ghi với tick = k+1).
 */
export function step(w: World, input: InputState): GameEvent[] {
  const events: GameEvent[] = [];
  if (w.state !== 'playing') return events;
  const prev = w.prevInput;
  w.prevInput = { ...input, move: [input.move[0], input.move[1]] };
  const pressed = (k: 'jump' | 'interact' | 'pulse') => input[k] && !prev[k];
  const p = w.player;

  // 1. Di chuyển theo hướng camera: x' = x·cosθ + z·sinθ, z' = −x·sinθ + z·cosθ
  let [mx, mz] = input.move;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const th = (input.camYawDeg * Math.PI) / 180;
  const dx = mx * Math.cos(th) + mz * Math.sin(th);
  const dz = -mx * Math.sin(th) + mz * Math.cos(th);
  p.pos[0] += dx * TUNING.player_speed * DT;
  p.pos[2] += dz * TUNING.player_speed * DT;
  clampToIsland(p.pos);

  // 2. Nhảy
  const onGround = p.pos[1] <= 0 && p.vy <= 0;
  if (pressed('jump') && onGround) p.vy = JUMP_SPEED;
  if (!onGround || p.vy > 0) {
    p.vy -= GRAVITY * DT;
    p.pos[1] += p.vy * DT;
    if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; }
  }

  // 3. Nhặt đom đóm (tự động khi trong pickup_radius và còn chỗ chứa)
  for (let i = 0; i < w.motes.length && p.carried < TUNING.carry_capacity; ) {
    if (distXZ(p.pos, w.motes[i].pos) <= TUNING.pickup_radius) {
      w.motes.splice(i, 1);
      p.carried += 1;
      w.score += TUNING.score.per_mote;
      events.push({ name: 'mote_picked', data: { carried: p.carried } });
    } else i++;
  }

  // 4. Nạp ánh sáng vào đèn gần nhất chưa thắp (trong interact_radius)
  if (pressed('interact') && p.carried > 0) {
    let best: Lantern | null = null;
    let bestD = Infinity;
    for (const l of w.lanterns) {
      if (l.lit) continue;
      const d = distXZ(p.pos, l.pos);
      if (d <= TUNING.interact_radius && d < bestD) { best = l; bestD = d; }
    }
    if (best) {
      const amount = Math.min(p.carried, TUNING.lantern_cost - best.deposited);
      if (amount > 0) {
        best.deposited += amount;
        p.carried -= amount;
        events.push({ name: 'deposit', data: { lantern_id: best.id, amount, deposited: best.deposited } });
        if (best.deposited >= TUNING.lantern_cost) {
          best.lit = true;
          w.score += TUNING.score.per_lantern;
          events.push({ name: 'lantern_lit', data: { lantern_id: best.id } });
          if (w.lanterns.every((l) => l.lit)) {
            w.steps += 1;
            finish(w, 'won', 'all_lit', events);
            return events;
          }
        }
      }
    }
  }

  // 5. Tỏa sáng: tốn pulse_cost đom đóm đang mang, có hồi chiêu
  if (p.pulseCooldownTicks > 0) p.pulseCooldownTicks -= 1;
  const justStunned = new Set<Shade>();
  if (pressed('pulse') && p.pulseCooldownTicks === 0 && p.carried >= TUNING.pulse_cost) {
    p.carried -= TUNING.pulse_cost;
    p.pulseCooldownTicks = Math.round(TUNING.pulse_cooldown_s * TICK_RATE);
    const stunned: string[] = [];
    for (const s of w.shades) {
      const d = distXZ(p.pos, s.pos);
      if (d <= TUNING.pulse_radius) {
        stunned.push(s.id);
        justStunned.add(s);
        s.state = 'stunned';
        s.stunTicks = Math.round(TUNING.pulse_stun_s * TICK_RATE);
        let ux = s.pos[0] - p.pos[0];
        let uz = s.pos[2] - p.pos[2];
        const ul = Math.hypot(ux, uz);
        if (ul < 1e-9) { ux = 1; uz = 0; } else { ux /= ul; uz /= ul; }
        s.pos[0] += ux * TUNING.pulse_push_m;
        s.pos[2] += uz * TUNING.pulse_push_m;
        clampToIsland(s.pos);
      }
    }
    w.score += TUNING.score.per_stun * stunned.length;
    events.push({ name: 'pulse', data: { stunned_ids: stunned } });
  }

  // 6. Bóng Mực: đuổi theo người chơi, không vào được vùng an toàn quanh đèn đã thắp
  for (const s of w.shades) {
    if (s.state === 'stunned') {
      if (justStunned.has(s)) continue;
      s.stunTicks -= 1;
      if (s.stunTicks <= 0) { s.state = 'chase'; s.stunTicks = 0; }
      continue;
    }
    const vx = p.pos[0] - s.pos[0];
    const vz = p.pos[2] - s.pos[2];
    const d = Math.hypot(vx, vz);
    const stepLen = Math.min(d, TUNING.shade_speed * DT);
    if (d > 1e-9) {
      s.pos[0] += (vx / d) * stepLen;
      s.pos[2] += (vz / d) * stepLen;
    }
    for (const l of w.lanterns) {
      if (!l.lit) continue;
      let ox = s.pos[0] - l.pos[0];
      let oz = s.pos[2] - l.pos[2];
      const od = Math.hypot(ox, oz);
      if (od < TUNING.safe_radius) {
        if (od < 1e-9) { ox = 1; oz = 0; } else { ox /= od; oz /= od; }
        s.pos[0] = l.pos[0] + ox * TUNING.safe_radius;
        s.pos[2] = l.pos[2] + oz * TUNING.safe_radius;
      }
    }
    clampToIsland(s.pos);
  }

  // 7. Bị Bóng Mực chạm: mất 1 flame, rơi một phần đom đóm, bất tử invuln_s giây
  if (p.invulnTicks === 0) {
    const hitter = w.shades.find((s) => s.state !== 'stunned' && distXZ(p.pos, s.pos) <= TUNING.shade_hit_radius);
    if (hitter) {
      p.flames -= 1;
      const dropped = Math.floor(p.carried * TUNING.hit_drop_ratio);
      p.carried -= dropped;
      for (let i = 0; i < dropped; i++) {
        const a = (i / dropped) * Math.PI * 2;
        const pos: Vec3 = [p.pos[0] + Math.sin(a) * DROP_DISTANCE, 0, p.pos[2] + Math.cos(a) * DROP_DISTANCE];
        clampToIsland(pos, 0.5);
        addMote(w, pos);
      }
      p.invulnTicks = Math.round(TUNING.invuln_s * TICK_RATE);
      events.push({ name: 'player_hit', data: { by: 'shade', flames: p.flames, dropped } });
      if (p.flames <= 0) {
        w.steps += 1;
        finish(w, 'lost', 'no_flames', events);
        return events;
      }
    }
  } else {
    p.invulnTicks -= 1;
  }

  // 8. Sinh thêm đom đóm / Bóng Mực (chỉ khi bật ngẫu nhiên)
  w.steps += 1;
  if (w.randomMotes && w.steps % MOTE_SPAWN_EVERY_TICKS === 0 && w.motes.length < MAX_MOTES) {
    addMote(w, randomPointOnIsland(w.rng, MOTE_MIN_R, MOTE_MAX_R));
  }
  if (w.randomShades && w.steps % SHADE_SPAWN_EVERY_TICKS === 0 && w.shades.length < MAX_SHADES) {
    const s = addShade(w, randomShadePos(w.rng));
    events.push({ name: 'shade_spawned', data: { id: s.id } });
  }

  // 9. Kết thúc
  if (w.lanterns.every((l) => l.lit)) finish(w, 'won', 'all_lit', events);
  else if (timeLeft(w) <= 1e-9) finish(w, 'lost', 'dawn', events);
  return events;
}
