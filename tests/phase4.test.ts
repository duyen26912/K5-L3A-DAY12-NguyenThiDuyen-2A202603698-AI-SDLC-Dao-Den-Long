// Ticket-04 "Bình minh: phát hành v1.0.0" (Contract v1.3): cảnh benchmark, soak, bảng xếp hạng, đổi phím.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { buildSync } from 'esbuild';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBenchWorld, BENCH_SHADES, BENCH_MOTES, BENCH_ISLAND_R } from '../src/core/bench';
import { step, neutralInput } from '../src/core/world';
import { addEntry, sortEntries, validateName, parseEntries, isoWithOffset, MAX_ENTRIES, LeaderboardEntry } from '../src/core/leaderboard';
import { submitEntry, loadEntries, exportTo, handleApi } from '../src/leaderboard-store';
import { DEFAULT_BINDINGS, ACTIONS, rebind, findConflict, parseBindings, keyMap, clearSlot, keyLabel } from '../src/core/keybinds';
import { runNight } from '../src/soak';
import { createWorld } from '../src/core/world';

const contract = JSON.parse(readFileSync('game.contract.json', 'utf8'));
const tmp = mkdtempSync(join(tmpdir(), 'ddl4-'));

// ---------- 6. Contract v1.3 ----------
test('contract v1.3 có bench_cmd và soak_cmd, giữ các lệnh cũ', () => {
  assert.equal(contract.contract_version, '1.3');
  assert.equal(contract.bench_cmd, 'node scripts/bench.mjs');
  assert.equal(contract.soak_cmd, 'node --expose-gc --max-semi-space-size=1 --no-opt dist-headless/soak.mjs');
  assert.ok(contract.headless_cmd && contract.run_cmd);
});

// ---------- 1. Cảnh benchmark ----------
test('bench: Đêm 1, đúng 200 Bóng Mực wander rải trên đảo + 100 đom đóm, L1–L3 sáng fuel 100, Mây ở (0,0,0)', () => {
  const w = createBenchWorld(42);
  assert.equal(w.night, 1);
  assert.equal(w.shades.length, BENCH_SHADES);
  assert.equal(w.motes.length, BENCH_MOTES);
  assert.ok(w.shades.every((s) => s.state === 'wander' && Math.hypot(s.pos[0], s.pos[2]) <= BENCH_ISLAND_R));
  assert.deepEqual(w.lanterns.slice(0, 3).map((l) => [l.id, l.lit, l.fuelU / 60]), [['L1', true, 100], ['L2', true, 100], ['L3', true, 100]]);
  assert.deepEqual(w.player.pos, [0, 0, 0]);
  // rải đều: mỗi góc phần tư có khoảng 1/4 số Bóng Mực
  const q = [0, 0, 0, 0];
  for (const s of w.shades) q[(s.pos[0] >= 0 ? 0 : 1) + (s.pos[2] >= 0 ? 0 : 2)]++;
  assert.ok(q.every((n) => n > 30 && n < 70), `phân bố ${q}`);
});

test('bench: cùng seed → cùng cảnh; seed khác → khác', () => {
  const a = createBenchWorld(42).shades.map((s) => s.pos.join());
  assert.deepEqual(createBenchWorld(42).shades.map((s) => s.pos.join()), a);
  assert.notDeepEqual(createBenchWorld(43).shades.map((s) => s.pos.join()), a);
});

test('bench: chạy 60 s không sinh thêm, không sát thương, không nhặt, không hao dầu, không kết thúc; Bóng Mực vẫn di chuyển', () => {
  const w = createBenchWorld(42);
  const start = w.shades.map((s) => [...s.pos]);
  for (let i = 0; i < 3600; i++) {
    const ev = step(w, neutralInput());
    assert.ok(!ev.some((e) => ['shade_spawned', 'player_hit', 'mote_picked', 'lantern_out', 'game_over'].includes(e.name)), `tick ${i}: ${ev.map((e) => e.name)}`);
  }
  assert.equal(w.state, 'playing');
  assert.equal(w.shades.length, BENCH_SHADES);
  assert.equal(w.motes.length, BENCH_MOTES);
  assert.ok(w.lanterns.slice(0, 3).every((l) => l.lit && l.fuelU === 100 * 60));
  assert.equal(w.player.flames, contract.tuning.flames);
  const moved = w.shades.filter((s, i) => Math.hypot(s.pos[0] - start[i][0], s.pos[2] - start[i][2]) > 0.5).length;
  assert.ok(moved > 150, `chỉ ${moved} Bóng Mực di chuyển`);
});

test('chế độ thường không bị ảnh hưởng bởi cờ bench (mode mặc định tắt hết)', () => {
  const w = createWorld(1, 1);
  assert.deepEqual(w.mode, { noSpawn: false, noDamage: false, noPickup: false, noFuelDecay: false, noEnd: false });
});

// ---------- 2. Soak ----------
test('soak: runNight tất định và luôn kết thúc (won/lost)', () => {
  const r1 = runNight(createWorld(8, 1), 8);
  const r2 = runNight(createWorld(8, 1), 8);
  assert.equal(r1, r2);
  assert.ok(['won', 'lost'].includes(r1));
});

test('soak CLI: 3 Đêm, đúng định dạng, crashes 0, thoát 0', () => {
  const bin = join(tmp, 'soak.mjs');
  buildSync({ entryPoints: ['src/soak.ts'], bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile: bin, logLevel: 'warning' });
  const out = join(tmp, 'soak.json');
  const r = spawnSync(process.execPath, ['--expose-gc', '--max-semi-space-size=1', '--no-opt', bin, '--seed', '7', '--nights', '3', '--out', out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const s = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(s.nights, 3);
  assert.equal(s.crashes, 0);
  assert.equal(s.results.length, 3);
  assert.ok(s.results.every((x: string) => x === 'won' || x === 'lost'));
  for (const k of ['mem_start_mb', 'mem_end_mb', 'duration_s']) assert.equal(typeof s[k], 'number');
});

// ---------- 3. Bảng xếp hạng ----------
const E = (name: string, score: number, at: string, nights_won = 1): LeaderboardEntry => ({ name, score, nights_won, achieved_at: at, seed: 1 });

test('tên: 3–12 ký tự chữ/số/_ ; tiếng Việt có dấu được chấp nhận', () => {
  for (const ok of ['abc', 'Player_01', 'A23456789012', 'Mây', 'Nguyễn_Duyên']) assert.equal(validateName(ok), null, ok);
  for (const bad of ['ab', 'A234567890123', 'có cách', 'a-b-c', '', 'x!y']) assert.notEqual(validateName(bad), null, bad);
  // dạng tổ hợp (NFD) đếm như dạng dựng sẵn
  assert.equal(validateName('Mây'.normalize('NFD')), null);
});

test('sắp xếp: điểm giảm dần; bằng điểm ai đạt trước đứng trên; giữ top 10', () => {
  const list = sortEntries([
    E('bbb', 100, '2026-11-20T10:00:05+07:00'), E('aaa', 100, '2026-11-20T10:00:01+07:00'),
    E('ccc', 300, '2026-11-20T11:00:00+07:00'), E('ddd', 50, '2026-11-19T09:00:00+07:00'),
  ]);
  assert.deepEqual(list.map((e) => e.name), ['ccc', 'aaa', 'bbb', 'ddd']);
  // so sánh theo thời điểm thật, kể cả khác múi giờ: 03:00Z sớm hơn 10:00:01+07:00 (= 03:00:01Z)
  assert.deepEqual(sortEntries([E('late', 1, '2026-11-20T10:00:01+07:00'), E('early', 1, '2026-11-20T03:00:00Z')]).map((e) => e.name), ['early', 'late']);
  let big: LeaderboardEntry[] = [];
  for (let i = 0; i < 15; i++) big = addEntry(big, E(`p_${i}`, i * 10, `2026-11-20T10:00:${String(i).padStart(2, '0')}+07:00`));
  assert.equal(big.length, MAX_ENTRIES);
  assert.equal(big[0].name, 'p_14');
  assert.equal(big.at(-1)!.name, 'p_5');
});

test('addEntry từ chối dữ liệu sai; parseEntries bỏ mục hỏng', () => {
  assert.throws(() => addEntry([], E('ab', 1, '2026-11-20T10:00:00+07:00')));
  assert.throws(() => addEntry([], E('abc', 1, '2026-11-20T10:00:00+07:00', 4)));
  assert.throws(() => addEntry([], E('abc', -1, '2026-11-20T10:00:00+07:00')));
  const parsed = parseEntries({ entries: [E('good', 5, '2026-11-20T10:00:00+07:00'), { name: 'x' }, null, E('no', 1, 'x')] });
  assert.deepEqual(parsed.map((e) => e.name), ['good']);
  assert.deepEqual(parseEntries('rác'), []);
});

test('isoWithOffset: ISO 8601 có múi giờ, đọc lại đúng thời điểm', () => {
  const d = new Date('2026-11-20T03:04:05Z');
  const s = isoWithOffset(d);
  assert.match(s, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  assert.equal(Date.parse(s), d.getTime());
});

test('lưu đĩa: ghi rồi đọc lại (còn sau khi "tắt game"), xuất {"entries": [...]} đúng thứ tự, API GET/POST', () => {
  const file = join(tmp, 'lb', 'leaderboard.json');
  submitEntry({ name: 'Mây', score: 120, nights_won: 1, seed: 5 }, file);
  submitEntry({ name: 'top_one', score: 900, nights_won: 3, seed: 6 }, file);
  assert.throws(() => submitEntry({ name: 'x', score: 1, nights_won: 0, seed: 1 }, file));
  const again = loadEntries(file); // tiến trình mới đọc lại file
  assert.deepEqual(again.map((e) => [e.name, e.score, e.nights_won, e.seed]), [['top_one', 900, 3, 6], ['Mây', 120, 1, 5]]);
  const out = join(tmp, 'out.json');
  exportTo(out, file);
  const ex = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(Object.keys(ex), ['entries']);
  assert.deepEqual(ex.entries.map((e: LeaderboardEntry) => e.name), ['top_one', 'Mây']);
  assert.deepEqual(Object.keys(ex.entries[0]).sort(), ['achieved_at', 'name', 'nights_won', 'score', 'seed']);
  // file hỏng → bảng rỗng, không lỗi
  writeFileSync(file, '{hỏng');
  assert.deepEqual(loadEntries(file), []);
  assert.equal(handleApi('DELETE', '').status, 405);
  assert.equal(handleApi('POST', '{"name":"a","score":1,"nights_won":0,"seed":1}').status, 400);
});

test('lệnh xuất: <run_cmd> --export-leaderboard out.json', () => {
  buildSync({ entryPoints: ['src/leaderboard-store.ts'], bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile: join('dist-headless', 'leaderboard.mjs'), logLevel: 'warning' });
  const dir = join(tmp, 'exp');
  const env = { ...process.env, DDL_DATA_DIR: dir };
  submitEntry({ name: 'second', score: 10, nights_won: 0, seed: 1 }, join(dir, 'leaderboard.json'));
  submitEntry({ name: 'first', score: 20, nights_won: 1, seed: 2 }, join(dir, 'leaderboard.json'));
  const out = join(tmp, 'export.json');
  const [cmd, ...args] = contract.run_cmd.split(' ');
  const r = spawnSync(cmd === 'node' ? process.execPath : cmd, [...args, '--export-leaderboard', out], { encoding: 'utf8', env });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')).entries.map((e: LeaderboardEntry) => e.name), ['first', 'second']);
});

// ---------- 4. Đổi phím ----------
test('phím mặc định: đủ 9 hành động, không trùng', () => {
  assert.deepEqual([...ACTIONS], ['up', 'down', 'left', 'right', 'jump', 'dash', 'interact', 'pulse', 'pause']);
  const all = ACTIONS.flatMap((a) => DEFAULT_BINDINGS[a]).filter(Boolean);
  assert.equal(new Set(all).size, all.length);
  assert.equal(keyMap(DEFAULT_BINDINGS).get('KeyW'), 'up');
});

test('đổi phím: gán phím mới; trùng hành động khác → báo, không gán; phím giao diện bị chặn', () => {
  const r = rebind(DEFAULT_BINDINGS, 'jump', 0, 'KeyJ');
  assert.ok(r.ok);
  if (r.ok) assert.equal(keyMap(r.bindings).get('KeyJ'), 'jump');
  assert.equal(DEFAULT_BINDINGS.jump[0], 'Space'); // không sửa bảng gốc
  const dup = rebind(DEFAULT_BINDINGS, 'jump', 0, 'KeyE');
  assert.equal(dup.ok, false);
  if (!dup.ok) { assert.equal(dup.reason, 'duplicate'); assert.equal(dup.conflict, 'interact'); assert.match(dup.message, /Tương tác/); }
  const res = rebind(DEFAULT_BINDINGS, 'pulse', 0, 'KeyH');
  assert.equal(res.ok, false);
  // cùng hành động ở ô kia → chuyển ô, không coi là trùng
  const sw = rebind(DEFAULT_BINDINGS, 'up', 1, 'ArrowUp');
  assert.ok(sw.ok);
  if (sw.ok) assert.deepEqual(sw.bindings.up, ['', 'ArrowUp']);
  assert.deepEqual(findConflict(DEFAULT_BINDINGS, 'KeyQ'), { action: 'pulse', slot: 0 });
});

test('xóa ô phụ được; ô chính không để trống', () => {
  assert.deepEqual(clearSlot(DEFAULT_BINDINGS, 'up', 1).up, ['ArrowUp', '']);
  assert.deepEqual(clearSlot(DEFAULT_BINDINGS, 'up', 0).up, ['KeyW', '']);
  assert.deepEqual(clearSlot(DEFAULT_BINDINGS, 'jump', 0).jump, ['Space', '']);
});

test('đọc phím đã lưu: hợp lệ → dùng; hỏng/trùng/thiếu → mặc định ("Khôi phục mặc định")', () => {
  const r = rebind(DEFAULT_BINDINGS, 'dash', 0, 'KeyF');
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(parseBindings(JSON.parse(JSON.stringify(r.bindings))), r.bindings);
  assert.deepEqual(parseBindings(null), DEFAULT_BINDINGS);
  assert.deepEqual(parseBindings({ up: ['KeyE', ''] }), DEFAULT_BINDINGS);
  const dupe = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  dupe.jump = ['KeyE', ''];
  assert.deepEqual(parseBindings(dupe), DEFAULT_BINDINGS);
  assert.equal(keyLabel('KeyW'), 'W');
  assert.equal(keyLabel('ArrowLeft'), '←');
});
