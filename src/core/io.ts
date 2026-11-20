// Đọc scenario / inputs và ghi snapshot theo Test Contract v1.0.
import { TUNING } from './config';
import {
  World, InputState, Vec3, addMote, addShade, neutralInput, timeLeft,
} from './world';

/** Lỗi định dạng file đầu vào → headless thoát mã 2. */
export class InputFormatError extends Error {}

const fail = (msg: string): never => { throw new InputFormatError(msg); };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function vec3(v: unknown, where: string): Vec3 {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) fail(`${where}: cần mảng [x, y, z]`);
  const a = v as number[];
  return [a[0], a[1], a[2]];
}

// ---------------- Scenario ----------------

/** Thực thể không có id trong scenario được đặt id <prefix>1, <prefix>2… theo thứ tự, bỏ qua id đã dùng. */
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

export function applyScenario(w: World, raw: unknown): void {
  if (!isObj(raw)) fail('scenario: phải là object JSON');
  const sc = raw as Record<string, unknown>;

  if (sc.player !== undefined) {
    if (!isObj(sc.player)) fail('scenario.player: phải là object');
    const pl = sc.player as Record<string, unknown>;
    if (pl.pos !== undefined) w.player.pos = vec3(pl.pos, 'scenario.player.pos');
    if (pl.carried !== undefined) {
      if (!Number.isInteger(pl.carried) || (pl.carried as number) < 0) fail('scenario.player.carried: số nguyên ≥ 0');
      w.player.carried = pl.carried as number;
    }
    if (pl.flames !== undefined) {
      if (!Number.isInteger(pl.flames) || (pl.flames as number) < 1) fail('scenario.player.flames: số nguyên ≥ 1');
      w.player.flames = pl.flames as number;
    }
  }

  for (const key of ['random_motes', 'random_shades'] as const) {
    if (sc[key] !== undefined && typeof sc[key] !== 'boolean') fail(`scenario.${key}: phải là boolean`);
  }
  if (sc.random_motes === false) { w.randomMotes = false; w.motes = []; w.nextMoteId = 1; }
  if (sc.random_shades === false) { w.randomShades = false; w.shades = []; w.nextShadeId = 1; }

  if (sc.motes !== undefined) {
    if (!Array.isArray(sc.motes)) fail('scenario.motes: phải là mảng');
    const items = (sc.motes as unknown[]).map((m, i) => {
      if (Array.isArray(m)) return { pos: vec3(m, `scenario.motes[${i}]`), id: undefined as string | undefined };
      if (isObj(m)) {
        if (m.id !== undefined && typeof m.id !== 'string') fail(`scenario.motes[${i}].id: phải là chuỗi`);
        return { pos: vec3(m.pos, `scenario.motes[${i}].pos`), id: m.id as string | undefined };
      }
      return fail(`scenario.motes[${i}]: cần [x,y,z] hoặc {"pos": [...]}`);
    });
    w.motes = [];
    w.nextMoteId = 1;
    for (const it of assignIds(items, 'M')) addMote(w, it.pos, it.id);
    w.nextMoteId = nextFreeId(w.motes.map((m) => m.id), 'M');
  }

  if (sc.shades !== undefined) {
    if (!Array.isArray(sc.shades)) fail('scenario.shades: phải là mảng');
    const items = (sc.shades as unknown[]).map((s, i) => {
      if (!isObj(s)) fail(`scenario.shades[${i}]: phải là object`);
      const so = s as Record<string, unknown>;
      if (so.id !== undefined && typeof so.id !== 'string') fail(`scenario.shades[${i}].id: phải là chuỗi`);
      return { pos: vec3(so.pos, `scenario.shades[${i}].pos`), id: so.id as string | undefined };
    });
    w.shades = [];
    for (const it of assignIds(items, 'S')) addShade(w, it.pos, it.id);
    w.nextShadeId = nextFreeId(w.shades.map((s) => s.id), 'S');
  }

  if (sc.lanterns !== undefined) {
    if (!Array.isArray(sc.lanterns)) fail('scenario.lanterns: phải là mảng');
    (sc.lanterns as unknown[]).forEach((l, i) => {
      if (!isObj(l) || typeof l.id !== 'string') fail(`scenario.lanterns[${i}]: cần object có "id"`);
      const lo = l as Record<string, unknown>;
      const target = w.lanterns.find((x) => x.id === lo.id);
      if (!target) fail(`scenario.lanterns[${i}]: không có đèn id "${lo.id}"`);
      const t = target!;
      if (lo.pos !== undefined) t.pos = vec3(lo.pos, `scenario.lanterns[${i}].pos`);
      if (lo.deposited !== undefined) {
        if (!Number.isInteger(lo.deposited) || (lo.deposited as number) < 0) fail(`scenario.lanterns[${i}].deposited: số nguyên ≥ 0`);
        t.deposited = lo.deposited as number;
      }
      if (lo.lit !== undefined) {
        if (typeof lo.lit !== 'boolean') fail(`scenario.lanterns[${i}].lit: phải là boolean`);
        t.lit = lo.lit as boolean;
        if (t.lit && lo.deposited === undefined) t.deposited = TUNING.lantern_cost;
      }
    });
  }

  if (sc.time_left_s !== undefined) {
    if (!isNum(sc.time_left_s) || (sc.time_left_s as number) <= 0) fail('scenario.time_left_s: số > 0');
    w.startTimeLeft = sc.time_left_s as number;
  }
}

// ---------------- Inputs ----------------

/** Trả về mảng input theo từng tick 0..ticks-1 (giữ giá trị cũ cho trường vắng mặt). */
export function parseInputs(raw: unknown): (tick: number) => InputState {
  if (!isObj(raw) || !Array.isArray((raw as Record<string, unknown>).frames)) fail('inputs: cần {"frames": [...]}');
  const frames = (raw as { frames: unknown[] }).frames;
  let lastTick = -1;
  const parsed: { tick: number; f: Record<string, unknown> }[] = [];
  frames.forEach((f, i) => {
    if (!isObj(f)) fail(`inputs.frames[${i}]: phải là object`);
    const fo = f as Record<string, unknown>;
    if (!Number.isInteger(fo.tick) || (fo.tick as number) < 0) fail(`inputs.frames[${i}].tick: số nguyên ≥ 0`);
    if ((fo.tick as number) <= lastTick) fail(`inputs.frames[${i}].tick: phải tăng nghiêm ngặt`);
    lastTick = fo.tick as number;
    if (fo.move !== undefined) {
      const mv = fo.move;
      if (!Array.isArray(mv) || mv.length !== 2 || !mv.every((x) => isNum(x) && x >= -1 && x <= 1)) {
        fail(`inputs.frames[${i}].move: cần [x, z] với mỗi thành phần trong [-1, 1]`);
      }
    }
    if (fo.cam_yaw_deg !== undefined && !isNum(fo.cam_yaw_deg)) fail(`inputs.frames[${i}].cam_yaw_deg: phải là số`);
    for (const k of ['jump', 'interact', 'pulse', 'dash']) {
      if (fo[k] !== undefined && typeof fo[k] !== 'boolean') fail(`inputs.frames[${i}].${k}: phải là boolean`);
    }
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
      cur = {
        move: f.move !== undefined ? [(f.move as number[])[0], (f.move as number[])[1]] : cur.move,
        camYawDeg: f.cam_yaw_deg !== undefined ? (f.cam_yaw_deg as number) : cur.camYawDeg,
        jump: f.jump !== undefined ? (f.jump as boolean) : cur.jump,
        interact: f.interact !== undefined ? (f.interact as boolean) : cur.interact,
        pulse: f.pulse !== undefined ? (f.pulse as boolean) : cur.pulse,
        dash: f.dash !== undefined ? (f.dash as boolean) : cur.dash,
      };
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

export function snapshot(w: World) {
  return {
    type: 'snapshot',
    tick: w.steps,
    sim_tick: w.steps,
    state: w.state,
    time_left_s: r3(Math.max(0, timeLeft(w))),
    score: w.score,
    player: { pos: rv(w.player.pos), flames: w.player.flames, carried: w.player.carried },
    lanterns: w.lanterns.map((l) => ({ id: l.id, pos: rv(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: w.shades.map((s) => ({ id: s.id, pos: rv(s.pos), state: s.state })),
    motes_active: w.motes.length,
    motes: w.motes.map((m) => ({ id: m.id, pos: rv(m.pos) })),
  };
}
