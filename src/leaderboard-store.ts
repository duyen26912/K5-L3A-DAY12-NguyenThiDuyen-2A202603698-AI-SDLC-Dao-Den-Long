// Lưu bảng xếp hạng xuống đĩa cục bộ (Node). Dùng bởi scripts/run.mjs (bản phát hành) và vite dev server.
// Vị trí: $DDL_DATA_DIR/leaderboard.json, mặc định ~/.dao-den-long/leaderboard.json — còn lại sau khi tắt game.
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { addEntry, parseEntries, exportLeaderboard, isoWithOffset, LeaderboardEntry } from './core/leaderboard';

export const dataFile = (): string => join(process.env.DDL_DATA_DIR ?? join(homedir(), '.dao-den-long'), 'leaderboard.json');

export function loadEntries(file = dataFile()): LeaderboardEntry[] {
  try {
    return parseEntries(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    return [];
  }
}

function save(list: LeaderboardEntry[], file: string) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(exportLeaderboard(list), null, 2) + '\n');
  renameSync(tmp, file); // ghi nguyên tử, không hỏng file nếu tắt giữa chừng
}

/** Thêm một lượt chơi; achieved_at do máy ghi (giờ địa phương + múi giờ). */
export function submitEntry(body: { name: string; score: number; nights_won: number; seed: number }, file = dataFile()): LeaderboardEntry[] {
  const list = addEntry(loadEntries(file), {
    name: String(body.name), score: Number(body.score), nights_won: Number(body.nights_won),
    seed: Number(body.seed), achieved_at: isoWithOffset(new Date()),
  });
  save(list, file);
  return list;
}

export function exportTo(out: string, file = dataFile()) {
  writeFileSync(out, JSON.stringify(exportLeaderboard(loadEntries(file)), null, 2) + '\n');
}

/** Xử lý /api/leaderboard cho server Node (http) và middleware vite. */
export function handleApi(method: string, body: string): { status: number; json: unknown } {
  try {
    if (method === 'GET') return { status: 200, json: exportLeaderboard(loadEntries()) };
    if (method === 'POST') return { status: 200, json: { entries: submitEntry(JSON.parse(body || '{}')) } };
    return { status: 405, json: { error: 'method' } };
  } catch (e) {
    return { status: 400, json: { error: (e as Error).message } };
  }
}
