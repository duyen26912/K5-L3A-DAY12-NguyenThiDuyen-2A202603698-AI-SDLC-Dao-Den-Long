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
 */
export function simulate(opts: SimOptions): string[] {
  const every = opts.snapshotEvery ?? 10;
  const w = createWorld(opts.seed, opts.night);
  if (opts.scenario !== undefined) applyScenario(w, opts.scenario);
  const inputAt = opts.inputs !== undefined ? parseInputs(opts.inputs) : () => neutralInput();

  const lines: string[] = [JSON.stringify(snapshot(w))];
  for (let k = 0; k < opts.ticks && w.state === 'playing'; k++) {
    const events = step(w, inputAt(k));
    for (const e of events) {
      lines.push(JSON.stringify({ type: 'event', tick: w.steps, name: e.name, data: e.data }));
    }
    if (w.steps % every === 0) lines.push(JSON.stringify(snapshot(w)));
  }
  lines.push(JSON.stringify({ type: 'end', ticks: w.steps, state: w.state, score: w.score }));
  return lines;
}
