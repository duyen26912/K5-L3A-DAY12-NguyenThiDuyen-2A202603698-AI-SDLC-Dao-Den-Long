// Chạy các scenario headless bằng đúng lệnh trong game.contract.json, kiểm tra kết quả mong đợi,
// kiểm tra tính tất định (chạy 2 lần so sánh) và lưu bằng chứng vào docs/proof/<phase>/.
// Chạy: npm run build:headless && npm run verify [-- phase-2]
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

const phase = process.argv[2] ?? 'phase-2';
const outDir = join('docs', 'proof', phase);
mkdirSync(outDir, { recursive: true });
const contract = JSON.parse(readFileSync('game.contract.json', 'utf8'));
const [cmd, ...cmdArgs] = contract.headless_cmd.split(' ');
const SC = 'tests/scenarios';
const E = `${SC}/p2-empty.scenario.json`;

const ev = (l, name) => l.filter((x) => x.type === 'event' && x.name === name);
const end = (l) => l.at(-1);
const snaps = (l) => l.filter((x) => x.type === 'snapshot');
const at = (l, t) => snaps(l).find((s) => s.tick === t);
const sc = (n) => ['--scenario', `${SC}/${n}.scenario.json`];
const inp = (n) => ['--inputs', `${SC}/${n}.inputs.json`];

const cases = [
  // ---- Regression Phase 1 (luật Đêm 1 với số chuẩn) ----
  {
    name: 'p1-contract-example', req: 'Regression: ví dụ Test Contract (Đêm 1) vẫn chạy đúng định dạng với số chuẩn',
    args: ['--night', '1', '--seed', '1', ...sc('contract-example'), ...inp('contract-example'), '--ticks', '300'],
    check: (l) => ev(l, 'mote_picked').length === 1 && ev(l, 'pulse').length === 0 && end(l).type === 'end',
    expect: '1 mote_picked; không pulse (chỉ mang 1 < 3)',
  },
  {
    name: 'p1-light-last-lantern', req: 'Regression: nạp đèn cuối → thắng (won/all_lit), +10/đom đóm nạp',
    args: ['--night', '1', '--seed', '1', ...sc('light-last-lantern'), ...inp('light-last-lantern'), '--ticks', '600'],
    check: (l) => end(l).state === 'won' && ev(l, 'deposit')[0]?.data.amount === 10 && ev(l, 'game_over')[0]?.data.reason === 'all_lit',
    expect: 'deposit 10, lantern_lit, won/all_lit',
  },
  {
    name: 'p1-dawn', req: 'Regression: hết giờ → lost/dawn',
    args: ['--night', '1', '--seed', '3', ...sc('dawn'), '--ticks', '1000'],
    check: (l) => end(l).state === 'lost' && ev(l, 'game_over')[0]?.data.reason === 'dawn' && end(l).ticks === 120,
    expect: 'game_over lost/dawn tại tick 120',
  },
  {
    name: 'p1-bot-win-n1-seed5', req: 'Chơi trọn Đêm 1 (số chuẩn, ngẫu nhiên theo seed) tới thắng',
    args: ['--night', '1', '--seed', '5', ...inp('bot-win-n1-seed5'), '--ticks', '21600', '--snapshot-every', '120'],
    check: (l) => end(l).state === 'won' && ev(l, 'lantern_lit').length === 5,
    expect: '5 lantern_lit, thắng',
  },
  // ---- Tính năng mới Phase 2 ----
  {
    name: 'p2-dash', req: 'Lướt 14 m/s × 0.2 s, hồi chiêu 1.5 s (lần nhấn tick 30 bị bỏ qua)',
    args: ['--night', '1', '--seed', '1', '--scenario', E, ...inp('p2-dash'), '--ticks', '120', '--snapshot-every', '1'],
    check: (l) => JSON.stringify(ev(l, 'dash').map((e) => e.tick)) === '[1,91]' && Math.abs(at(l, 12).player.pos[0] - 2.8) < 0.02,
    expect: 'dash tại tick 1 và 91; x = 2.8 m sau 12 tick',
  },
  {
    name: 'p2-pause', req: 'Tạm dừng: tick tăng, sim_tick/thời gian đứng yên, state paused',
    args: ['--night', '1', '--seed', '1', '--scenario', E, ...inp('p2-pause'), '--ticks', '240', '--snapshot-every', '10'],
    check: (l) => ev(l, 'paused').length === 1 && ev(l, 'resumed').length === 1 && at(l, 100).state === 'paused' && at(l, 100).sim_tick === 59 && at(l, 170).sim_tick === 59,
    expect: 'paused tick 60, resumed tick 180; sim_tick đứng ở 59',
  },
  {
    name: 'p2-fall', req: 'Rơi khỏi đảo: −1 Ngọn Lửa, mất hết đom đóm, chờ 60 tick, hồi sinh bất tử',
    args: ['--night', '1', '--seed', '1', ...sc('p2-fall'), ...inp('p2-move-east-short'), '--ticks', '200', '--snapshot-every', '1'],
    check: (l) => {
      const h = ev(l, 'player_hit')[0];
      const back = h && at(l, h.tick + 60);
      return h?.data.by === 'fall' && h.data.lost === 7 && back.player.pos.join() === '0,0,0' && back.player.invuln === true;
    },
    expect: 'player_hit by fall, lost 7; hồi sinh (0,0,0) sau 60 tick',
  },
  {
    name: 'p2-n2-bridge', req: 'Đêm 2: đi qua cầu tre từ đảo A sang đảo B',
    args: ['--night', '2', '--seed', '1', ...sc('p2-n2-bridge'), ...inp('p2-move-east-long'), '--ticks', '600', '--snapshot-every', '60'],
    check: (l) => end(l).type === 'end' && snaps(l).at(-1).player.pos[0] > 60 && ev(l, 'player_hit').length === 0,
    expect: 'x > 60 (đảo B), không rơi',
  },
  {
    name: 'p2-n2-pad', req: 'Đêm 2: bục nhảy bắn sang đảo B (14 m/s lên, 24 m/s ngang), đáp trong đảo B',
    args: ['--night', '2', '--seed', '1', ...sc('p2-n2-pad'), ...inp('p2-step-onto-pad'), '--ticks', '150', '--snapshot-every', '1'],
    check: (l) => { const s = snaps(l).at(-1); return s.player.grounded && Math.hypot(s.player.pos[0] - 70, s.player.pos[2]) <= 28 && ev(l, 'player_hit').length === 0; },
    expect: 'đáp xuống trong đảo B, không rơi',
  },
  {
    name: 'p2-n3-ramp', req: 'Đêm 3: đi lên dốc 30° từ Y=0 lên tầng 1 (Y=3)',
    args: ['--night', '3', '--seed', '1', ...sc('p2-n3-ramp'), ...inp('p2-n3-ramp'), '--ticks', '100', '--snapshot-every', '10'],
    check: (l) => snaps(l).at(-1).player.pos[1] === 3,
    expect: 'player Y = 3',
  },
  {
    name: 'p2-n3-pad', req: 'Đêm 3: bục nhảy (0,3,13) → đáp tầng 2 (Y=6)',
    args: ['--night', '3', '--seed', '1', ...sc('p2-n3-pad'), '--ticks', '120', '--snapshot-every', '10'],
    check: (l) => snaps(l).at(-1).player.pos[1] === 6 && snaps(l).at(-1).player.grounded,
    expect: 'player Y = 6, grounded',
  },
  {
    name: 'p2-n3-wind', req: 'Đêm 3: gió mạnh tại 30 s, 5 s, đẩy 2 m/s',
    args: ['--night', '3', '--seed', '4', ...sc('p2-n3-wind'), '--ticks', '2160', '--snapshot-every', '60'],
    check: (l) => at(l, 1800).wind.active === true && at(l, 2100).wind.active === false,
    expect: 'wind.active true ở tick 1800, false ở 2100',
  },
  {
    name: 'p2-drifter-steal', req: 'Gió Lạc: đuổi khi mang ≥ 5, cướp 3, flee 240 tick rồi removed',
    args: ['--night', '2', '--seed', '1', ...sc('p2-drifter-steal'), '--ticks', '400', '--snapshot-every', '1'],
    check: (l) => { const s = ev(l, 'drifter_steal')[0]; return s?.data.amount === 3 && at(l, s.tick + 240).drifters[0].state === 'removed'; },
    expect: 'drifter_steal amount 3; removed sau 240 tick',
  },
  {
    name: 'p2-drifter-drop', req: 'Gió Lạc: Tỏa Sáng trúng lúc flee có mang → thả lại 3 đom đóm',
    args: ['--night', '2', '--seed', '1', ...sc('p2-drifter-drop'), ...inp('p2-pulse-once'), '--ticks', '130', '--snapshot-every', '1'],
    check: (l) => ev(l, 'drifter_drop')[0]?.data.amount === 3 && at(l, 1).motes.filter((m) => m.kind === 'dropped').length === 3,
    expect: 'drifter_drop amount 3; 3 đom đóm rơi',
  },
  {
    name: 'p2-charm', req: 'Bùa Gió: nhặt → 600 tick, 7.2 m/s, lướt không hồi chiêu',
    args: ['--night', '2', '--seed', '1', ...sc('p2-charm'), ...inp('p2-charm'), '--ticks', '120', '--snapshot-every', '1'],
    check: (l) => ev(l, 'charm_picked')[0]?.data.charm_ticks === 600 && ev(l, 'dash').length === 2 && Math.abs(at(l, 61).player.pos[0] - at(l, 1).player.pos[0] - 7.2) < 0.02,
    expect: 'charm_picked 600; 2 lần dash cách 15 tick; đi 7.2 m trong 60 tick',
  },
  {
    name: 'p2-safe-evict', req: 'Vùng an toàn: Bóng Mực trong vùng khi đèn vừa thắp bị đẩy ra ≤ 30 tick, không gây sát thương',
    args: ['--night', '1', '--seed', '1', ...sc('p2-safe-evict'), ...inp('p2-interact'), '--ticks', '40', '--snapshot-every', '1'],
    check: (l) => ev(l, 'lantern_lit').length === 1 && ev(l, 'player_hit').length === 0 && Math.hypot(at(l, 31).shades[0].pos[0], at(l, 31).shades[0].pos[2] - 25) >= 5.999,
    expect: 'lantern_lit, không player_hit, bóng ở mép 6 m sau 30 tick',
  },
  {
    name: 'p2-n2-random-full', req: 'Đêm 2 ngẫu nhiên chạy hết (spawn Bóng Mực, Gió Lạc), tất định, ≤ 30 s',
    args: ['--night', '2', '--seed', '42', '--scenario', `${SC}/p2-immortal.scenario.json`, '--ticks', '21600', '--snapshot-every', '600'],
    check: (l) => end(l).type === 'end' && ev(l, 'shade_spawned').length === 8,
    expect: '8 shade_spawned (tối đa Đêm 2)',
  },
  {
    name: 'p2-n3-random-full', req: 'Đêm 3 ngẫu nhiên chạy hết, tất định, ≤ 30 s',
    args: ['--night', '3', '--seed', '42', '--scenario', `${SC}/p2-immortal.scenario.json`, '--ticks', '21600', '--snapshot-every', '600'],
    check: (l) => end(l).type === 'end' && ev(l, 'shade_spawned').length === 10,
    expect: '10 shade_spawned (tối đa Đêm 3)',
  },
];

writeFileSync(`${SC}/p2-immortal.scenario.json`, JSON.stringify({ player: { flames: 99 } }) + '\n');

function run(args, out) {
  const t0 = process.hrtime.bigint();
  const r = spawnSync(cmd, [...cmdArgs, ...args, '--out', out], { encoding: 'utf8', shell: false });
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
    try { ok = c.check(lines) && same; } catch (err) { ok = false; detail += ` (lỗi kiểm tra: ${err.message})`; }
  } else detail = `exit ${r1.status}: ${r1.stderr.trim()}`;
  allOk &&= ok;
  rows.push({ ...c, ok, same, detail, ms: r1.ms });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}  (${detail}; tất định=${same}; ${r1.ms.toFixed(0)} ms)`);
}

const md = [
  `# Kết quả kiểm chứng headless (${phase})`,
  '',
  `Sinh tự động bởi \`npm run verify -- ${phase}\` lúc ${new Date().toISOString()}. Không sửa tay.`,
  '',
  `- Lệnh: \`${contract.headless_cmd} <tham số> --out <file>\` (đúng \`headless_cmd\` trong game.contract.json, contract ${contract.contract_version})`,
  `- Máy: ${os.type()} ${os.release()} (${os.arch()}), Node ${process.version}, CPU: ${os.cpus()[0]?.model ?? '?'}`,
  '- Mỗi scenario chạy 2 lần và so sánh byte-by-byte để kiểm tra tính tất định.',
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
