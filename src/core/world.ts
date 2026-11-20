// Logic game thuần (Ticket-02 / Test Contract v1.1): không import gì về đồ họa.
// Dùng chung cho game có giao diện và headless. Thứ tự một tick theo đúng Ticket-02.
import * as C from './config';
import { TUNING, DT, sec } from './config';
import { MAPS, NightMap, Vec3 } from './maps';
import { Rng } from './rng';

export type { Vec3 } from './maps';
export type GameState = 'playing' | 'won' | 'lost';
export type ShadeState = 'spawning' | 'wander' | 'chase' | 'recoil' | 'stunned';
export type DrifterState = 'idle' | 'chase' | 'flee' | 'removed';

export interface Mote { id: string; pos: Vec3; kind: 'random' | 'dropped'; ttl: number | null; point: number | null; bornTick: number }
export interface Lantern { id: string; pos: Vec3; lit: boolean; deposited: number }
export interface Shade {
  id: string; pos: Vec3; state: ShadeState; stateTicks: number;
  pushDir: [number, number]; pushTicks: number; recoilDir: [number, number];
  evictTicks: number; wanderTarget: Vec3 | null; wanderTicks: number; bornTick: number;
}
export interface Drifter { id: string; pos: Vec3; state: DrifterState; stolen: number; usedSteal: boolean; fleeTicks: number; heading: number; bornTick: number }
export interface Charm { id: string; pos: Vec3; available: boolean; respawnTicks: number }
export interface Player {
  pos: Vec3; vel: Vec3; grounded: boolean; facing: [number, number];
  flames: number; carried: number; invulnTicks: number;
  dashTicks: number; dashCd: number; dashDir: [number, number];
  pulseCd: number; charmTicks: number; launch: [number, number] | null; respawnTicks: number;
}
export interface GameEvent { name: string; data: Record<string, unknown> }

export interface InputState {
  move: [number, number];
  camYawDeg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}
export const neutralInput = (): InputState => ({
  move: [0, 0], camYawDeg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false,
});

export interface World {
  rng: Rng;
  map: NightMap;
  night: number;
  tick: number;
  simTick: number;
  paused: boolean;
  startTimeLeft: number;
  state: GameState;
  reason: string | null;
  score: number;
  player: Player;
  lanterns: Lantern[];
  motes: Mote[];
  shades: Shade[];
  drifters: Drifter[];
  charms: Charm[];
  randomMotes: boolean;
  randomShades: boolean;
  randomDrifters: boolean;
  windEnabled: boolean;
  wind: { active: boolean; dirDeg: number; ticksLeft: number; warn: boolean };
  nextMoteId: number;
  nextShadeId: number;
  nextDrifterId: number;
  prevInput: InputState;
}

export const timeLeft = (w: World): number => w.startTimeLeft - w.simTick / C.TICK_RATE;
const distXZ = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const awayXZ = (from: Vec3, to: Vec3): [number, number] => {
  const x = to[0] - from[0];
  const z = to[2] - from[2];
  const l = Math.hypot(x, z);
  return l < 1e-9 ? [1, 0] : [x / l, z / l];
};
const groundOr = (w: World, x: number, z: number, fallback: number) => w.map.ground(x, z) ?? fallback;

export function createWorld(seed: number, night = 1): World {
  const map = MAPS[night];
  if (!map) throw new Error(`night không hợp lệ: ${night}`);
  const w: World = {
    rng: new Rng(seed), map, night, tick: 0, simTick: 0, paused: false,
    startTimeLeft: map.durationS, state: 'playing', reason: null, score: 0,
    player: {
      pos: [...map.start] as Vec3, vel: [0, 0, 0], grounded: true, facing: [...map.startFacing] as [number, number],
      flames: TUNING.flames, carried: 0, invulnTicks: 0, dashTicks: 0, dashCd: 0, dashDir: [0, 1],
      pulseCd: 0, charmTicks: 0, launch: null, respawnTicks: 0,
    },
    lanterns: map.lanterns.map((l) => ({ id: l.id, pos: [...l.pos] as Vec3, lit: false, deposited: 0 })),
    motes: [], shades: [], drifters: [],
    charms: map.charms.map((p, i) => ({ id: `C${i + 1}`, pos: [...p] as Vec3, available: true, respawnTicks: 0 })),
    randomMotes: true, randomShades: true, randomDrifters: map.drifters, windEnabled: map.wind,
    wind: { active: false, dirDeg: 0, ticksLeft: 0, warn: false },
    nextMoteId: 1, nextShadeId: 1, nextDrifterId: 1,
    prevInput: neutralInput(),
  };
  // 20 đom đóm ban đầu tại 20 điểm khác nhau (chọn theo seed)
  const idx = map.motePoints.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(w.rng.next() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  for (const i of idx.slice(0, C.MOTES_START).sort((a, b) => a - b)) addRandomMote(w, i);
  return w;
}

export function addRandomMote(w: World, point: number): Mote {
  const m: Mote = { id: `M${w.nextMoteId++}`, pos: [...w.map.motePoints[point]] as Vec3, kind: 'random', ttl: null, point, bornTick: w.simTick };
  w.motes.push(m);
  return m;
}
export function addMoteAt(w: World, pos: Vec3, kind: 'random' | 'dropped', id?: string): Mote {
  const m: Mote = { id: id ?? `M${w.nextMoteId++}`, pos: [...pos] as Vec3, kind, ttl: kind === 'dropped' ? C.DROPPED_TTL : null, point: null, bornTick: w.simTick };
  w.motes.push(m);
  return m;
}
export function addShade(w: World, pos: Vec3, id?: string, state: ShadeState = 'wander', stateTicks = 0): Shade {
  const s: Shade = {
    id: id ?? `S${w.nextShadeId++}`, pos: [...pos] as Vec3, state, stateTicks,
    pushDir: [1, 0], pushTicks: state === 'stunned' ? Math.max(0, stateTicks - (sec(TUNING.pulse_stun_s) - C.PULSE_PUSH_TICKS)) : 0,
    recoilDir: [1, 0], evictTicks: 0, wanderTarget: null, wanderTicks: 0, bornTick: w.simTick,
  };
  w.shades.push(s);
  return s;
}
export function addDrifter(w: World, pos: Vec3, id?: string, state: DrifterState = 'idle', stolen = 0): Drifter {
  const d: Drifter = {
    id: id ?? `D${w.nextDrifterId++}`, pos: [...pos] as Vec3, state, stolen,
    usedSteal: state === 'flee' || stolen > 0, fleeTicks: state === 'flee' ? C.DRIFTER_FLEE_TICKS : 0, heading: 0, bornTick: w.simTick,
  };
  w.drifters.push(d);
  return d;
}

function finish(w: World, result: 'won' | 'lost', reason: string, events: GameEvent[]) {
  if (result === 'won') {
    w.score += TUNING.score.per_second_left * Math.max(0, Math.floor(timeLeft(w) + 1e-9)) + TUNING.score.per_flame_left * w.player.flames;
  }
  w.state = result;
  w.reason = reason;
  events.push({ name: 'game_over', data: { result, reason } });
}

/** Một tick: đọc input tick k → trạng thái k+1. Trả về sự kiện của tick này. */
export function step(w: World, input: InputState): GameEvent[] {
  const ev: GameEvent[] = [];
  if (w.state !== 'playing') return ev;
  const prev = w.prevInput;
  w.prevInput = { ...input, move: [input.move[0], input.move[1]] };
  const pressed = (k: 'jump' | 'interact' | 'pulse' | 'dash' | 'pause') => input[k] && !prev[k];
  w.tick += 1;

  // 1. Pause
  if (pressed('pause')) {
    w.paused = !w.paused;
    ev.push({ name: w.paused ? 'paused' : 'resumed', data: {} });
  }
  if (w.paused) return ev;

  // 2. Bộ đếm
  w.simTick += 1;
  const p = w.player;
  if (p.dashCd > 0) p.dashCd--;
  if (p.pulseCd > 0) p.pulseCd--;
  if (p.invulnTicks > 0) p.invulnTicks--;
  if (p.charmTicks > 0) p.charmTicks--;
  for (const s of w.shades) {
    if ((s.state === 'stunned' || s.state === 'recoil') && s.stateTicks > 0) s.stateTicks--;
  }
  for (const m of w.motes) if (m.ttl !== null) m.ttl--;
  w.motes = w.motes.filter((m) => m.ttl === null || m.ttl > 0);
  for (const c of w.charms) {
    if (!c.available && c.respawnTicks > 0 && --c.respawnTicks === 0) c.available = true;
  }
  if (w.wind.active && --w.wind.ticksLeft <= 0) w.wind.active = false;
  for (const d of w.drifters) {
    if (d.state === 'flee' && --d.fleeTicks <= 0) d.state = 'removed';
  }

  // 3. Di chuyển Mây
  movePlayer(w, input, pressed('jump'), pressed('dash'), ev);

  // 4. Nhặt đom đóm và bùa
  if (p.respawnTicks === 0) {
    for (let i = 0; i < w.motes.length && p.carried < TUNING.carry_capacity; ) {
      const m = w.motes[i];
      if (m.bornTick < w.simTick && distXZ(p.pos, m.pos) <= TUNING.pickup_radius && Math.abs(p.pos[1] - m.pos[1]) <= C.PICKUP_HEIGHT) {
        w.motes.splice(i, 1);
        p.carried++;
        ev.push({ name: 'mote_picked', data: { carried: p.carried } });
      } else i++;
    }
    for (const c of w.charms) {
      if (c.available && distXZ(p.pos, c.pos) <= TUNING.pickup_radius && Math.abs(p.pos[1] - c.pos[1]) <= C.PICKUP_HEIGHT) {
        c.available = false;
        c.respawnTicks = C.CHARM_RESPAWN;
        p.charmTicks = C.CHARM_TICKS;
        ev.push({ name: 'charm_picked', data: { charm_id: c.id, charm_ticks: C.CHARM_TICKS } });
      }
    }
  }

  // 5. Tương tác với đèn
  if (pressed('interact') && p.respawnTicks === 0 && p.carried > 0) {
    let best: Lantern | null = null;
    let bestD = Infinity;
    for (const l of w.lanterns) {
      if (l.lit || Math.abs(p.pos[1] - l.pos[1]) > C.LANTERN_HEIGHT_TOL) continue;
      const d = distXZ(p.pos, l.pos);
      if (d <= TUNING.interact_radius && d < bestD - 1e-12) { best = l; bestD = d; }
    }
    if (best) {
      const amount = Math.min(p.carried, TUNING.lantern_cost - best.deposited);
      best.deposited += amount;
      p.carried -= amount;
      w.score += TUNING.score.per_mote * amount;
      ev.push({ name: 'deposit', data: { lantern_id: best.id, amount, deposited: best.deposited } });
      if (best.deposited >= TUNING.lantern_cost) {
        best.lit = true;
        w.score += TUNING.score.per_lantern;
        ev.push({ name: 'lantern_lit', data: { lantern_id: best.id } });
      }
    }
  }

  // 6. Vùng an toàn: Bóng Mực đang ở trong vùng của đèn đã sáng → bị đẩy ra trong tối đa 30 tick
  for (const l of w.lanterns) {
    if (!l.lit) continue;
    for (const s of w.shades) {
      if (s.state !== 'spawning' && s.evictTicks === 0 && distXZ(s.pos, l.pos) < TUNING.safe_radius - 1e-9) s.evictTicks = C.EVICT_TICKS;
    }
  }

  // 7. Tỏa Sáng
  if (pressed('pulse') && p.pulseCd === 0 && p.carried >= TUNING.pulse_cost && p.respawnTicks === 0) {
    p.carried -= TUNING.pulse_cost;
    p.pulseCd = sec(TUNING.pulse_cooldown_s);
    const center: Vec3 = [p.pos[0], p.pos[1] + C.PULSE_CENTER_Y, p.pos[2]];
    const stunned: string[] = [];
    for (const s of w.shades) {
      if (s.state === 'spawning' || dist3(center, s.pos) > TUNING.pulse_radius) continue;
      stunned.push(s.id);
      s.state = 'stunned';
      s.stateTicks = sec(TUNING.pulse_stun_s);
      s.pushTicks = C.PULSE_PUSH_TICKS;
      s.pushDir = awayXZ(p.pos, s.pos);
    }
    w.score += TUNING.score.per_stun * stunned.length;
    ev.push({ name: 'pulse', data: { stunned_ids: stunned } });
    for (const d of w.drifters) {
      if (dist3(center, d.pos) > TUNING.pulse_radius) continue;
      if (d.state === 'chase') {
        d.state = 'flee';
        d.usedSteal = true;
        d.fleeTicks = C.DRIFTER_FLEE_TICKS;
      } else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        for (let i = 0; i < amount; i++) addMoteAt(w, [d.pos[0], groundOr(w, d.pos[0], d.pos[2], 0), d.pos[2]], 'dropped');
        d.stolen = 0;
        d.fleeTicks = C.DRIFTER_DROP_REMOVE_TICKS;
        ev.push({ name: 'drifter_drop', data: { drifter_id: d.id, amount } });
      }
    }
  }

  // 8. Di chuyển Bóng Mực và Gió Lạc
  for (const s of w.shades) moveShade(w, s);
  for (const d of w.drifters) moveDrifter(w, d);

  // 9. Chạm: Gió Lạc cướp trước, rồi Bóng Mực (id tăng dần)
  if (p.respawnTicks === 0) {
    for (const d of w.drifters) {
      if (d.state !== 'chase' || d.usedSteal) continue;
      if (distXZ(p.pos, d.pos) <= C.DRIFTER_TOUCH && Math.abs(d.pos[1] - C.DRIFTER_HOVER - p.pos[1]) <= C.PICKUP_HEIGHT) {
        const amount = Math.min(C.DRIFTER_STEAL_MAX, p.carried);
        p.carried -= amount;
        d.stolen = amount;
        d.usedSteal = true;
        d.state = 'flee';
        d.fleeTicks = C.DRIFTER_FLEE_TICKS;
        ev.push({ name: 'drifter_steal', data: { drifter_id: d.id, amount, carried: p.carried } });
      }
    }
    for (const s of w.shades) {
      if ((s.state !== 'chase' && s.state !== 'wander') || s.evictTicks > 0 || s.bornTick >= w.simTick) continue;
      if (distXZ(p.pos, s.pos) > TUNING.shade_hit_radius || Math.abs(s.pos[1] - p.pos[1]) > C.SHADE_HIT_HEIGHT) continue;
      if (p.invulnTicks > 0) continue; // chạm lúc bất tử: không làm gì
      p.flames -= 1;
      const dropped = Math.floor(p.carried / 2);
      p.carried -= dropped;
      for (let i = 0; i < dropped; i++) {
        const a = w.rng.range(0, Math.PI * 2);
        const r = w.rng.range(C.DROP_RING_MIN, C.DROP_RING_MAX);
        const x = p.pos[0] + Math.cos(a) * r;
        const z = p.pos[2] + Math.sin(a) * r;
        addMoteAt(w, [x, groundOr(w, x, z, p.pos[1]), z], 'dropped');
      }
      p.invulnTicks = C.INVULN_TICKS;
      s.state = 'recoil';
      s.stateTicks = C.RECOIL_TICKS;
      s.recoilDir = awayXZ(p.pos, s.pos);
      ev.push({ name: 'player_hit', data: { by: 'shade', flames: p.flames, dropped } });
    }
  }

  // 10. Sinh theo lịch
  spawnScheduled(w, ev);

  // 11. Thắng / thua
  if (p.flames <= 0) finish(w, 'lost', 'no_flames', ev);
  else if (w.lanterns.every((l) => l.lit)) finish(w, 'won', 'all_lit', ev);
  else if (timeLeft(w) <= 1e-9) finish(w, 'lost', 'dawn', ev);
  return ev;
}

function movePlayer(w: World, input: InputState, jumpPressed: boolean, dashPressed: boolean, ev: GameEvent[]) {
  const p = w.player;
  const map = w.map;
  if (p.respawnTicks > 0) {
    if (--p.respawnTicks === 0) {
      p.pos = [...map.start] as Vec3;
      p.vel = [0, 0, 0];
      p.grounded = true;
      p.launch = null;
      p.dashTicks = 0;
      p.facing = [...map.startFacing] as [number, number];
      p.invulnTicks = C.INVULN_TICKS;
    }
    return;
  }
  // hướng di chuyển theo camera: x' = x·cosθ + z·sinθ, z' = −x·sinθ + z·cosθ
  let [mx, mz] = input.move;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const th = (input.camYawDeg * Math.PI) / 180;
  const dx = mx * Math.cos(th) + mz * Math.sin(th);
  const dz = -mx * Math.sin(th) + mz * Math.cos(th);
  const moving = Math.hypot(dx, dz) > 1e-9;
  if (moving) {
    const l = Math.hypot(dx, dz);
    p.facing = [dx / l, dz / l];
  }

  // Lướt
  if (dashPressed && p.dashTicks === 0 && (p.dashCd === 0 || p.charmTicks > 0)) {
    p.dashTicks = sec(TUNING.dash_duration_s);
    p.dashCd = p.charmTicks > 0 ? 0 : sec(TUNING.dash_cooldown_s);
    p.dashDir = [...p.facing] as [number, number];
    ev.push({ name: 'dash', data: {} });
  }
  const dashing = p.dashTicks > 0;
  if (dashing) p.dashTicks--;

  // Vận tốc
  let vy = p.vel[1];
  if (jumpPressed && p.grounded && !dashing) {
    vy = C.JUMP_SPEED;
    p.grounded = false;
  }
  let vx: number;
  let vz: number;
  if (dashing) {
    vx = p.dashDir[0] * TUNING.dash_speed;
    vz = p.dashDir[1] * TUNING.dash_speed;
    vy = 0; // lướt trên không giữ nguyên độ cao
  } else if (p.launch) {
    [vx, vz] = p.launch; // vận tốc phóng giữ nguyên tới khi chạm đất
  } else {
    const speed = p.charmTicks > 0 ? C.CHARM_SPEED : TUNING.player_speed;
    vx = dx * speed;
    vz = dz * speed;
  }
  if (w.wind.active) {
    const a = (w.wind.dirDeg * Math.PI) / 180;
    vx += Math.cos(a) * C.WIND_SPEED;
    vz += Math.sin(a) * C.WIND_SPEED;
  }
  if (!dashing && !p.grounded) vy -= C.GRAVITY * DT;

  // Ngang: chặn bởi vách (mặt đất cao hơn bậc) và tháp
  const nx = p.pos[0] + vx * DT;
  const nz = p.pos[2] + vz * DT;
  const gTo = map.ground(nx, nz);
  const blocked = map.solid(nx, nz, p.pos[1]) || (gTo !== null && gTo > p.pos[1] + C.STEP_HEIGHT);
  if (!blocked) {
    p.pos[0] = nx;
    p.pos[2] = nz;
  } else {
    vx = 0;
    vz = 0;
  }

  // Dọc
  const g = map.ground(p.pos[0], p.pos[2]);
  if (p.grounded) {
    if (g !== null && g >= p.pos[1] - C.STEP_HEIGHT) {
      p.pos[1] = g; // đi trên mặt đất / dốc
      vy = 0;
    } else if (!dashing) {
      p.grounded = false; // bước ra mép → rơi xuống
      vy = 0;
    }
  } else {
    p.pos[1] += vy * DT;
    if (g !== null && p.pos[1] <= g && vy <= 0 && p.pos[1] >= g - C.STEP_HEIGHT - 1) {
      p.pos[1] = g;
      vy = 0;
      p.grounded = true;
      p.launch = null;
    }
  }
  p.vel = [vx, vy, vz];

  // Bục nhảy
  if (p.grounded && !p.launch) {
    for (const pad of map.pads) {
      if (distXZ(p.pos, pad.pos) <= 1 && Math.abs(p.pos[1] - pad.pos[1]) < 0.05) {
        p.launch = [pad.hDir[0] * pad.hSpeed, pad.hDir[1] * pad.hSpeed];
        p.vel = [p.launch[0], pad.vy, p.launch[1]];
        p.grounded = false;
        break;
      }
    }
  }

  // Rơi khỏi đảo
  if (p.pos[1] < C.FALL_Y) {
    const lost = p.carried;
    p.flames -= 1;
    p.carried = 0;
    p.respawnTicks = C.RESPAWN_WAIT;
    p.vel = [0, 0, 0];
    p.launch = null;
    p.dashTicks = 0;
    ev.push({ name: 'player_hit', data: { by: 'fall', flames: p.flames, dropped: 0, lost } });
  }
}

function moveShadeBy(w: World, s: Shade, dx: number, dz: number) {
  const nx = s.pos[0] + dx;
  const nz = s.pos[2] + dz;
  const g = w.map.ground(nx, nz);
  if (g === null || w.map.solid(nx, nz, g + C.SHADE_HOVER)) return false; // vật cản: mép đảo, tháp
  s.pos = [nx, g + C.SHADE_HOVER, nz];
  return true;
}

function moveShade(w: World, s: Shade) {
  const p = w.player;
  if (s.state === 'spawning') {
    if (s.bornTick < w.simTick) s.state = 'wander';
    else return;
  }
  if (s.evictTicks > 0) {
    // đẩy ra mép vùng an toàn của đèn sáng gần nhất
    let target: Lantern | null = null;
    let td = Infinity;
    for (const l of w.lanterns) {
      const d = distXZ(s.pos, l.pos);
      if (l.lit && d < TUNING.safe_radius && d < td) { target = l; td = d; }
    }
    if (!target) s.evictTicks = 0;
    else {
      const dir = awayXZ(target.pos, s.pos);
      const step = (TUNING.safe_radius - td) / s.evictTicks;
      moveShadeBy(w, s, dir[0] * step, dir[1] * step);
      s.evictTicks--;
      return;
    }
  }
  const speed = w.map.shadeSpeed * DT;
  if (s.state === 'stunned') {
    if (s.pushTicks > 0) {
      const d = TUNING.pulse_push_m / C.PULSE_PUSH_TICKS;
      if (!moveShadeBy(w, s, s.pushDir[0] * d, s.pushDir[1] * d)) s.pushTicks = 1;
      s.pushTicks--;
    }
    if (s.stateTicks <= 0) s.state = 'wander';
    else return;
  } else if (s.state === 'recoil') {
    const d = C.RECOIL_DIST / C.RECOIL_TICKS;
    moveShadeBy(w, s, s.recoilDir[0] * d, s.recoilDir[1] * d);
    if (s.stateTicks <= 0) s.state = 'wander';
    return;
  }
  const dp = distXZ(s.pos, p.pos);
  const visible = p.respawnTicks === 0;
  if (s.state === 'chase' && (dp > C.SHADE_GIVE_UP || !visible)) s.state = 'wander';
  else if (s.state === 'wander' && dp <= C.SHADE_DETECT && visible) s.state = 'chase';

  if (s.state === 'chase') {
    const dir = awayXZ(s.pos, p.pos);
    const stepLen = Math.min(dp, speed);
    moveShadeBy(w, s, dir[0] * stepLen, dir[1] * stepLen);
  } else {
    if (!s.wanderTarget || s.wanderTicks <= 0 || distXZ(s.pos, s.wanderTarget) < 0.5) {
      const pts = w.map.motePoints;
      s.wanderTarget = pts[Math.floor(w.rng.next() * pts.length)];
      s.wanderTicks = 240;
    }
    s.wanderTicks--;
    const dir = awayXZ(s.pos, s.wanderTarget);
    moveShadeBy(w, s, dir[0] * C.SHADE_WANDER_SPEED * DT, dir[1] * C.SHADE_WANDER_SPEED * DT);
  }
  // bị chặn ở mép vùng an toàn của đèn đã sáng
  for (const l of w.lanterns) {
    if (!l.lit) continue;
    const d = distXZ(s.pos, l.pos);
    if (d < TUNING.safe_radius) {
      const dir = awayXZ(l.pos, s.pos);
      const x = l.pos[0] + dir[0] * TUNING.safe_radius;
      const z = l.pos[2] + dir[1] * TUNING.safe_radius;
      s.pos = [x, groundOr(w, x, z, s.pos[1] - C.SHADE_HOVER) + C.SHADE_HOVER, z];
    }
  }
}

function moveDrifter(w: World, d: Drifter) {
  if (d.state === 'removed' || d.bornTick >= w.simTick) return;
  const p = w.player;
  const dp = distXZ(d.pos, p.pos);
  if (d.state === 'idle' || d.state === 'chase') {
    const want = !d.usedSteal && p.respawnTicks === 0 && p.carried >= C.DRIFTER_CHASE_CARRY && dp <= C.DRIFTER_CHASE_DIST;
    d.state = want ? 'chase' : 'idle';
  }
  let dirx: number;
  let dirz: number;
  let speed: number;
  if (d.state === 'chase') {
    [dirx, dirz] = awayXZ(d.pos, p.pos);
    speed = Math.min(C.DRIFTER_SPEED * DT, dp);
  } else if (d.state === 'flee') {
    [dirx, dirz] = awayXZ(p.pos, d.pos);
    speed = C.DRIFTER_SPEED * DT;
  } else {
    // lượn chậm vòng tròn, quay về phía trong nếu ra mép
    d.heading += 0.02;
    dirx = Math.cos(d.heading);
    dirz = Math.sin(d.heading);
    if (w.map.ground(d.pos[0] + dirx * 3, d.pos[2] + dirz * 3) === null) {
      [dirx, dirz] = awayXZ(d.pos, w.map.start);
      d.heading = Math.atan2(dirz, dirx);
    }
    speed = C.DRIFTER_IDLE_SPEED * DT;
  }
  const nx = d.pos[0] + dirx * speed;
  const nz = d.pos[2] + dirz * speed;
  d.pos = [nx, groundOr(w, nx, nz, d.pos[1] - C.DRIFTER_HOVER) + C.DRIFTER_HOVER, nz];
}

function spawnScheduled(w: World, ev: GameEvent[]) {
  const t = w.simTick;
  const map = w.map;
  // Đom đóm: tick 240, 480, … thêm 1 ở điểm trống nếu dưới trần
  if (w.randomMotes && t % C.MOTE_SPAWN_EVERY === 0 && w.motes.length < C.MOTES_CAP) {
    const used = new Set(w.motes.filter((m) => m.point !== null).map((m) => m.point));
    const free = map.motePoints.map((_, i) => i).filter((i) => !used.has(i));
    if (free.length > 0) addRandomMote(w, free[Math.floor(w.rng.next() * free.length)]);
  }
  // Bóng Mực: 2 con tại tick 300, sau đó 1 con mỗi khoảng sinh; điểm cách người chơi ≥ 15 m
  if (w.randomShades && t >= C.SHADE_FIRST_SPAWN && (t - C.SHADE_FIRST_SPAWN) % map.shadeInterval === 0) {
    const count = t === C.SHADE_FIRST_SPAWN ? 2 : 1;
    for (let k = 0; k < count && w.shades.length < map.shadeMax; k++) {
      const valid = map.shadePoints.filter((sp) => distXZ(sp, w.player.pos) >= C.SHADE_SPAWN_MIN_DIST);
      if (valid.length === 0) break;
      const sp = valid[Math.floor(w.rng.next() * valid.length)];
      const g = groundOr(w, sp[0], sp[2], 0);
      const s = addShade(w, [sp[0], g + C.SHADE_HOVER, sp[2]], undefined, 'spawning');
      ev.push({ name: 'shade_spawned', data: { id: s.id } });
    }
  }
  // Gió Lạc: tick 1200, 2400, … tối đa 2 con đang hoạt động
  if (w.randomDrifters && t % C.DRIFTER_SPAWN_EVERY === 0 && w.drifters.filter((d) => d.state !== 'removed').length < C.DRIFTER_MAX) {
    const pts = map.shadePoints;
    const sp = pts[Math.floor(w.rng.next() * pts.length)];
    addDrifter(w, [sp[0], groundOr(w, sp[0], sp[2], 0) + C.DRIFTER_HOVER, sp[2]]);
  }
  // Gió mạnh: mỗi 30 s một cơn 5 s, hướng ngẫu nhiên; báo trước 2 s
  if (w.windEnabled) {
    if (t > 0 && t % C.WIND_EVERY === 0) {
      w.wind = { active: true, dirDeg: Math.floor(w.rng.next() * 360), ticksLeft: C.WIND_TICKS, warn: false };
    }
    w.wind.warn = !w.wind.active && (t + C.WIND_WARN) % C.WIND_EVERY < C.WIND_WARN && t + C.WIND_WARN >= C.WIND_EVERY;
  }
}
