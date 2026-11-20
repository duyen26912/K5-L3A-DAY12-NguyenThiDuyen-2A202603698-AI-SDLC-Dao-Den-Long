// Chế độ headless theo Test Contract v1.0:
// <headless_cmd> --seed <int> --night 1 [--scenario <file.json>] [--inputs <file.json>]
//                --ticks <int> --out <file.jsonl> [--snapshot-every <int, mặc định 10>]
import { readFileSync, writeFileSync } from 'node:fs';
import { simulate } from './core/simulate';
import { InputFormatError } from './core/io';

class UsageError extends Error {}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new UsageError(`tham số không hợp lệ: ${a}`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw new UsageError(`thiếu giá trị cho ${a}`);
    out[a.slice(2)] = v;
    i++;
  }
  return out;
}

function intArg(args: Record<string, string>, name: string, required: boolean, min: number, def?: number): number {
  const v = args[name];
  if (v === undefined) {
    if (required) throw new UsageError(`thiếu --${name}`);
    return def as number;
  }
  if (!/^-?\d+$/.test(v) || Number(v) < min) throw new UsageError(`--${name} phải là số nguyên ≥ ${min}`);
  return Number(v);
}

function readJson(path: string, what: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    throw new InputFormatError(`không đọc được file ${what} "${path}": ${(e as Error).message}`);
  }
  try {
    return JSON.parse(text.replace(/^﻿/, ''));
  } catch (e) {
    throw new InputFormatError(`file ${what} không phải JSON hợp lệ: ${(e as Error).message}`);
  }
}

function main(): number {
  try {
    const args = parseArgs(process.argv.slice(2));
    const known = new Set(['seed', 'night', 'scenario', 'inputs', 'ticks', 'out', 'snapshot-every']);
    for (const k of Object.keys(args)) if (!known.has(k)) throw new UsageError(`tham số không hỗ trợ: --${k}`);
    const seed = intArg(args, 'seed', true, -2147483648);
    const night = intArg(args, 'night', true, 1);
    if (night !== 1) throw new UsageError('phiên bản này chỉ có --night 1');
    const ticks = intArg(args, 'ticks', true, 0);
    const snapshotEvery = intArg(args, 'snapshot-every', false, 1, 10);
    if (!args.out) throw new UsageError('thiếu --out');
    const scenario = args.scenario ? readJson(args.scenario, 'scenario') : undefined;
    const inputs = args.inputs ? readJson(args.inputs, 'inputs') : undefined;
    const lines = simulate({ seed, night, ticks, snapshotEvery, scenario, inputs });
    writeFileSync(args.out, lines.join('\n') + '\n', 'utf8');
    return 0;
  } catch (e) {
    process.stderr.write(`headless error: ${(e as Error).message}\n`);
    return e instanceof InputFormatError ? 2 : 1;
  }
}

process.exitCode = main();
