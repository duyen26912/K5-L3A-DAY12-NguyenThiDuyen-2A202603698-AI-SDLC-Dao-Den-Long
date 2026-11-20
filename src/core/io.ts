// Đọc scenario / inputs và ghi snapshot theo Test Contract v1.2.
import * as C from './config';
import { TUNING, sec } from './config';
import {
  World, InputState, Vec3, ShadeState, DrifterState, addMoteAt, addShade, addDrifter, neutralInput, timeLeft, capacity, fuelOut,
} from './world';

/** Lỗi định dạng file đầu vào → headless thoát mã 2. */
export class InputFormatError extends Error {}

const fail = (msg: string): never => { throw new InputFormatError(msg); };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown, min = 0): v is number => Number.isInteger(v) && (v as number) >= min;

function vec3(v: unknown, where: string): Vec3 {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) fail(`${where}: cần mảng [x, y, z]`);
  const a = v as number[];
  return [a[0], a[1], a[2]];
}
function optInt(o: Record<string, unknown>, k: string, where: string, min = 0): number | undefined {
  if (o[k] === undefined) return undefined;
  if (!isInt(o[k], min)) fail(`${where}.${k}: số nguyên ≥ ${min}`);
  return o[k] as number;
}
function optBool(o: Record<string, unknown>, k: string, where: string): boolean | undefined {
  if (o[k] === undefined) return undefined;
  if (typeof o[k] !== 'boolean') fail(`${where}.${k}: phải là boolean`);
  return o[k] as boolean;
}

/** Thực thể không có id được đặt <prefix>1, <prefix>2… theo thứ tự, bỏ qua id đã dùng. */
function assignIds<T extends { id?: string }>(items: T[], prefix: string): (T & { id: string })[] {
  const used = new Set(items.map((i) => i.id).filter((x): x is string => !!x));
  if (used.size !== items.filter((i) => i.id).length) fail(`scenario: id ${prefix} bị trùng`);
  let n = 1;
  return items.map((it) => {
    if (it.id) return it as T & { id: string };
    while (used.has(`${prefix}${n}`)) n++;
    const id = `${prefix}${n++}`;
    used.add(id);
    return { ...it, id };
  });
}
function nextFreeId(ids: string[], prefix: string): number {
  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`);
  for (const id of ids) {
    const m = re.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

const SHADE_STATES: ShadeState[] = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
const DRIFTER_STATES: DrifterState[] = ['idle', 'chase', 'flee', 'removed'];

// ---------------- Scenario ----------------

export function applyScenario(w: World, raw: unknown): void {
  if (!isObj(raw)) fail('scenario: phải là object JSON');
  const sc = raw as Record<string, unknown>;
  const p = w.player;

  if (sc.player !== undefined) {
    if (!isObj(sc.player)) fail('scenario.player: phải là object');
    const pl = sc.player as Record<string, unknown>;
    if (pl.pos !== undefined) {
      p.pos = vec3(pl.pos, 'scenario.player.pos');
      const g = w.map.ground(p.pos[0], p.pos[2]);
      p.grounded = g !== null && Math.abs(p.pos[1] - g) < 1e-6;
    }
    const carried = optInt(pl, 'carried', 'scenario.player');
    if (carried !== undefined) p.carried = carried;
    const flames = optInt(pl, 'flames', 'scenario.player', 1);
    if (flames !== undefined) p.flames = flames;
    p.invulnTicks = optInt(pl, 'invuln_ticks', 'scenario.player') ?? p.invulnTicks;
    p.dashCd = optInt(pl, 'dash_cd_ticks', 'scenario.player') ?? p.dashCd;
    p.pulseCd = optInt(pl, 'pulse_cd_ticks', 'scenario.player') ?? p.pulseCd;
    p.charmTicks = optInt(pl, 'charm_ticks', 'scenario.player') ?? p.charmTicks;
    p.successfulLights = optInt(pl, 'successful_lights', 'scenario.player') ?? p.successfulLights;
  }

  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) optBool(sc, k, 'scenario');
  if (sc.random_motes === false) { w.randomMotes = false; w.motes = []; w.nextMoteId = 1; }
  if (sc.random_shades === false) w.randomShades = false;
  if (sc.random_drifters === false) w.randomDrifters = false;
  if (sc.random_drifters === true) w.randomDrifters = true;
  if (sc.wind_enabled !== undefined) w.windEnabled = sc.wind_enabled as boolean;

  if (sc.motes !== undefined) {
    if (!Array.isArray(sc.motes)) fail('scenario.motes: phải là mảng');
    const items = (sc.motes as unknown[]).map((m, i) => {
      if (Array.isArray(m)) return { pos: vec3(m, `scenario.motes[${i}]`), id: undefined as string | undefined, kind: 'random' as const };
      if (isObj(m)) {
        if (m.id !== undefined && typeof m.id !== 'string') fail(`scenario.motes[${i}].id: phải là chuỗi`);
        if (m.kind !== undefined && m.kind !== 'random' && m.kind !== 'dropped') fail(`scenario.motes[${i}].kind: random | dropped`);
        return { pos: vec3(m.pos, `scenario.motes[${i}].pos`), id: m.id as string | undefined, kind: (m.kind as 'random' | 'dropped') ?? 'random' };
      }
      return fail(`scenario.motes[${i}]: cần [x,y,z] hoặc {"pos": [...]}`);
    });
    w.motes = [];
    w.nextMoteId = 1;
    for (const it of assignIds(items, 'M')) addMoteAt(w, it.pos, it.kind, it.id);
    w.nextMoteId = nextFreeId(w.motes.map((m) => m.id), 'M');
  }

  if (sc.shades !== undefined) {
    if (!Array.isArray(sc.shades)) fail('scenario.shades: phải là mảng');
    const items = (sc.shades as unknown[]).map((s, i) => {
      const where = `scenario.shades[${i}]`;
      if (!isObj(s)) fail(`${where}: phải là object`);
      const so = s as Record<string, unknown>;
      if (so.id !== undefined && typeof so.id !== 'string') fail(`${where}.id: phải là chuỗi`);
      if (so.state !== undefined && !SHADE_STATES.includes(so.state as ShadeState)) fail(`${where}.state: ${SHADE_STATES.join(' | ')}`);
      const state = (so.state as ShadeState) ?? 'wander';
      const left = optInt(so, 'state_ticks_left', where) ??
        (state === 'stunned' ? sec(TUNING.pulse_stun_s) : state === 'recoil' ? C.RECOIL_TICKS : 0);
      if (so.target_lantern_id !== undefined && typeof so.target_lantern_id !== 'string') fail(`${where}.target_lantern_id: phải là chuỗi`);
      return { pos: vec3(so.pos, `${where}.pos`), id: so.id as string | undefined, state, left, target: (so.target_lantern_id as string | undefined) ?? null };
    });
    w.shades = [];
    for (const it of assignIds(items, 'S')) addShade(w, it.pos, it.id, it.state, it.left).targetLanternId = it.target;
    w.nextShadeId = nextFreeId(w.shades.map((s) => s.id), 'S');
  }

  if (sc.drifters !== undefined) {
    if (!Array.isArray(sc.drifters)) fail('scenario.drifters: phải là mảng');
    const items = (sc.drifters as unknown[]).map((d, i) => {
      const where = `scenario.drifters[${i}]`;
      if (!isObj(d)) fail(`${where}: phải là object`);
      const dobj = d as Record<string, unknown>;
      if (dobj.id !== undefined && typeof dobj.id !== 'string') fail(`${where}.id: phải là chuỗi`);
      if (dobj.state !== undefined && !DRIFTER_STATES.includes(dobj.state as DrifterState)) fail(`${where}.state: ${DRIFTER_STATES.join(' | ')}`);
      return { pos: vec3(dobj.pos, `${where}.pos`), id: dobj.id as string | undefined, state: (dobj.state as DrifterState) ?? 'idle', stolen: optInt(dobj, 'stolen', where) ?? 0 };
    });
    w.drifters = [];
    for (const it of assignIds(items, 'D')) addDrifter(w, it.pos, it.id, it.state, it.stolen);
    w.nextDrifterId = nextFreeId(w.drifters.map((d) => d.id), 'D');
  }

  if (sc.charms !== undefined) {
    if (!Array.isArray(sc.charms)) fail('scenario.charms: phải là mảng');
    const items = (sc.charms as unknown[]).map((c, i) => {
      const where = `scenario.charms[${i}]`;
      if (!isObj(c)) fail(`${where}: phải là object`);
      const co = c as Record<string, unknown>;
      if (co.id !== undefined && typeof co.id !== 'string') fail(`${where}.id: phải là chuỗi`);
      const available = optBool(co, 'available', where) ?? true;
      const respawn = optInt(co, 'respawn_ticks', where) ?? (available ? 0 : C.CHARM_RESPAWN);
      return { pos: vec3(co.pos, `${where}.pos`), id: co.id as string | undefined, available, respawn };
    });
    w.charms = assignIds(items, 'C').map((it) => ({ id: it.id, pos: it.pos, available: it.available, respawnTicks: it.available ? 0 : it.respawn }));
  }

  if (sc.lanterns !== undefined) {
    if (!Array.isArray(sc.lanterns)) fail('scenario.lanterns: phải là mảng');
    (sc.lanterns as unknown[]).forEach((l, i) => {
      const where = `scenario.lanterns[${i}]`;
      if (!isObj(l) || typeof l.id !== 'string') fail(`${where}: cần object có "id"`);
      const lo = l as Record<string, unknown>;
      const t = w.lanterns.find((x) => x.id === lo.id) ?? fail(`${where}: không có đèn id "${lo.id}" ở Đêm ${w.night}`);
      if (lo.pos !== undefined) t.pos = vec3(lo.pos, `${where}.pos`);
      const dep = optInt(lo, 'deposited', where);
      if (dep !== undefined) t.deposited = Math.min(dep, TUNING.lantern_cost);
      const lit = optBool(lo, 'lit', where);
      const everLit = optBool(lo, 'ever_lit', where);
      if (lo.fuel !== undefined && (!isNum(lo.fuel) || (lo.fuel as number) < 0 || (lo.fuel as number) > TUNING.fuel_max)) fail(`${where}.fuel: số trong [0, ${TUNING.fuel_max}]`);
      if (lit !== undefined) {
        t.lit = lit;
        if (lit && dep === undefined) t.deposited = TUNING.lantern_cost;
        // đèn đặt lit: true mà không có fuel → fuel = 100; đèn tắt có fuel 0
        t.fuelU = lit ? C.FUEL_MAX_U : 0;
        t.everLit = lit || t.everLit;
      }
      if (lo.fuel !== undefined && t.lit) t.fuelU = Math.round((lo.fuel as number) * C.FUEL_UNITS);
      if (everLit !== undefined) t.everLit = everLit || t.lit;
    });
  }

  if (sc.time_left_s !== undefined) {
    if (!isNum(sc.time_left_s) || (sc.time_left_s as number) <= 0) fail('scenario.time_left_s: số > 0');
    w.startTimeLeft = sc.time_left_s as number;
  }
}

// ---------------- Inputs ----------------

const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'] as const;

/** Trả về hàm lấy input theo tick (giữ giá trị cũ cho trường vắng mặt). */
export function parseInputs(raw: unknown): (tick: number) => InputState {
  if (!isObj(raw) || !Array.isArray((raw as Record<string, unknown>).frames)) fail('inputs: cần {"frames": [...]}');
  const frames = (raw as { frames: unknown[] }).frames;
  let lastTick = -1;
  const parsed: { tick: number; f: Record<string, unknown> }[] = [];
  frames.forEach((f, i) => {
    const where = `inputs.frames[${i}]`;
    if (!isObj(f)) fail(`${where}: phải là object`);
    const fo = f as Record<string, unknown>;
    if (!isInt(fo.tick)) fail(`${where}.tick: số nguyên ≥ 0`);
    if ((fo.tick as number) <= lastTick) fail(`${where}.tick: phải tăng nghiêm ngặt`);
    lastTick = fo.tick as number;
    if (fo.move !== undefined) {
      const mv = fo.move;
      if (!Array.isArray(mv) || mv.length !== 2 || !mv.every((x) => isNum(x) && x >= -1 && x <= 1)) {
        fail(`${where}.move: cần [x, z] với mỗi thành phần trong [-1, 1]`);
      }
    }
    if (fo.cam_yaw_deg !== undefined && !isNum(fo.cam_yaw_deg)) fail(`${where}.cam_yaw_deg: phải là số`);
    for (const k of BUTTONS) optBool(fo, k, where);
    parsed.push({ tick: fo.tick as number, f: fo });
  });

  let cur = neutralInput();
  let idx = 0;
  let lastQueried = -1;
  return (tick: number) => {
    if (tick < lastQueried) throw new Error('inputs phải được đọc theo thứ tự tick tăng dần');
    lastQueried = tick;
    while (idx < parsed.length && parsed[idx].tick <= tick) {
      const f = parsed[idx].f;
      const next: InputState = { ...cur, move: [cur.move[0], cur.move[1]] };
      if (f.move !== undefined) next.move = [(f.move as number[])[0], (f.move as number[])[1]];
      if (f.cam_yaw_deg !== undefined) next.camYawDeg = f.cam_yaw_deg as number;
      for (const k of BUTTONS) if (f[k] !== undefined) next[k] = f[k] as boolean;
      cur = next;
      idx++;
    }
    return cur;
  };
}

// ---------------- Snapshot ----------------

const r3 = (x: number): number => {
  const v = Math.round(x * 1000) / 1000;
  return Object.is(v, -0) ? 0 : v;
};
const rv = (p: Vec3): Vec3 => [r3(p[0]), r3(p[1]), r3(p[2])];
const secs = (ticks: number) => r3(ticks / C.TICK_RATE);

export function snapshot(w: World) {
  const p = w.player;
  return {
    type: 'snapshot',
    tick: w.tick,
    sim_tick: w.simTick,
    night: w.night,
    state: w.paused && w.state === 'playing' ? 'paused' : w.state,
    time_left_s: r3(Math.max(0, timeLeft(w))),
    score: w.score,
    wind: { active: w.wind.active, dir_deg: w.wind.active ? w.wind.dirDeg : null },
    player: {
      pos: rv(p.pos), vel: rv(p.vel), grounded: p.grounded, flames: p.flames, carried: p.carried,
      invuln: p.invulnTicks > 0, dash_cd_s: secs(p.dashCd), pulse_cd_s: secs(p.pulseCd), charm_s: secs(p.charmTicks),
      capacity: capacity(w),
    },
    lanterns: w.lanterns.map((l) => ({
      id: l.id, pos: rv(l.pos), lit: l.lit, deposited: l.deposited,
      fuel: l.lit ? fuelOut(l) : 0, ever_lit: l.everLit, relit_count: l.relitCount,
    })),
    shades: w.shades.map((s) => ({ id: s.id, pos: rv(s.pos), state: s.state })),
    motes_active: w.motes.length,
    motes: w.motes.map((m) => ({ id: m.id, pos: rv(m.pos), kind: m.kind, ttl_s: m.ttl === null ? null : secs(m.ttl) })),
    drifters: w.drifters.map((d) => ({ id: d.id, pos: rv(d.pos), state: d.state, stolen: d.stolen })),
    charms: w.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: secs(c.respawnTicks) })),
  };
}
