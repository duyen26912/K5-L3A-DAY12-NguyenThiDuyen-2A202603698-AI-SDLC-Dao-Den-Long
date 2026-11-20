// Luật Đêm 1 (PRD-0) chạy với SỐ CHUẨN của Ticket-02 — regression Phase 1.
// Những test Phase 1 bị luật mới thay đổi được sửa theo luật mới; lý do ghi trong docs/notes/assumptions.md (Phase 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/core/simulate';
import { TUNING } from '../src/core/config';
import { run, snaps, events, last, lastSnap, snapAt, empty, Line } from './helpers';

test('contract v1.1: tuning khớp số chuẩn Ticket-02', () => {
  const expect: Record<string, unknown> = {
    player_speed: 6, carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5, pickup_radius: 1,
    interact_radius: 2, pulse_cost: 3, pulse_radius: 5, night1_duration_s: 300, night2_duration_s: 330,
    night3_duration_s: 360, flames: 3, pulse_cooldown_s: 3, safe_radius: 6, shade_speed: 4,
    dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5, fall_enabled: true,
  };
  for (const [k, v] of Object.entries(expect)) assert.equal((TUNING as Record<string, unknown>)[k], v, k);
  assert.deepEqual(TUNING.score, { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 });
});

test('Đêm 1: bản đồ chuẩn (5 đèn, xuất phát, 20 đom đóm ở 20 điểm khác nhau, chưa có Bóng Mực)', () => {
  const s0 = run({ seed: 1, night: 1, ticks: 0 })[0];
  assert.deepEqual(s0.lanterns.map((l: Line) => l.pos), [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
  assert.deepEqual(s0.player.pos, [0, 0, 0]);
  assert.equal(s0.player.flames, 3);
  assert.equal(s0.time_left_s, 300);
  assert.equal(s0.motes.length, 20);
  assert.equal(new Set(s0.motes.map((m: Line) => m.pos.join())).size, 20);
  assert.ok(s0.motes.every((m: Line) => m.kind === 'random' && m.ttl_s === null));
  assert.equal(s0.shades.length, 0);
});

test('output: snapshot tick 0 + mỗi --snapshot-every, night_start, end ở cuối', () => {
  const ls = run({ seed: 7, night: 1, ticks: 100, snapshotEvery: 25 });
  assert.deepEqual(snaps(ls).map((s) => s.tick), [0, 25, 50, 75, 100]);
  assert.deepEqual(ls[1], { type: 'event', tick: 0, name: 'night_start', data: { night: 1 } });
  assert.deepEqual(last(ls), { type: 'end', ticks: 100, state: 'playing', score: 0 });
  assert.equal(snaps(ls)[1].time_left_s, 299.583);
  assert.equal(snaps(ls)[1].night, 1);
});

test('di chuyển: 6 m/s theo hướng camera, chuẩn hóa vector', () => {
  const mv = (frame: Line) => lastSnap(run({ seed: 1, night: 1, ticks: 60, scenario: empty(), inputs: { frames: [{ tick: 0, ...frame }] } })).player.pos;
  assert.deepEqual(mv({ move: [0, 1] }), [0, 0, 6]);
  assert.deepEqual(mv({ move: [0, 1], cam_yaw_deg: 90 }), [6, 0, 0]);
  assert.deepEqual(mv({ move: [1, 0] }), [6, 0, 0]);
  const [x, , z] = mv({ move: [1, 1] });
  assert.ok(Math.abs(Math.hypot(x, z) - 6) < 0.01);
});

test('nhảy: chỉ khi chạm đất, rồi tiếp đất lại', () => {
  const ls = run({ seed: 1, night: 1, ticks: 120, snapshotEvery: 5, scenario: empty(), inputs: { frames: [{ tick: 0, jump: true }] } });
  assert.ok(snaps(ls).some((s) => s.player.pos[1] > 1.1 && !s.player.grounded));
  assert.deepEqual(lastSnap(ls).player.pos, [0, 0, 0]);
  assert.equal(lastSnap(ls).player.grounded, true);
});

test('nhặt: XZ ≤ 1.0, tối đa 10, không cộng điểm khi nhặt', () => {
  const motes = Array.from({ length: 12 }, () => [0.5, 0, 0]);
  const ls = run({ seed: 1, night: 1, ticks: 1, snapshotEvery: 1, scenario: empty({ motes }) });
  assert.equal(events(ls, 'mote_picked').length, 10);
  assert.equal(lastSnap(ls).player.carried, 10);
  assert.equal(lastSnap(ls).score, 0);
  const far = run({ seed: 1, night: 1, ticks: 1, scenario: empty({ motes: [[1.2, 0, 0]] }) });
  assert.equal(events(far, 'mote_picked').length, 0);
});

test('nạp đèn: trong 2 m, +10 mỗi đom đóm nạp, đủ 10 → thắp +100', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 2, snapshotEvery: 1,
    scenario: empty({ player: { pos: [0, 0, 23.5], carried: 10 } }), inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.deepEqual(events(ls, 'deposit')[0].data, { lantern_id: 'L1', amount: 10, deposited: 10 });
  assert.deepEqual(events(ls, 'lantern_lit')[0].data, { lantern_id: 'L1' });
  assert.equal(lastSnap(ls).score, 10 * 10 + 100);
});

test('nạp đèn: nạp nhiều lần, đèn nhớ tiến độ; giữ nút chỉ nạp 1 lần; ngoài 2 m không nạp', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 10,
    scenario: empty({ player: { pos: [0, 0, 23.5], carried: 4 }, lanterns: [{ id: 'L1', deposited: 3 }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(events(ls, 'deposit').length, 1);
  assert.deepEqual(events(ls, 'deposit')[0].data, { lantern_id: 'L1', amount: 4, deposited: 7 });
  const far = run({ seed: 1, night: 1, ticks: 2, scenario: empty({ player: { pos: [0, 0, 22.9], carried: 4 } }), inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.equal(events(far, 'deposit').length, 0);
});

test('nạp đèn: hai đèn cách bằng nhau → chọn id nhỏ hơn', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 1,
    scenario: empty({ player: { pos: [0, 0, 0], carried: 2 }, lanterns: [{ id: 'L2', pos: [1, 0, 0] }, { id: 'L1', pos: [-1, 0, 0] }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(events(ls, 'deposit')[0].data.lantern_id, 'L1');
});

test('thắng: thắp đèn cuối → won/all_lit + floor(giây còn lại)×2 + 50×Ngọn Lửa', () => {
  const lit = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const ls = run({
    seed: 1, night: 1, ticks: 100,
    scenario: empty({ player: { pos: [0, 0, 23.5], carried: 10 }, lanterns: lit, time_left_s: 100 }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.deepEqual(events(ls, 'game_over')[0].data, { result: 'won', reason: 'all_lit' });
  assert.equal(last(ls).ticks, 1);
  assert.equal(last(ls).score, 200 + 99 * 2 + 3 * 50);
});

test('thắng kể cả đúng tick hết giờ', () => {
  const lit = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const ls = run({
    seed: 1, night: 1, ticks: 200,
    scenario: empty({ player: { pos: [0, 0, 23.5], carried: 10 }, lanterns: lit, time_left_s: 1 }),
    inputs: { frames: [{ tick: 59, interact: true }] },
  });
  assert.equal(last(ls).state, 'won');
  assert.equal(last(ls).ticks, 60);
});

test('scenario: đèn đặt sẵn lit:true không phát sự kiện, không cộng điểm', () => {
  const ls = run({ seed: 1, night: 1, ticks: 5, scenario: empty({ lanterns: [{ id: 'L1', lit: true }] }) });
  assert.equal(events(ls).length, 0);
  assert.equal(lastSnap(ls).score, 0);
});

test('Tỏa Sáng: tốn 3, bán kính 5 m (3D từ chân+0.8), choáng 120 tick, đẩy 4 m trong 15 tick, +5/con', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 20, snapshotEvery: 1,
    scenario: empty({ player: { carried: 4 }, shades: [{ id: 'A', pos: [3, 1, 0] }, { id: 'B', pos: [8, 1, 0] }] }),
    inputs: { frames: [{ tick: 0, pulse: true }] },
  });
  assert.deepEqual(events(ls, 'pulse')[0].data, { stunned_ids: ['A'] });
  const s1 = snapAt(ls, 1);
  assert.equal(s1.player.carried, 1);
  assert.equal(s1.score, 5);
  assert.equal(s1.player.pulse_cd_s, 3);
  const a = (t: number) => snapAt(ls, t).shades.find((s: Line) => s.id === 'A');
  assert.equal(a(1).state, 'stunned');
  assert.deepEqual(a(15).pos, [7, 1, 0]); // 15 tick đẩy × 4/15 m
  assert.deepEqual(a(20).pos, [7, 1, 0]);
});

test('Tỏa Sáng: < 3 đom đóm không kích hoạt; hồi chiêu 3 s; trúng con đang choáng vẫn +5 và làm mới', () => {
  const none = run({ seed: 1, night: 1, ticks: 2, scenario: empty({ player: { carried: 2 }, shades: [{ pos: [3, 1, 0] }] }), inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.equal(events(none, 'pulse').length, 0);
  const cd = run({
    seed: 1, night: 1, ticks: 200, scenario: empty({ player: { carried: 9 }, shades: [{ pos: [2, 1, 0], state: 'stunned', state_ticks_left: 10 }] }),
    inputs: { frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 100, pulse: true }, { tick: 101, pulse: false }, { tick: 180, pulse: true }] },
  });
  assert.deepEqual(events(cd, 'pulse').map((e) => e.tick), [1, 181]);
  assert.equal(events(cd, 'pulse')[0].data.stunned_ids.length, 1);
});

test('Bóng Mực: choáng hết 120 tick thì đuổi lại', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 125, snapshotEvery: 1,
    scenario: empty({ player: { carried: 3 }, shades: [{ pos: [2, 1, 0] }] }), inputs: { frames: [{ tick: 0, pulse: true }] },
  });
  assert.equal(snapAt(ls, 120).shades[0].state, 'stunned');
  assert.equal(snapAt(ls, 121).shades[0].state, 'chase');
});

test('Bóng Mực: wander → chase trong 12 m (4 m/s), bỏ đuổi ngoài 18 m', () => {
  const ls = run({ seed: 1, night: 1, ticks: 60, snapshotEvery: 1, scenario: empty({ shades: [{ pos: [10, 1, 0] }] }) });
  assert.equal(snapAt(ls, 1).shades[0].state, 'chase');
  assert.deepEqual(lastSnap(ls).shades[0].pos, [6, 1, 0]);
  const far = run({ seed: 1, night: 1, ticks: 1, snapshotEvery: 1, scenario: empty({ shades: [{ pos: [13, 1, 0] }] }) });
  assert.equal(snapAt(far, 1).shades[0].state, 'wander');
  const giveUp = run({ seed: 1, night: 1, ticks: 1, snapshotEvery: 1, scenario: empty({ shades: [{ pos: [19, 1, 0], state: 'chase' }] }) });
  assert.equal(snapAt(giveUp, 1).shades[0].state, 'wander');
});

test('bị đánh: −1 Ngọn Lửa, rơi floor(mang/2) ra vành 1.5–2.5 m (TTL 480), bất tử 90, bóng recoil 2 m / 60 tick', () => {
  const ls = run({ seed: 1, night: 1, ticks: 61, snapshotEvery: 1, scenario: empty({ player: { carried: 5 }, shades: [{ pos: [0.5, 1, 0] }] }) });
  const hits = events(ls, 'player_hit');
  assert.equal(hits.length, 1);
  assert.deepEqual(hits[0].data, { by: 'shade', flames: 2, dropped: 2 });
  const s1 = snapAt(ls, 1);
  assert.equal(s1.player.carried, 3);
  assert.equal(s1.player.invuln, true);
  assert.equal(s1.shades[0].state, 'recoil');
  for (const m of s1.motes) {
    const r = Math.hypot(m.pos[0], m.pos[2]);
    assert.ok(m.kind === 'dropped' && r >= 1.5 - 1e-3 && r <= 2.5 + 1e-3 && m.ttl_s === 8);
  }
  assert.ok(Math.abs(snapAt(ls, 61).shades[0].pos[0] - snapAt(ls, 1).shades[0].pos[0] - 2) < 0.01);
});

test('đom đóm rơi: nhặt lại được từ tick sau, biến mất sau 480 tick', () => {
  const ls = run({ seed: 1, night: 1, ticks: 481, snapshotEvery: 1, scenario: empty({ motes: [{ pos: [5, 0, 0], kind: 'dropped' }] }) });
  assert.equal(snapAt(ls, 479).motes.length, 1);
  assert.equal(snapAt(ls, 480).motes.length, 0);
});

test('tối đa 1 lần mất Ngọn Lửa mỗi tick; bóng chạm lúc bất tử không làm gì', () => {
  const ls = run({ seed: 1, night: 1, ticks: 5, snapshotEvery: 1, scenario: empty({ shades: [{ pos: [0.5, 1, 0] }, { pos: [-0.5, 1, 0] }] }) });
  assert.equal(events(ls, 'player_hit').length, 1);
  assert.equal(snapAt(ls, 1).shades[1].state, 'chase'); // con thứ hai chạm lúc bất tử: không recoil
});

test('hết Ngọn Lửa → lost/no_flames; hết giờ → lost/dawn', () => {
  const nf = run({ seed: 1, night: 1, ticks: 100, scenario: empty({ player: { flames: 1 }, shades: [{ pos: [0.5, 1, 0] }] }) });
  assert.deepEqual(events(nf, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  const dawn = run({ seed: 1, night: 1, ticks: 1000, scenario: empty({ time_left_s: 1 }) });
  assert.deepEqual(events(dawn, 'game_over')[0].data, { result: 'lost', reason: 'dawn' });
  assert.equal(last(dawn).ticks, 60);
});

test('vùng an toàn 6 m: Bóng Mực ngoài bị chặn ở mép, không gây sát thương bên trong', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 600, snapshotEvery: 10,
    scenario: empty({ player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ pos: [0, 1, 15] }] }),
  });
  for (const s of snaps(ls)) {
    const [x, , z] = s.shades[0].pos;
    assert.ok(Math.hypot(x, z - 25) >= 6 - 1e-3, `vào vùng an toàn ở tick ${s.tick}`);
  }
  assert.equal(events(ls, 'player_hit').length, 0);
});

test('vùng an toàn: Bóng Mực đang ở trong lúc đèn vừa thắp bị đẩy ra mép trong ≤ 30 tick, không gây sát thương', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 40, snapshotEvery: 1,
    scenario: empty({ player: { pos: [0, 0, 23.5], carried: 10 }, shades: [{ pos: [0.3, 1, 23.5], state: 'chase' }], player_invuln: 0 }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(events(ls, 'lantern_lit').length, 1);
  assert.equal(events(ls, 'player_hit').length, 0);
  const [x, , z] = snapAt(ls, 31).shades[0].pos;
  assert.ok(Math.hypot(x, z - 25) >= 6 - 1e-3);
});

test('lịch sinh Đêm 1: 2 Bóng Mực tại tick 300 (spawning), rồi mỗi 480 tick, cách người chơi ≥ 15 m, tối đa 6', () => {
  const ls = run({ seed: 3, night: 1, ticks: 3500, snapshotEvery: 1, scenario: { player: { flames: 99 } } });
  const sp = events(ls, 'shade_spawned');
  assert.deepEqual(sp.map((e) => e.tick), [300, 300, 780, 1260, 1740, 2220]);
  assert.deepEqual(sp.map((e) => e.data.id), ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
  const s300 = snapAt(ls, 300);
  assert.ok(s300.shades.every((s: Line) => s.state === 'spawning'));
  for (const s of s300.shades) assert.ok(Math.hypot(s.pos[0] - s300.player.pos[0], s.pos[2] - s300.player.pos[2]) >= 15);
  assert.notEqual(snapAt(ls, 301).shades[0].state, 'spawning');
});

test('lịch sinh đom đóm: tick 240, 480… thêm 1 ở điểm trống, trần 30', () => {
  const ls = run({ seed: 2, night: 1, ticks: 480, snapshotEvery: 240, scenario: { random_shades: false } });
  assert.deepEqual(snaps(ls).map((s) => s.motes_active), [20, 21, 22]);
});

test('tất định: cùng seed/scenario/inputs → giống hệt; khác seed → khác (cả 3 Đêm)', () => {
  const inputs = { frames: [{ tick: 0, move: [0.3, 1], cam_yaw_deg: 30 }, { tick: 400, pulse: true }, { tick: 401, pulse: false }] };
  for (const night of [1, 2, 3]) {
    const a = simulate({ seed: 42, night, ticks: 6000, inputs }).join('\n');
    assert.equal(a, simulate({ seed: 42, night, ticks: 6000, inputs }).join('\n'));
    assert.notEqual(a, simulate({ seed: 43, night, ticks: 6000, inputs }).join('\n'));
  }
});
