import { createWorld, neutralInput, step } from './world';
import { applyScenario, parseInputs, snapshot } from './io';

export interface SimOptions {
  seed: number;
  night: number;
  ticks: number;
  snapshotEvery?: number;
  scenario?: unknown;
  inputs?: unknown;
}

/**
 * Chạy mô phỏng và trả về các dòng JSONL (chưa có ký tự xuống dòng).
 * Snapshot tick 0 là trạng thái sau khi dựng scenario, trước khi áp dụng input.
 * `tick` đếm mọi tick (kể cả lúc tạm dừng); `sim_tick` chỉ đếm tick gameplay.
 */
export function simulate(opts: SimOptions): string[] {
  const every = opts.snapshotEvery ?? 10;
  const w = createWorld(opts.seed, opts.night);
  if (opts.scenario !== undefined) applyScenario(w, opts.scenario);
  const inputAt = opts.inputs !== undefined ? parseInputs(opts.inputs) : () => neutralInput();

  const lines: string[] = [JSON.stringify(snapshot(w))];
  lines.push(JSON.stringify({ type: 'event', tick: 0, name: 'night_start', data: { night: w.night } }));
  for (let k = 0; k < opts.ticks && w.state === 'playing'; k++) {
    const events = step(w, inputAt(k));
    for (const e of events) {
      lines.push(JSON.stringify({ type: 'event', tick: w.tick, name: e.name, data: e.data }));
    }
    if (w.tick % every === 0) lines.push(JSON.stringify(snapshot(w)));
  }
  lines.push(JSON.stringify({ type: 'end', ticks: w.tick, state: w.state, score: w.score }));
  return lines;
}
