// Bảng xếp hạng cục bộ (Ticket-04 mục 3) — logic thuần, dùng chung cho server, giao diện và test.

export interface LeaderboardEntry {
  name: string;
  score: number;
  nights_won: number;
  achieved_at: string; // ISO 8601 có múi giờ
  seed: number;
}

export const MAX_ENTRIES = 10;

/**
 * Tên hợp lệ: 3–12 ký tự chữ, số hoặc "_" — gồm cả chữ tiếng Việt có dấu (điểm cộng).
 * Chuẩn hóa NFC trước khi đếm để "ă" gõ tổ hợp và gõ sẵn đều tính 1 ký tự.
 */
export function normalizeName(raw: string): string {
  return raw.normalize('NFC').trim();
}
export function validateName(raw: string): string | null {
  const name = normalizeName(raw);
  const len = [...name].length;
  if (len < 3 || len > 12) return 'Tên phải dài 3–12 ký tự';
  if (!/^[\p{L}\p{N}_]+$/u.test(name)) return 'Tên chỉ gồm chữ (có thể có dấu), số và dấu gạch dưới _';
  return null;
}

/** ISO 8601 theo giờ địa phương kèm độ lệch múi giờ, ví dụ 2026-11-20T21:05:03+07:00. */
export function isoWithOffset(d: Date): string {
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(off / 60)}:${pad(off % 60)}`;
}

/** Sắp xếp: điểm giảm dần; bằng điểm thì ai đạt trước (achieved_at sớm hơn) đứng trên; giữ top 10. */
export function sortEntries(list: LeaderboardEntry[]): LeaderboardEntry[] {
  return list
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.score - a.e.score || Date.parse(a.e.achieved_at) - Date.parse(b.e.achieved_at) || a.i - b.i)
    .map((x) => x.e)
    .slice(0, MAX_ENTRIES);
}

export function addEntry(list: LeaderboardEntry[], entry: LeaderboardEntry): LeaderboardEntry[] {
  const err = validateName(entry.name);
  if (err) throw new Error(err);
  if (!Number.isFinite(entry.score) || entry.score < 0) throw new Error('score không hợp lệ');
  if (!Number.isInteger(entry.nights_won) || entry.nights_won < 0 || entry.nights_won > 3) throw new Error('nights_won phải trong 0–3');
  if (Number.isNaN(Date.parse(entry.achieved_at))) throw new Error('achieved_at không hợp lệ');
  return sortEntries([...list, { ...entry, name: normalizeName(entry.name) }]);
}

/** Đọc dữ liệu thô (có thể hỏng / sai kiểu) thành danh sách hợp lệ đã sắp xếp. */
export function parseEntries(raw: unknown): LeaderboardEntry[] {
  const arr = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' && Array.isArray((raw as { entries?: unknown }).entries)) ? (raw as { entries: unknown[] }).entries : [];
  const ok = arr.filter((e): e is LeaderboardEntry => !!e && typeof e === 'object'
    && typeof (e as LeaderboardEntry).name === 'string' && validateName((e as LeaderboardEntry).name) === null
    && Number.isFinite((e as LeaderboardEntry).score) && Number.isInteger((e as LeaderboardEntry).nights_won)
    && typeof (e as LeaderboardEntry).achieved_at === 'string' && Number.isFinite((e as LeaderboardEntry).seed));
  return sortEntries(ok.map((e) => ({ name: e.name, score: e.score, nights_won: e.nights_won, achieved_at: e.achieved_at, seed: e.seed })));
}

export const exportLeaderboard = (list: LeaderboardEntry[]) => ({ entries: sortEntries(list) });
