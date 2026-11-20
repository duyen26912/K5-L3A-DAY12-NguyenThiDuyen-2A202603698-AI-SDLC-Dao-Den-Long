// Bảng xếp hạng phía giao diện (Ticket-04 mục 3).
// Nguồn chính: API /api/leaderboard của server Node (scripts/run.mjs, npm run dev) → lưu file trên đĩa,
// export được bằng `node scripts/run.mjs --export-leaderboard out.json`.
// Dự phòng: nếu trang được mở từ host tĩnh không có API → lưu localStorage của trình duyệt (vẫn còn sau khi tắt).
import { addEntry, parseEntries, isoWithOffset, validateName, LeaderboardEntry } from '../core/leaderboard';

const LS_KEY = 'dao-den-long-leaderboard';
const API = 'api/leaderboard'; // đường dẫn tương đối (base './')

export type Source = 'disk' | 'browser';
export interface BoardResult { entries: LeaderboardEntry[]; source: Source }

const loadLocal = (): LeaderboardEntry[] => {
  try { return parseEntries(JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')); } catch { return []; }
};

async function api(method: 'GET' | 'POST', body?: unknown): Promise<{ status: number; json: { entries?: unknown; error?: string } } | null> {
  try {
    const r = await fetch(API, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!(r.headers.get('content-type') ?? '').includes('application/json')) return null; // host tĩnh trả index.html
    return { status: r.status, json: await r.json() };
  } catch {
    return null;
  }
}

export async function fetchBoard(): Promise<BoardResult> {
  const r = await api('GET');
  if (r && r.status === 200) return { entries: parseEntries(r.json), source: 'disk' };
  return { entries: loadLocal(), source: 'browser' };
}

/** Lưu một lượt; trả về bảng mới + thứ hạng (1…10, hoặc 0 nếu không lọt top 10) hoặc thông báo lỗi. */
export async function submitScore(e: { name: string; score: number; nights_won: number; seed: number }):
  Promise<{ ok: true; board: BoardResult; rank: number } | { ok: false; error: string }> {
  const err = validateName(e.name);
  if (err) return { ok: false, error: err };
  const r = await api('POST', e);
  let board: BoardResult;
  if (r && r.status === 200) board = { entries: parseEntries(r.json), source: 'disk' };
  else if (r && r.status === 400) return { ok: false, error: r.json.error ?? 'Không lưu được' };
  else {
    try {
      const entries = addEntry(loadLocal(), { ...e, achieved_at: isoWithOffset(new Date()) });
      localStorage.setItem(LS_KEY, JSON.stringify({ entries }));
      board = { entries, source: 'browser' };
    } catch (x) {
      return { ok: false, error: (x as Error).message };
    }
  }
  const name = e.name.normalize('NFC').trim();
  // mục vừa thêm: cùng tên + điểm, achieved_at mới nhất
  let rank = 0;
  let best = '';
  board.entries.forEach((x, i) => { if (x.name === name && x.score === e.score && x.achieved_at >= best) { best = x.achieved_at; rank = i + 1; } });
  return { ok: true, board, rank };
}
