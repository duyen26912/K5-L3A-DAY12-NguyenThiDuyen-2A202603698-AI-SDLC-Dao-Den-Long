// Đổi phím (Ticket-04 mục 4) — logic thuần (không DOM), dùng chung cho giao diện và test.
// Mỗi hành động có 2 ô phím (chính + phụ). Một phím chỉ được gán cho một ô; trùng → báo và không gán.

export const ACTIONS = ['up', 'down', 'left', 'right', 'jump', 'dash', 'interact', 'pulse', 'pause'] as const;
export type Action = (typeof ACTIONS)[number];
export type Bindings = Record<Action, [string, string]>; // '' = ô trống

export const ACTION_LABEL: Record<Action, string> = {
  up: 'Đi tới', down: 'Đi lùi', left: 'Sang trái', right: 'Sang phải',
  jump: 'Nhảy', dash: 'Lướt', interact: 'Tương tác (nạp / châm dầu)', pulse: 'Tỏa sáng', pause: 'Tạm dừng',
};

export const DEFAULT_BINDINGS: Bindings = {
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  jump: ['Space', ''], dash: ['ShiftLeft', 'ShiftRight'], interact: ['KeyE', ''], pulse: ['KeyQ', ''], pause: ['Escape', 'KeyP'],
};

/** Phím dành riêng cho giao diện, không cho gán (F3 bộ đếm FPS, H ẩn bảng điều khiển, Enter/Tab điều hướng menu). */
export const RESERVED = new Set(['F3', 'KeyH', 'Enter', 'NumpadEnter', 'Tab']);

export const cloneBindings = (b: Bindings): Bindings =>
  Object.fromEntries(ACTIONS.map((a) => [a, [b[a][0], b[a][1]]])) as Bindings;

/** Hành động/ô đang dùng phím `code` (bỏ qua ô `except`), hoặc null. */
export function findConflict(b: Bindings, code: string, except?: { action: Action; slot: 0 | 1 }): { action: Action; slot: 0 | 1 } | null {
  if (!code) return null;
  for (const a of ACTIONS) {
    for (const s of [0, 1] as const) {
      if (except && except.action === a && except.slot === s) continue;
      if (b[a][s] === code) return { action: a, slot: s };
    }
  }
  return null;
}

export type RebindResult =
  | { ok: true; bindings: Bindings }
  | { ok: false; reason: 'reserved' | 'duplicate'; conflict?: Action; message: string };

/** Gán `code` vào ô (action, slot). Trùng phím với hành động khác → không gán, trả lời báo lỗi. */
export function rebind(b: Bindings, action: Action, slot: 0 | 1, code: string): RebindResult {
  if (RESERVED.has(code)) return { ok: false, reason: 'reserved', message: `Phím ${keyLabel(code)} dành cho giao diện, hãy chọn phím khác` };
  const c = findConflict(b, code, { action, slot });
  if (c && c.action !== action) {
    return { ok: false, reason: 'duplicate', conflict: c.action, message: `Phím ${keyLabel(code)} đang dùng cho "${ACTION_LABEL[c.action]}"` };
  }
  const next = cloneBindings(b);
  if (c) next[action][c.slot] = ''; // cùng hành động ở ô kia → chuyển sang ô này
  next[action][slot] = code;
  return { ok: true, bindings: next };
}

/** Xóa ô phụ; ô chính của mỗi hành động không được để trống (mọi hành động luôn có phím). */
export function clearSlot(b: Bindings, action: Action, slot: 0 | 1): Bindings {
  const next = cloneBindings(b);
  if (slot === 1 || next[action][1]) {
    if (slot === 0) { next[action][0] = next[action][1]; next[action][1] = ''; } else next[action][1] = '';
  }
  return next;
}

/** Đọc dữ liệu đã lưu (có thể hỏng / thiếu / trùng); chỗ sai lấy mặc định. */
export function parseBindings(raw: unknown): Bindings {
  let b = cloneBindings(DEFAULT_BINDINGS);
  if (!raw || typeof raw !== 'object') return b;
  const src = raw as Record<string, unknown>;
  const used = new Set<string>();
  const out = cloneBindings(DEFAULT_BINDINGS);
  let valid = true;
  for (const a of ACTIONS) {
    const v = src[a];
    if (!Array.isArray(v) || v.length !== 2 || !v.every((x) => typeof x === 'string')) { valid = false; break; }
    const pair = v as [string, string];
    if (!pair[0] || RESERVED.has(pair[0]) || RESERVED.has(pair[1])) { valid = false; break; }
    for (const k of pair) {
      if (!k) continue;
      if (used.has(k)) { valid = false; break; }
      used.add(k);
    }
    if (!valid) break;
    out[a] = [pair[0], pair[1]];
  }
  if (valid) b = out;
  return b;
}

/** Bảng tra phím → hành động (dùng khi đọc input mỗi tick). */
export function keyMap(b: Bindings): Map<string, Action> {
  const m = new Map<string, Action>();
  for (const a of ACTIONS) for (const k of b[a]) if (k) m.set(k, a);
  return m;
}

const NAMED: Record<string, string> = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', Escape: 'Esc',
  ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl trái', ControlRight: 'Ctrl phải',
  AltLeft: 'Alt trái', AltRight: 'Alt phải', Backspace: 'Backspace', Enter: 'Enter', Tab: 'Tab',
};
/** Tên phím dễ đọc từ KeyboardEvent.code: KeyW → W, Digit1 → 1, Numpad4 → Num 4. */
export function keyLabel(code: string): string {
  if (!code) return '—';
  if (NAMED[code]) return NAMED[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return `Num ${code.slice(6)}`;
  return code;
}
