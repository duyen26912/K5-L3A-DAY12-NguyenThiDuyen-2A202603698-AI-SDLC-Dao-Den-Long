// Chạy các scenario headless bằng đúng lệnh trong game.contract.json, kiểm tra kết quả mong đợi,
// kiểm tra tính tất định (chạy 2 lần so sánh) và lưu bằng chứng vào docs/proof/<phase>/.
// Chạy: npm run build:headless && npm run verify [-- phase-1]
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

const phase = process.argv[2] ?? 'phase-1';
const outDir = join('docs', 'proof', phase);
mkdirSync(outDir, { recursive: true });
const contract = JSON.parse(readFileSync('game.contract.json', 'utf8'));
const [cmd, ...cmdArgs] = contract.headless_cmd.split(' ');
const SC = 'tests/scenarios';

const ev = (lines, name) => lines.filter((l) => l.type === 'event' && l.name === name);
const end = (lines) => lines.at(-1);

const cases = [
  {
    name: 'contract-example',
    req: 'Ví dụ scenario + inputs trong Test Contract v1.0 (C, D): nhặt đom đóm, interact, pulse',
    args: ['--seed', '1', '--scenario', `${SC}/contract-example.scenario.json`, '--inputs', `${SC}/contract-example.inputs.json`, '--ticks', '300'],
    check: (l) => ev(l, 'mote_picked').length === 1 && ev(l, 'pulse').length === 1 && end(l).type === 'end',
    expect: '1 mote_picked, 1 pulse, dòng cuối end',
  },
  {
    name: 'light-last-lantern',
    req: 'Nạp đèn → lantern_lit; thắp hết 5 đèn → thắng (won/all_lit), cộng điểm',
    args: ['--seed', '1', '--scenario', `${SC}/light-last-lantern.scenario.json`, '--inputs', `${SC}/light-last-lantern.inputs.json`, '--ticks', '600'],
    check: (l) => ev(l, 'lantern_lit').length === 1 && end(l).state === 'won' && ev(l, 'game_over')[0]?.data.reason === 'all_lit',
    expect: 'lantern_lit L1, game_over won/all_lit',
  },
  {
    name: 'hit-and-lose',
    req: 'Bóng Mực đuổi và chạm → mất máu, rơi đom đóm; hết máu → thua (lost/no_flames)',
    args: ['--seed', '1', '--scenario', `${SC}/hit-and-lose.scenario.json`, '--ticks', '1200'],
    check: (l) => ev(l, 'player_hit').length === 2 && ev(l, 'player_hit')[0].data.dropped === 2 && end(l).state === 'lost'
      && ev(l, 'game_over')[0]?.data.reason === 'no_flames',
    expect: '2 lần player_hit (lần 1 rơi 2 đom đóm), game_over lost/no_flames',
  },
  {
    name: 'pulse-save',
    req: 'Tỏa sáng xua Bóng Mực gần (choáng + đẩy lùi), Bóng Mực xa không bị ảnh hưởng',
    args: ['--seed', '1', '--scenario', `${SC}/pulse-save.scenario.json`, '--inputs', `${SC}/pulse-save.inputs.json`, '--ticks', '120'],
    check: (l) => JSON.stringify(ev(l, 'pulse')[0]?.data.stunned_ids) === '["S1"]' && ev(l, 'player_hit').length === 0,
    expect: 'pulse stunned_ids ["S1"], không bị chạm trong 2 giây',
  },
  {
    name: 'dawn',
    req: 'Hết thời gian đêm → thua (lost/dawn); time_left_s giảm đúng 1/60 mỗi tick',
    args: ['--seed', '3', '--scenario', `${SC}/dawn.scenario.json`, '--ticks', '1000'],
    check: (l) => end(l).state === 'lost' && ev(l, 'game_over')[0]?.data.reason === 'dawn' && end(l).ticks === 120,
    expect: 'game_over lost/dawn tại tick 120',
  },
  {
    name: 'bot-win-seed2026',
    req: 'Chơi trọn Đêm 1 với đom đóm/Bóng Mực ngẫu nhiên theo seed, từ đầu tới thắng',
    args: ['--seed', '2026', '--inputs', `${SC}/bot-win-seed2026.inputs.json`, '--ticks', '18000', '--snapshot-every', '60'],
    check: (l) => end(l).state === 'won' && ev(l, 'lantern_lit').length === 5,
    expect: '5 lantern_lit, thắng',
  },
  {
    name: 'random-idle-seed42',
    req: 'Chạy ngẫu nhiên theo seed, người chơi đứng yên: Bóng Mực đuổi tới, mất máu, thua',
    args: ['--seed', '42', '--ticks', '18000', '--snapshot-every', '60'],
    check: (l) => end(l).state === 'lost',
    expect: 'thua (no_flames)',
  },
];


function run(args, out) {
  const t0 = process.hrtime.bigint();
  const r = spawnSync(cmd, [...cmdArgs, '--night', '1', ...args, '--out', out], { encoding: 'utf8', shell: false });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { status: r.status, stderr: r.stderr, ms };
}

const rows = [];
let allOk = true;
for (const c of cases) {
  const out1 = join(outDir, `${c.name}.jsonl`);
  const out2 = join(os.tmpdir(), `ddl-${c.name}-2.jsonl`);
  const r1 = run(c.args, out1);
  const r2 = run(c.args, out2);
  let ok = r1.status === 0 && r2.status === 0;
  let detail = '';
  let same = false;
  if (ok) {
    const t1 = readFileSync(out1, 'utf8');
    same = t1 === readFileSync(out2, 'utf8');
    const lines = t1.trim().split('\n').map((x) => JSON.parse(x));
    const e = end(lines);
    detail = `end: state=${e.state}, ticks=${e.ticks}, score=${e.score}`;
    ok = c.check(lines) && same;
  } else detail = `exit ${r1.status}: ${r1.stderr.trim()}`;
  allOk &&= ok;
  rows.push({ ...c, ok, same, detail, ms: r1.ms });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}  (${detail}; tất định=${same}; ${r1.ms.toFixed(0)} ms)`);
}

const md = [
  `# Kết quả kiểm chứng headless (${phase})`,
  '',
  `Sinh tự động bởi \`npm run verify\` lúc ${new Date().toISOString()}. Không sửa tay.`,
  '',
  `- Lệnh: \`${contract.headless_cmd} --night 1 <tham số> --out <file>\` (đúng \`headless_cmd\` trong game.contract.json)`,
  `- Máy: ${os.type()} ${os.release()} (${os.arch()}), Node ${process.version}, CPU: ${os.cpus()[0]?.model ?? '?'}`,
  `- Mỗi scenario chạy 2 lần và so sánh byte-by-byte để kiểm tra tính tất định.`,
  '',
  '| Scenario | Yêu cầu kiểm chứng | Mong đợi | Kết quả thực tế | Tất định | Thời gian | Đạt |',
  '|---|---|---|---|---|---:|---|',
  ...rows.map((r) => `| [${r.name}](${r.name}.jsonl) | ${r.req} | ${r.expect} | ${r.detail} | ${r.same ? 'giống hệt' : 'KHÁC'} | ${r.ms.toFixed(0)} ms | ${r.ok ? 'ĐẠT' : 'CHƯA ĐẠT'} |`),
  '',
  `Tổng: ${rows.filter((r) => r.ok).length}/${rows.length} đạt.`,
  '',
].join('\n');
writeFileSync(join(outDir, 'headless-verify.md'), md);
process.exitCode = allOk ? 0 : 1;
