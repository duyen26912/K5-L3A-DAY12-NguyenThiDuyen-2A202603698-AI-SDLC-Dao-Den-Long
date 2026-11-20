// Test CLI headless thật (dist-headless/headless.mjs) đúng như giảng viên chạy.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { buildSync } from 'esbuild';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BIN = join('dist-headless', 'headless.mjs');
const SC = join('tests', 'scenarios');
const tmp = mkdtempSync(join(tmpdir(), 'ddl-'));

before(() => {
  // build lại bản headless từ mã hiện tại để test luôn khớp mã nguồn
  buildSync({ entryPoints: ['src/headless.ts'], bundle: true, platform: 'node', format: 'esm', target: 'node18', outfile: BIN, logLevel: 'warning' });
});

function runCli(args: string[]) {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });
}

test('CLI: ví dụ trong Test Contract chạy được, thoát 0, có end ở dòng cuối', () => {
  const out = join(tmp, 'ex.jsonl');
  const r = runCli(['--seed', '1', '--night', '1', '--scenario', join(SC, 'contract-example.scenario.json'),
    '--inputs', join(SC, 'contract-example.inputs.json'), '--ticks', '300', '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  const lines = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines[0].type, 'snapshot');
  assert.equal(lines[0].tick, 0);
  assert.equal(lines.at(-1).type, 'end');
  assert.equal(lines.filter((l) => l.type === 'snapshot').length, 31); // tick 0,10,…,300
  assert.ok(lines.some((l) => l.type === 'event' && l.name === 'mote_picked'));
});

test('CLI: chạy hai lần cùng tham số → file giống hệt', () => {
  const a = join(tmp, 'a.jsonl');
  const b = join(tmp, 'b.jsonl');
  for (const out of [a, b]) {
    assert.equal(runCli(['--seed', '99', '--night', '1', '--ticks', '3000', '--out', out]).status, 0);
  }
  assert.equal(readFileSync(a, 'utf8'), readFileSync(b, 'utf8'));
});

test('CLI: scenario sai định dạng → mã thoát 2 và báo lỗi ra stderr', () => {
  const bad = join(tmp, 'bad.json');
  writeFileSync(bad, '{ "player": { "pos": [0, 0] } }');
  const r = runCli(['--seed', '1', '--night', '1', '--scenario', bad, '--ticks', '10', '--out', join(tmp, 'x.jsonl')]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /player\.pos/);
  const notJson = join(tmp, 'nj.json');
  writeFileSync(notJson, 'not json');
  assert.equal(runCli(['--seed', '1', '--night', '1', '--inputs', notJson, '--ticks', '10', '--out', join(tmp, 'y.jsonl')]).status, 2);
});

test('CLI: inputs có tick không tăng nghiêm ngặt hoặc move ngoài [-1,1] → mã 2', () => {
  const f1 = join(tmp, 'i1.json');
  writeFileSync(f1, JSON.stringify({ frames: [{ tick: 5 }, { tick: 5 }] }));
  assert.equal(runCli(['--seed', '1', '--night', '1', '--inputs', f1, '--ticks', '10', '--out', join(tmp, 'z.jsonl')]).status, 2);
  const f2 = join(tmp, 'i2.json');
  writeFileSync(f2, JSON.stringify({ frames: [{ tick: 0, move: [2, 0] }] }));
  assert.equal(runCli(['--seed', '1', '--night', '1', '--inputs', f2, '--ticks', '10', '--out', join(tmp, 'z.jsonl')]).status, 2);
});

test('CLI: thiếu tham số bắt buộc → mã khác 0', () => {
  const r = runCli(['--seed', '1', '--night', '1', '--out', join(tmp, 'q.jsonl')]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /ticks/);
});
