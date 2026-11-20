// Test logic game qua simulate() — cùng đường chạy với headless.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/core/simulate';
import { TUNING } from '../src/core/config';

type Line = Record<string, any>;
const run = (o: Parameters<typeof simulate>[0]): Line[] => simulate(o).map((l) => JSON.parse(l));
const snaps = (ls: Line[]) => ls.filter((l) => l.type === 'snapshot');
const events = (ls: Line[], name?: string) => ls.filter((l) => l.type === 'event' && (!name || l.name === name));
const last = (ls: Line[]) => ls[ls.length - 1];
const lastSnap = (ls: Line[]) => snaps(ls).at(-1)!;

/** Scenario sạch: không đom đóm/Bóng Mực ngẫu nhiên. */
const empty = (extra: Record<string, unknown> = {}) => ({
  random_motes: false, random_shades: false, motes: [], shades: [], ...extra,
});

test('contract: tuning khai báo đủ trường và dùng đúng trong game', () => {
  for (const k of ['player_speed', 'carry_capacity', 'lantern_cost', 'lantern_count_night1', 'pickup_radius',
    'interact_radius', 'pulse_cost', 'pulse_radius', 'night1_duration_s', 'flames', 'invuln_s', 'hit_drop_ratio',
    'pulse_stun_s', 'pulse_push_m', 'pulse_cooldown_s', 'safe_radius', 'shade_speed', 'shade_hit_radius', 'fall_enabled']) {
    assert.ok(k in TUNING, `thiếu tuning.${k}`);
  }
  assert.equal(TUNING.lantern_count_night1, 5);
  const ls = run({ seed: 1, night: 1, ticks: 0 });
  const s0 = ls[0];
  assert.equal(s0.lanterns.length, 5);
  assert.equal(s0.player.flames, TUNING.flames);
  assert.equal(s0.time_left_s, TUNING.night1_duration_s);
  assert.deepEqual(s0.player.pos, [0, 0, 0]);
});

test('output: snapshot tick 0, mỗi --snapshot-every tick, dòng cuối là end', () => {
  const ls = run({ seed: 7, night: 1, ticks: 100, snapshotEvery: 25 });
  assert.deepEqual(snaps(ls).map((s) => s.tick), [0, 25, 50, 75, 100]);
  assert.deepEqual(last(ls), { type: 'end', ticks: 100, state: 'playing', score: 0 });
  assert.equal(snaps(ls)[1].time_left_s, 299.583); // 300 - 25/60, làm tròn 3 chữ số
  assert.equal(ls[0].sim_tick, 0);
});

test('di chuyển: move [0,1] với yaw 0 đi theo +Z đúng player_speed', () => {
  const ls = run({ seed: 1, night: 1, ticks: 60, scenario: empty(), inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  assert.deepEqual(lastSnap(ls).player.pos, [0, 0, TUNING.player_speed]);
});

test('di chuyển: yaw 90° biến move [0,1] thành +X; move [1,0] yaw 0 là +X', () => {
  const a = run({ seed: 1, night: 1, ticks: 60, scenario: empty(), inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] } });
  assert.deepEqual(lastSnap(a).player.pos, [TUNING.player_speed, 0, 0]);
  const b = run({ seed: 1, night: 1, ticks: 60, scenario: empty(), inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
  assert.deepEqual(lastSnap(b).player.pos, [TUNING.player_speed, 0, 0]);
});

test('di chuyển: vector dài hơn 1 được chuẩn hóa', () => {
  const ls = run({ seed: 1, night: 1, ticks: 60, scenario: empty(), inputs: { frames: [{ tick: 0, move: [1, 1] }] } });
  const [x, , z] = lastSnap(ls).player.pos;
  assert.ok(Math.abs(Math.hypot(x, z) - TUNING.player_speed) < 0.01);
});

test('nhảy: rời mặt đất rồi tiếp đất lại, không đổi vị trí ngang', () => {
  const ls = run({ seed: 1, night: 1, ticks: 120, snapshotEvery: 5, scenario: empty(), inputs: { frames: [{ tick: 0, jump: true }] } });
  assert.ok(snaps(ls).some((s) => s.player.pos[1] > 0.5));
  assert.deepEqual(lastSnap(ls).player.pos, [0, 0, 0]);
});

test('nhặt đom đóm trong pickup_radius, không vượt carry_capacity, cộng điểm per_mote', () => {
  const motes = Array.from({ length: TUNING.carry_capacity + 2 }, () => [0.5, 0, 0]);
  const ls = run({ seed: 1, night: 1, ticks: 1, snapshotEvery: 1, scenario: empty({ motes }) });
  assert.equal(events(ls, 'mote_picked').length, TUNING.carry_capacity);
  assert.deepEqual(events(ls, 'mote_picked').at(-1)!.data, { carried: TUNING.carry_capacity });
  const s = lastSnap(ls);
  assert.equal(s.player.carried, TUNING.carry_capacity);
  assert.equal(s.motes_active, 2);
  assert.equal(s.score, TUNING.score.per_mote * TUNING.carry_capacity);
});

test('đom đóm ngoài pickup_radius không bị nhặt', () => {
  const ls = run({ seed: 1, night: 1, ticks: 1, scenario: empty({ motes: [[TUNING.pickup_radius + 0.2, 0, 0]] }) });
  assert.equal(events(ls, 'mote_picked').length, 0);
});

test('nạp đèn: interact trong interact_radius → deposit; đủ lantern_cost → lantern_lit, cộng per_lantern', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 3, snapshotEvery: 1,
    scenario: empty({ player: { pos: [0, 0, 23], carried: TUNING.lantern_cost } }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.deepEqual(events(ls, 'deposit')[0].data, { lantern_id: 'L1', amount: TUNING.lantern_cost, deposited: TUNING.lantern_cost });
  assert.deepEqual(events(ls, 'lantern_lit')[0].data, { lantern_id: 'L1' });
  assert.equal(events(ls, 'deposit')[0].tick, 1);
  const s = lastSnap(ls);
  assert.equal(s.lanterns[0].lit, true);
  assert.equal(s.player.carried, 0);
  assert.equal(s.score, TUNING.score.per_lantern);
});

test('nạp đèn: giữ interact chỉ nạp 1 lần (kích hoạt khi false → true); nạp từng phần', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 10,
    scenario: empty({ player: { pos: [0, 0, 23], carried: 2 } }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(events(ls, 'deposit').length, 1);
  assert.deepEqual(events(ls, 'deposit')[0].data, { lantern_id: 'L1', amount: 2, deposited: 2 });
  assert.equal(events(ls, 'lantern_lit').length, 0);
});

test('nạp đèn: ngoài interact_radius thì không nạp', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 3,
    scenario: empty({ player: { pos: [0, 0, 25 - TUNING.interact_radius - 0.5], carried: 3 } }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(events(ls, 'deposit').length, 0);
});

test('thắng: thắp đèn cuối cùng → game_over won/all_lit, cộng điểm thời gian và flames', () => {
  const lit = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const ls = run({
    seed: 1, night: 1, ticks: 100,
    scenario: empty({ player: { pos: [0, 0, 23], carried: 5 }, lanterns: lit, time_left_s: 100 }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.deepEqual(events(ls, 'game_over')[0].data, { result: 'won', reason: 'all_lit' });
  const end = last(ls);
  assert.equal(end.state, 'won');
  assert.equal(end.ticks, 1);
  // per_lantern + floor(100 - 1/60) * per_second_left + 3 * per_flame_left
  assert.equal(end.score, TUNING.score.per_lantern + 99 * TUNING.score.per_second_left + 3 * TUNING.score.per_flame_left);
});

test('scenario: đèn đặt sẵn lit:true không phát sự kiện, không cộng điểm', () => {
  const ls = run({ seed: 1, night: 1, ticks: 5, scenario: empty({ lanterns: [{ id: 'L1', lit: true }] }) });
  assert.equal(events(ls).length, 0);
  assert.equal(lastSnap(ls).score, 0);
  assert.equal(ls[0].lanterns[0].lit, true);
});

test('tỏa sáng: làm choáng Bóng Mực trong pulse_radius, đẩy lùi, tốn pulse_cost, cộng per_stun', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 2, snapshotEvery: 1,
    scenario: empty({ player: { carried: 2 }, shades: [{ id: 'A', pos: [3, 1, 0] }, { id: 'B', pos: [TUNING.pulse_radius + 3, 1, 0] }] }),
    inputs: { frames: [{ tick: 0, pulse: true }] },
  });
  assert.deepEqual(events(ls, 'pulse')[0].data, { stunned_ids: ['A'] });
  const s1 = snaps(ls)[1];
  assert.equal(s1.player.carried, 2 - TUNING.pulse_cost);
  assert.equal(s1.score, TUNING.score.per_stun);
  const a = s1.shades.find((s: Line) => s.id === 'A');
  assert.equal(a.state, 'stunned');
  assert.deepEqual(a.pos, [3 + TUNING.pulse_push_m, 1, 0]);
});

test('tỏa sáng: không đủ đom đóm thì không tỏa sáng; có hồi chiêu', () => {
  const none = run({ seed: 1, night: 1, ticks: 2, scenario: empty({ shades: [{ pos: [3, 1, 0] }] }), inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.equal(events(none, 'pulse').length, 0);
  const cd = run({
    seed: 1, night: 1, ticks: 10, scenario: empty({ player: { carried: 5 } }),
    inputs: { frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 5, pulse: true }] },
  });
  assert.equal(events(cd, 'pulse').length, 1);
});

test('Bóng Mực choáng hết pulse_stun_s thì đuổi tiếp', () => {
  const stunTicks = TUNING.pulse_stun_s * 60;
  const ls = run({
    seed: 1, night: 1, ticks: stunTicks + 2, snapshotEvery: 1,
    scenario: empty({ player: { carried: 1 }, shades: [{ pos: [2, 1, 0] }] }),
    inputs: { frames: [{ tick: 0, pulse: true }] },
  });
  const st = snaps(ls);
  assert.equal(st[stunTicks].shades[0].state, 'stunned');
  assert.equal(st[stunTicks + 1].shades[0].state, 'chase');
});

test('bị chạm: mất 1 flame, rơi floor(carried*hit_drop_ratio), bất tử invuln_s', () => {
  const ls = run({
    seed: 1, night: 1, ticks: TUNING.invuln_s * 60 - 5,
    scenario: empty({ player: { carried: 4 }, shades: [{ pos: [0.5, 1, 0] }] }),
  });
  const hits = events(ls, 'player_hit');
  assert.equal(hits.length, 1);
  const dropped = Math.floor(4 * TUNING.hit_drop_ratio);
  assert.deepEqual(hits[0].data, { by: 'shade', flames: TUNING.flames - 1, dropped });
  const s = lastSnap(ls);
  assert.equal(s.player.carried, 4 - dropped);
  assert.equal(s.motes_active, dropped);
});

test('hết flames → game_over lost/no_flames', () => {
  const ls = run({ seed: 1, night: 1, ticks: 1000, scenario: empty({ player: { flames: 1 }, shades: [{ pos: [0.5, 1, 0] }] }) });
  assert.deepEqual(events(ls, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(last(ls).state, 'lost');
  assert.equal(last(ls).ticks, 1);
});

test('hết giờ → game_over lost/dawn', () => {
  const ls = run({ seed: 1, night: 1, ticks: 1000, scenario: empty({ time_left_s: 1 }) });
  assert.deepEqual(events(ls, 'game_over')[0].data, { result: 'lost', reason: 'dawn' });
  assert.equal(last(ls).ticks, 60);
});

test('Bóng Mực đuổi người chơi với shade_speed và không vào safe_radius của đèn đã thắp', () => {
  const chase = run({ seed: 1, night: 1, ticks: 60, scenario: empty({ shades: [{ pos: [20, 1, 0] }] }) });
  assert.deepEqual(lastSnap(chase).shades[0].pos, [20 - TUNING.shade_speed, 1, 0]);
  const safe = run({
    seed: 1, night: 1, ticks: 600, snapshotEvery: 10,
    scenario: empty({ player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ pos: [0, 1, 10] }] }),
  });
  for (const s of snaps(safe)) {
    const [x, , z] = s.shades[0].pos;
    assert.ok(Math.hypot(x, z - 25) >= TUNING.safe_radius - 1e-3, `Bóng Mực vào vùng an toàn ở tick ${s.tick}`);
  }
  assert.equal(events(safe, 'player_hit').length, 0);
});

test('tất định: cùng seed/scenario/inputs → output giống hệt; khác seed → khác', () => {
  const inputs = { frames: [{ tick: 0, move: [0.3, 1], cam_yaw_deg: 30 }, { tick: 400, pulse: true }, { tick: 401, pulse: false }] };
  const a = simulate({ seed: 42, night: 1, ticks: 6000, inputs }).join('\n');
  const b = simulate({ seed: 42, night: 1, ticks: 6000, inputs }).join('\n');
  const c = simulate({ seed: 43, night: 1, ticks: 6000, inputs }).join('\n');
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('random: Bóng Mực mới xuất hiện theo thời gian (shade_spawned)', () => {
  const ls = run({ seed: 5, night: 1, ticks: 50 * 60, scenario: { player: { flames: 99 } } });
  assert.ok(events(ls, 'shade_spawned').length >= 1);
  assert.equal(events(ls, 'shade_spawned')[0].data.id, 'S3');
});
