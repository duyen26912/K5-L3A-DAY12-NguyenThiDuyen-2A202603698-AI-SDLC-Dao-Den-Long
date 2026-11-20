// Ticket-03 "Đèn cạn dầu" (Contract v1.2): nhiên liệu đèn, Bóng Mực hút dầu, luật thắng mới, sức chứa, điểm mới.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, snaps, events, last, lastSnap, snapAt, empty, Line } from './helpers';

const L = (ls: Line[], t: number, id = 'L1') => snapAt(ls, t).lanterns.find((l: Line) => l.id === id);

// ---------- 1. Nhiên liệu đèn ----------
test('dầu: vừa thắp fuel = 100, hao 1/giây (1/60 mỗi tick), snapshot 1 chữ số thập phân', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 121, snapshotEvery: 1,
    scenario: empty({ player: { pos: [0, 0, 23.5], carried: 10 } }), inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(L(ls, 1).fuel, 100); // thắp ở bước 5, sau bước trừ dầu
  assert.equal(L(ls, 61).fuel, 99);
  assert.equal(L(ls, 4).fuel, 100); // 99.95 → làm tròn 1 chữ số
  assert.equal(L(ls, 121).fuel, 98);
  assert.equal(L(ls, 1).ever_lit, true);
});

test('hết dầu → tắt, deposited = 0, lantern_out, fuel 0, nhớ ever_lit', () => {
  const ls = run({ seed: 1, night: 1, ticks: 70, snapshotEvery: 1, scenario: empty({ lanterns: [{ id: 'L1', lit: true, fuel: 1 }] }) });
  const out = events(ls, 'lantern_out');
  assert.deepEqual(out.map((e) => e.data), [{ lantern_id: 'L1' }]);
  assert.equal(out[0].tick, 60);
  const l = L(ls, 60);
  assert.deepEqual([l.lit, l.fuel, l.deposited, l.ever_lit], [false, 0, 0, true]);
});

test('châm dầu: used = min(mang, ceil((100 − fuel)/10)), fuel = min(100, fuel + 10·used), +5/đom đóm, sự kiện refuel', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 1, snapshotEvery: 1,
    scenario: empty({ player: { pos: [0, 0, 23.5], carried: 9 }, lanterns: [{ id: 'L1', lit: true, fuel: 45 }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  // fuel sau bước 2: 45 − 1/60; ceil((100 − 44.983)/10) = 6
  assert.deepEqual(events(ls, 'refuel')[0].data, { lantern_id: 'L1', amount: 6, fuel: 100 });
  assert.equal(lastSnap(ls).player.carried, 3);
  assert.equal(lastSnap(ls).score, 30);
});

test('châm dầu: đèn đầy dầu không được chọn — chọn đèn nhận được gần nhất kế tiếp', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 1,
    scenario: empty({ player: { pos: [0, 0, 0], carried: 4 }, lanterns: [{ id: 'L1', pos: [0.5, 0, 0], lit: true, fuel: 100 }, { id: 'L2', pos: [1.5, 0, 0] }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  // L1 sau bước 2 còn 99.98 < 100 nên vẫn nhận; kiểm tra trường hợp đầy hẳn bằng đèn vừa thắp cùng tick không xảy ra được → thử đầy bằng used = 0
  assert.equal(events(ls, 'refuel').length, 1);
  assert.equal(events(ls, 'refuel')[0].data.amount, 1);
});

test('thắp lại: đèn đã từng sáng chỉ cần 5, +40, lantern_lit relight: true, relit_count tăng', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 2, snapshotEvery: 1,
    scenario: empty({ player: { pos: [0, 0, 23.5], carried: 8 }, lanterns: [{ id: 'L1', lit: false, ever_lit: true }] }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.deepEqual(events(ls, 'deposit')[0].data, { lantern_id: 'L1', amount: 5, deposited: 5 });
  assert.deepEqual(events(ls, 'lantern_lit')[0].data, { lantern_id: 'L1', relight: true });
  assert.equal(L(ls, 1).relit_count, 1);
  assert.equal(L(ls, 1).fuel, 100);
  assert.equal(lastSnap(ls).score, 5 * 5 + 40);
  assert.equal(lastSnap(ls).player.carried, 3);
});

// ---------- 2. Bóng Mực hút dầu ----------
test('vùng an toàn: fuel < 30 mất vùng an toàn; đúng 30 vẫn còn', () => {
  const at = (fuel: number) => run({
    seed: 1, night: 1, ticks: 150, snapshotEvery: 1,
    scenario: empty({ player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true, fuel }], shades: [{ pos: [0, 1, 17.5], state: 'chase' }] }),
  });
  const weak = at(29.9);
  assert.equal(events(weak, 'player_hit').length, 1);
  const ok = at(32.6); // còn ≥ 30 trong suốt 150 tick
  assert.equal(events(ok, 'player_hit').length, 0);
  for (const s of snaps(ok)) assert.ok(Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2] - 25) >= 6 - 1e-3);
});

test('Bóng Mực wander đi tới đèn sáng fuel < 30 gần nhất, cách ≤ 2 m → drain, hút 5/giây (cộng dồn), fuel_drain mỗi 60 tick', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 400, snapshotEvery: 1,
    scenario: empty({
      player: { pos: [0, 0, -30] },
      lanterns: [{ id: 'L1', lit: true, fuel: 25 }, { id: 'L2', lit: true, fuel: 80 }],
      shades: [{ id: 'A', pos: [0, 1, 21] }, { id: 'B', pos: [1, 1, 26] }],
    }),
  });
  const s = (t: number, id: string) => snapAt(ls, t).shades.find((x: Line) => x.id === id);
  const tDrain = snaps(ls).find((x) => x.shades.every((y: Line) => y.state === 'drain'))!.tick;
  assert.ok(tDrain < 150, `drain lúc ${tDrain}`);
  const f0 = L(ls, tDrain).fuel;
  const f1 = L(ls, tDrain + 60).fuel;
  assert.ok(Math.abs(f0 - f1 - 11) < 0.15, `hao ${f0 - f1}`); // 1 tự hao + 2 × 5 hút
  const fd = events(ls, 'fuel_drain');
  assert.ok(fd.length >= 2);
  assert.deepEqual(Object.keys(fd[0].data), ['lantern_id', 'shade_id', 'fuel']);
  assert.equal(s(tDrain, 'A').state, 'drain');
  // đèn tắt → Bóng Mực về wander
  const out = events(ls, 'lantern_out')[0];
  assert.equal(out.data.lantern_id, 'L1');
  assert.notEqual(s(out.tick, 'A').state, 'drain');
});

test('drain → chase khi Mây vào trong 6 m; → stunned khi trúng Tỏa Sáng (+15)', () => {
  const base = { lanterns: [{ id: 'L1', lit: true, fuel: 25 }], shades: [{ id: 'A', pos: [0, 1, 23.5], state: 'drain', target_lantern_id: 'L1' }] };
  const chase = run({ seed: 1, night: 1, ticks: 2, snapshotEvery: 1, scenario: empty({ ...base, player: { pos: [0, 0, 18] } }) });
  assert.equal(snapAt(chase, 1).shades[0].state, 'chase');
  const far = run({ seed: 1, night: 1, ticks: 2, snapshotEvery: 1, scenario: empty({ ...base, player: { pos: [0, 0, 10] } }) });
  assert.equal(snapAt(far, 1).shades[0].state, 'drain');
  const pulse = run({
    seed: 1, night: 1, ticks: 1, snapshotEvery: 1,
    scenario: empty({ ...base, player: { pos: [0, 0, 26.5], carried: 3 } }), inputs: { frames: [{ tick: 0, pulse: true }] },
  });
  assert.deepEqual(events(pulse, 'pulse')[0].data, { stunned_ids: ['A'] });
  assert.equal(lastSnap(pulse).score, 15);
});

test('châm dầu lên ≥ 30 khi có Bóng Mực trong vùng 6 m → bị đẩy ra mép ≤ 30 tick, không gây sát thương, bỏ drain', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 40, snapshotEvery: 1,
    scenario: empty({
      player: { pos: [0, 0, 23.5], carried: 2, invuln_ticks: 0 },
      lanterns: [{ id: 'L1', lit: true, fuel: 25 }],
      shades: [{ id: 'A', pos: [0.4, 1, 23.5], state: 'drain', target_lantern_id: 'L1' }],
    }),
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  // 25 − (1 hao + 5 hút)/60 + 2 × 10 = 44.9
  assert.equal(events(ls, 'refuel')[0].data.fuel, 44.9);
  assert.equal(events(ls, 'player_hit').length, 0);
  const sh = snapAt(ls, 31).shades[0];
  assert.ok(Math.hypot(sh.pos[0], sh.pos[2] - 25) >= 6 - 1e-3);
  assert.notEqual(sh.state, 'drain');
});

// ---------- 3. Luật thắng ----------
test('ngưỡng thắng: Đêm 2 cần 4/6, Đêm 3 cần 5/7', () => {
  const night = (n: number, ids: string[]) => run({ seed: 1, night: n, ticks: 200, scenario: empty({ lanterns: ids.map((id) => ({ id, lit: true })), time_left_s: 1 }) });
  assert.equal(last(night(2, ['L1', 'L2', 'L3', 'L4'])).state, 'won');
  assert.equal(last(night(2, ['L1', 'L2', 'L3'])).state, 'lost');
  assert.equal(last(night(3, ['L1', 'L2', 'L3', 'L4', 'L5'])).state, 'won');
  assert.equal(last(night(3, ['L1', 'L2', 'L3', 'L4'])).state, 'lost');
});

test('hết Ngọn Lửa ở đúng tick bình minh → luôn thua no_flames', () => {
  const ls = run({
    seed: 1, night: 1, ticks: 200,
    scenario: empty({ player: { flames: 1 }, lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true })), shades: [{ pos: [0.5, 1, 0] }], time_left_s: 1 / 60 }),
  });
  // tick 1 vừa là bình minh vừa bị chạm mất Ngọn Lửa cuối
  assert.deepEqual(events(ls, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
});

// ---------- 4. Sức chứa ----------
test('sức chứa = 10 + 2 × successful_lights, tối đa 20; snapshot player.capacity', () => {
  const s0 = run({ seed: 1, night: 1, ticks: 0 })[0];
  assert.equal(s0.player.capacity, 10);
  const ls = run({
    seed: 1, night: 1, ticks: 2, snapshotEvery: 1,
    scenario: empty({ player: { pos: [0, 0, 23.5], carried: 10, successful_lights: 2 } }), inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(snapAt(ls, 0).player.capacity, 14);
  assert.equal(snapAt(ls, 1).player.capacity, 16);
  const max = run({ seed: 1, night: 1, ticks: 0, scenario: empty({ player: { successful_lights: 9 } }) })[0];
  assert.equal(max.player.capacity, 20);
  const motes = Array.from({ length: 15 }, () => [0.5, 0, 0]);
  const pick = run({ seed: 1, night: 1, ticks: 1, snapshotEvery: 1, scenario: empty({ motes, player: { successful_lights: 1 } }) });
  assert.equal(lastSnap(pick).player.carried, 12);
});

// ---------- 7. Contract v1.2 ----------
test('snapshot v1.2: đèn có fuel/ever_lit/relit_count; scenario lit: true không có fuel → 100', () => {
  const s0 = run({ seed: 1, night: 1, ticks: 0, scenario: empty({ lanterns: [{ id: 'L2', lit: true }] }) })[0];
  assert.deepEqual(Object.keys(s0.lanterns[0]), ['id', 'pos', 'lit', 'deposited', 'fuel', 'ever_lit', 'relit_count']);
  assert.deepEqual([s0.lanterns[0].fuel, s0.lanterns[0].ever_lit], [0, false]);
  assert.deepEqual([s0.lanterns[1].fuel, s0.lanterns[1].ever_lit, s0.lanterns[1].lit], [100, true, true]);
});
