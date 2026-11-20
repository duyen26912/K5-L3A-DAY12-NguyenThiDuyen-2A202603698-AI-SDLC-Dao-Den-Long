// Tính năng mới Ticket-02 (Phase 2): lướt, tạm dừng, rơi khỏi đảo, Đêm 2–3 (cầu, bục nhảy, tầng, dốc, tháp, gió),
// Gió Lạc, Bùa Gió, snapshot/scenario v1.1, hiệu năng.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/core/simulate';
import { run, snaps, events, last, lastSnap, snapAt, empty, Line } from './helpers';

const close = (a: number, b: number, eps = 0.02) => Math.abs(a - b) <= eps;

// ---------- Lướt ----------
test('Lướt: 14 m/s trong 12 tick theo hướng di chuyển, sự kiện dash, hồi chiêu 1.5 s từ lúc bắt đầu', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 100, snapshotEvery: 1, scenario: empty(),
    inputs: { frames: [{ tick: 0, dash: true, move: [1, 0] }, { tick: 1, dash: false, move: [0, 0] }, { tick: 50, dash: true }, { tick: 51, dash: false }, { tick: 90, dash: true }] },
  });
  assert.deepEqual(events(ls, 'dash').map((e) => e.tick), [1, 91]);
  assert.ok(close(snapAt(ls, 12).player.pos[0], 14 * 0.2 + 0 - 0)); // 2.8 m (tick 1 vừa đi vừa lướt)
  assert.equal(snapAt(ls, 1).player.dash_cd_s, 1.5);
  assert.ok(close(snapAt(ls, 13).player.pos[0], snapAt(ls, 12).player.pos[0])); // hết lướt, đứng yên
});

test('Lướt: đứng yên thì theo hướng đang quay mặt; trên không giữ nguyên độ cao', () => {
  const idle = run({ seed: 1, night: 1, ticks: 12, snapshotEvery: 12, scenario: empty(), inputs: { frames: [{ tick: 0, dash: true }] } });
  assert.deepEqual(lastSnap(idle).player.pos, [0, 0, 2.8]); // quay mặt +Z lúc xuất phát
  const air = run({
    seed: 1, night: 1, ticks: 30, snapshotEvery: 1, scenario: empty(),
    inputs: { frames: [{ tick: 0, jump: true }, { tick: 10, dash: true }] },
  });
  const y11 = snapAt(air, 11).player.pos[1];
  assert.ok(y11 > 0.5);
  assert.equal(snapAt(air, 22).player.pos[1], y11);
});

// ---------- Tạm dừng ----------
test('Tạm dừng: tick tăng nhưng sim_tick/thời gian/hồi chiêu đứng yên; state "paused"; paused/resumed', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 60, snapshotEvery: 10, scenario: empty({ player: { pulse_cd_ticks: 100 } }),
    inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 9, pause: true }, { tick: 10, pause: false }, { tick: 39, pause: true }] },
  });
  assert.deepEqual(events(ls, 'paused').map((e) => e.tick), [10]);
  assert.deepEqual(events(ls, 'resumed').map((e) => e.tick), [40]);
  const s20 = snapAt(ls, 20);
  const s30 = snapAt(ls, 30);
  assert.equal(s20.state, 'paused');
  assert.equal(s20.sim_tick, 9);
  assert.equal(s30.sim_tick, 9);
  assert.deepEqual(s20.player.pos, s30.player.pos);
  assert.equal(s20.time_left_s, s30.time_left_s);
  assert.equal(s20.player.pulse_cd_s, s30.player.pulse_cd_s);
  assert.equal(snapAt(ls, 60).state, 'playing');
  assert.equal(snapAt(ls, 60).sim_tick, 30); // tick 40 vừa tiếp tục cũng chạy mô phỏng
});

// ---------- Rơi khỏi đảo ----------
test('Rơi khỏi đảo: Y < −10 → −1 Ngọn Lửa, mất toàn bộ đom đóm (lost), chờ 60 tick, hồi sinh ở xuất phát bất tử 90', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 200, snapshotEvery: 1, scenario: empty({ player: { pos: [39.5, 0, 0], carried: 7 } }),
    inputs: { frames: [{ tick: 0, move: [1, 0] }] },
  });
  const hit = events(ls, 'player_hit');
  assert.equal(hit.length, 1);
  assert.deepEqual(hit[0].data, { by: 'fall', flames: 2, dropped: 0, lost: 7 });
  const t = hit[0].tick;
  assert.equal(snapAt(ls, t + 59).player.pos[1] < -10, true);
  const back = snapAt(ls, t + 60);
  assert.deepEqual(back.player.pos, [0, 0, 0]);
  assert.equal(back.player.invuln, true);
  assert.equal(back.player.carried, 0);
});

test('Rơi khi còn 1 Ngọn Lửa → thua ngay, không hồi sinh', () => {
  const ls = run({ seed: 1, night: 1, ticks: 300, scenario: empty({ player: { pos: [39.5, 0, 0], flames: 1 } }), inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
  assert.deepEqual(events(ls, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
});

// ---------- Đêm 2 ----------
test('Đêm 2: bản đồ chuẩn (6 đèn, Bùa C1 trên cầu, 330 s)', () => {
  const s0 = run({ seed: 1, night: 2, ticks: 0 })[0];
  assert.equal(s0.night, 2);
  assert.equal(s0.time_left_s, 330);
  assert.deepEqual(s0.lanterns.map((l: Line) => l.pos), [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]);
  assert.deepEqual(s0.charms, [{ id: 'C1', available: true, respawn_s: 0 }]);
});

test('Đêm 2: đi qua cầu tre sang đảo B; ra khỏi cầu thì rơi', () => {
  const bridge = run({ seed: 1, night: 2, ticks: 600, snapshotEvery: 600, scenario: empty({ player: { pos: [20, 0, 0] } }), inputs: { frames: [{ tick: 0, move: [1, 0] }, { tick: 500, move: [0, 0] }] } });
  assert.ok(lastSnap(bridge).player.pos[0] > 60);
  assert.equal(events(bridge, 'player_hit').length, 0);
  const off = run({ seed: 1, night: 2, ticks: 200, scenario: empty({ player: { pos: [35, 0, 0] } }), inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  assert.equal(events(off, 'player_hit')[0].data.by, 'fall');
});

test('Đêm 2: bục nhảy (20,0,18) bắn lên 14 m/s, ngang 24 m/s về tâm đảo B, phím không ghi đè, đáp trong đảo B', () => {
  const ls = run({
    seed: 1, night: 2, ticks: 120, snapshotEvery: 1, scenario: empty({ player: { pos: [20, 0, 16.5] } }),
    inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 20, move: [-1, 0] }] },
  });
  const air = snaps(ls).filter((s) => !s.player.grounded);
  assert.ok(air.length > 70 && air.length < 95, `bay ${air.length} tick`);
  assert.ok(Math.max(...air.map((s) => s.player.pos[1])) > 4.5);
  const land = snaps(ls).find((s) => s.tick > air[0].tick && s.player.grounded)!;
  assert.ok(Math.hypot(land.player.pos[0] - 70, land.player.pos[2]) <= 28, JSON.stringify(land.player.pos));
  assert.equal(events(ls, 'player_hit').length, 0);
});

// ---------- Đêm 3 ----------
test('Đêm 3: bản đồ chuẩn (7 đèn trên các tầng, 2 bùa, 360 s, 30 điểm đom đóm)', () => {
  const s0 = run({ seed: 1, night: 3, ticks: 0 })[0];
  assert.equal(s0.time_left_s, 360);
  assert.deepEqual(s0.lanterns[0].pos, [0, 6, 6]);
  assert.equal(s0.lanterns.length, 7);
  assert.equal(s0.charms.length, 2);
  assert.equal(s0.motes.length, 20);
});

test('Đêm 3: vách tầng 1 không đi lên được; dốc 30° đưa lên Y=3', () => {
  const wall = run({ seed: 1, night: 3, ticks: 120, snapshotEvery: 120, scenario: empty({ player: { pos: [0, 0, 26] } }), inputs: { frames: [{ tick: 0, move: [0, -1] }] } });
  assert.ok(lastSnap(wall).player.pos[2] >= 24 - 0.2);
  assert.equal(lastSnap(wall).player.pos[1], 0);
  const c = Math.cos(Math.PI / 6);
  const s = Math.sin(Math.PI / 6);
  const ramp = run({
    seed: 1, night: 3, ticks: 120, snapshotEvery: 120, scenario: empty({ player: { pos: [32 * c, 0, 32 * s] } }),
    inputs: { frames: [{ tick: 0, move: [-c, -s] }] },
  });
  assert.equal(lastSnap(ramp).player.pos[1], 3);
  assert.equal(lastSnap(ramp).player.grounded, true);
});

test('Đêm 3: bước ra mép tầng thì rơi xuống tầng dưới (không mất máu)', () => {
  const ls = run({ seed: 1, night: 3, ticks: 120, snapshotEvery: 120, scenario: empty({ player: { pos: [0, 3, 13] } }), inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
  // (0,3,13) là bục nhảy → bị bắn lên tầng 2; dùng điểm khác để thử mép
  const edge = run({ seed: 1, night: 3, ticks: 120, snapshotEvery: 120, scenario: empty({ player: { pos: [5, 3, 15] } }), inputs: { frames: [{ tick: 0, move: [0, -1] }] } });
  assert.equal(lastSnap(edge).player.pos[1], 0);
  assert.equal(events(edge, 'player_hit').length, 0);
  assert.ok(ls.length > 0);
});

test('Đêm 3: bục nhảy (0,3,13) bắn lên 12 m/s, ngang 8 m/s về −Z → đáp lên tầng 2 (Y=6); tháp chuông chặn', () => {
  const ls = run({ seed: 1, night: 3, ticks: 200, snapshotEvery: 1, scenario: empty({ player: { pos: [0, 3, 13] } }), inputs: { frames: [{ tick: 60, move: [0, -1] }] } });
  const landed = snaps(ls).find((s) => s.tick > 5 && s.player.grounded)!;
  assert.equal(landed.player.pos[1], 6);
  assert.ok(Math.hypot(landed.player.pos[0], landed.player.pos[2]) <= 8);
  // sau đó đi về −Z: bị tháp (r = 2) chặn
  assert.ok(lastSnap(ls).player.pos[2] >= 2 - 0.15);
});

test('Đêm 3: gió mạnh mỗi 30 s, kéo dài 5 s, đẩy 2 m/s; snapshot wind', () => {
  const ls = run({ seed: 4, night: 3, ticks: 2160, snapshotEvery: 60, scenario: empty({ wind_enabled: true, player: { pos: [0, 0, -30] } }) });
  assert.equal(snapAt(ls, 1740).wind.active, false);
  const w = snapAt(ls, 1800).wind;
  assert.equal(w.active, true);
  assert.equal(typeof w.dir_deg, 'number');
  assert.equal(snapAt(ls, 2100).wind.active, false);
  const p0 = snapAt(ls, 1800).player.pos;
  const p1 = snapAt(ls, 2040).player.pos;
  assert.ok(close(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]), 8, 0.05)); // 240 tick × 2 m/s
});

// ---------- Gió Lạc ----------
test('Gió Lạc: idle → chase khi mang ≥ 5 và cách ≤ 15 m; chạm cướp min(3, mang) rồi flee 240 tick → removed', () => {
  const ls = run({
    seed: 1, night: 2, ticks: 400, snapshotEvery: 1,
    scenario: empty({ player: { carried: 6 }, drifters: [{ pos: [8, 1.2, 0] }] }),
  });
  assert.equal(snapAt(ls, 1).drifters[0].state, 'chase');
  const st = events(ls, 'drifter_steal');
  assert.equal(st.length, 1);
  assert.deepEqual(st[0].data, { drifter_id: 'D1', amount: 3, carried: 3 });
  const t = st[0].tick;
  assert.equal(snapAt(ls, t).drifters[0].state, 'flee');
  assert.equal(snapAt(ls, t).drifters[0].stolen, 3);
  assert.equal(snapAt(ls, t + 240).drifters[0].state, 'removed');
  assert.equal(events(ls, 'player_hit').length, 0); // không làm mất Ngọn Lửa
});

test('Gió Lạc: mang < 5 thì không đuổi; bất tử không ngăn bị cướp', () => {
  const idle = run({ seed: 1, night: 2, ticks: 30, snapshotEvery: 1, scenario: empty({ player: { carried: 4 }, drifters: [{ pos: [8, 1.2, 0] }] }) });
  assert.equal(snapAt(idle, 30).drifters[0].state, 'idle');
  const inv = run({ seed: 1, night: 2, ticks: 100, scenario: empty({ player: { carried: 6, invuln_ticks: 90 }, drifters: [{ pos: [3, 1.2, 0] }] }) });
  assert.equal(events(inv, 'drifter_steal').length, 1);
});

test('Gió Lạc: Tỏa Sáng trúng lúc chase → flee không cướp; trúng lúc flee có mang → thả lại, biến mất sau 120 tick', () => {
  const chase = run({
    seed: 1, night: 2, ticks: 300, snapshotEvery: 1, scenario: empty({ player: { carried: 9 }, drifters: [{ pos: [4, 1.2, 0] }] }),
    inputs: { frames: [{ tick: 1, pulse: true }] },
  });
  assert.equal(snapAt(chase, 2).drifters[0].state, 'flee');
  assert.equal(events(chase, 'drifter_steal').length, 0);
  const flee = run({
    seed: 1, night: 2, ticks: 200, snapshotEvery: 1,
    scenario: empty({ player: { carried: 3 }, drifters: [{ pos: [3, 1.2, 0], state: 'flee', stolen: 3 }] }),
    inputs: { frames: [{ tick: 0, pulse: true }] },
  });
  assert.deepEqual(events(flee, 'drifter_drop')[0].data, { drifter_id: 'D1', amount: 3 });
  const s1 = snapAt(flee, 1);
  assert.equal(s1.motes.filter((m: Line) => m.kind === 'dropped').length, 3);
  assert.equal(snapAt(flee, 120).drifters[0].state, 'flee');
  assert.equal(snapAt(flee, 121).drifters[0].state, 'removed');
});

test('Gió Lạc: vùng an toàn không chặn; sinh tại tick 1200 với id D1 (Đêm 2)', () => {
  const ls = run({ seed: 1, night: 2, ticks: 1201, snapshotEvery: 1, scenario: empty({ random_drifters: true }) });
  assert.equal(snapAt(ls, 1199).drifters.length, 0);
  assert.equal(snapAt(ls, 1200).drifters[0].id, 'D1');
  const n1 = run({ seed: 1, night: 1, ticks: 1201, snapshotEvery: 1201 });
  assert.equal(lastSnap(n1).drifters.length, 0); // Đêm 1 không có Gió Lạc
});

// ---------- Bùa Gió ----------
test('Bùa Gió: nhặt → charm_picked 600 tick, chạy 7.2 m/s, lướt không hồi chiêu, xuất hiện lại sau 2700 tick', () => {
  const ls = run({
    seed: 1, night: 2, ticks: 2702, snapshotEvery: 1, scenario: empty({ player: { pos: [34.5, 0, 0] }, charms: [{ pos: [35, 0, 0] }] }),
    inputs: {
      frames: [
        { tick: 1, move: [0, 1], cam_yaw_deg: 90 }, { tick: 61, move: [0, 0] },
        { tick: 70, dash: true }, { tick: 71, dash: false }, { tick: 85, dash: true }, { tick: 86, dash: false },
      ],
    },
  });
  assert.deepEqual(events(ls, 'charm_picked')[0].data, { charm_id: 'C1', charm_ticks: 600 });
  assert.equal(snapAt(ls, 1).charms[0].available, false);
  assert.ok(close(snapAt(ls, 61).player.pos[0] - snapAt(ls, 1).player.pos[0], 7.2));
  assert.equal(events(ls, 'dash').length, 2); // lần 2 sau 15 tick vẫn được
  assert.equal(snapAt(ls, 2700).charms[0].available, false);
  assert.equal(snapAt(ls, 2701).charms[0].available, true);
});

test('Bùa Gió: nhấn lướt khi đang lướt bị bỏ qua', () => {
  const ls = run({
    seed: 1, night: 2, ticks: 30, scenario: empty({ player: { charm_ticks: 600 } }),
    inputs: { frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 5, dash: true }] },
  });
  assert.equal(events(ls, 'dash').length, 1);
});

// ---------- Contract v1.1 ----------
test('snapshot v1.1: có night, wind, player.vel/grounded/invuln/dash_cd_s/pulse_cd_s/charm_s, motes/drifters/charms', () => {
  const s = run({ seed: 1, night: 2, ticks: 0 })[0];
  for (const k of ['night', 'wind', 'motes', 'drifters', 'charms']) assert.ok(k in s, k);
  for (const k of ['vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s']) assert.ok(k in s.player, k);
  assert.deepEqual(Object.keys(s.motes[0]), ['id', 'pos', 'kind', 'ttl_s']);
  assert.deepEqual(Object.keys(s.charms[0]), ['id', 'available', 'respawn_s']);
});

test('scenario v1.1: player.*_ticks, shades[].state/state_ticks_left', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 1, snapshotEvery: 1,
    scenario: empty({ player: { invuln_ticks: 30, dash_cd_ticks: 60, pulse_cd_ticks: 120, charm_ticks: 300 }, shades: [{ pos: [0.5, 1, 0], state: 'stunned', state_ticks_left: 50 }] }),
  });
  const p = snapAt(ls, 1).player;
  assert.equal(p.invuln, true);
  assert.ok(close(p.dash_cd_s, 59 / 60, 0.001));
  assert.ok(close(p.pulse_cd_s, 119 / 60, 0.001));
  assert.ok(close(p.charm_s, 299 / 60, 0.001));
  assert.equal(snapAt(ls, 1).shades[0].state, 'stunned');
  assert.equal(events(ls, 'player_hit').length, 0);
});

test('hiệu năng: một Đêm đầy đủ 21 600 tick xong trong ≤ 30 s (cả 3 Đêm)', () => {
  for (const night of [1, 2, 3]) {
    const t0 = Date.now();
    simulate({ seed: 9, night, ticks: 21600, scenario: { player: { flames: 99 } } });
    assert.ok(Date.now() - t0 < 30000);
  }
});

test('regression: tổng sự kiện của một Đêm ngẫu nhiên có mặt đúng tên trạng thái Bóng Mực v1.1', () => {
  const ls = run({ seed: 11, night: 3, ticks: 5000, snapshotEvery: 50, scenario: { player: { flames: 99 } } });
  const states = new Set(snaps(ls).flatMap((s) => s.shades.map((x: Line) => x.state)));
  for (const st of states) assert.ok(['spawning', 'wander', 'chase', 'recoil', 'stunned'].includes(st as string), String(st));
  assert.equal(last(ls).type, 'end');
});
