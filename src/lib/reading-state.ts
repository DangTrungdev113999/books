/* ════════════════════════════════════════════════════════════════════════════
 * reading-state.ts — Bộ nhớ hành trình đọc (client-side, localStorage).
 *   Lưu THEO TỪNG SÁCH ở key `book-state:<bookId>`:
 *     • read       — mục đã đọc xong         { id: ts }
 *     • last        — vị trí đọc dở           { id, lang, scrollTop, ts }
 *     • highlights  — đoạn tô + ghi chú       { "<id>::<lang>": [ {…} ] }
 *     • history     — nhật ký hoạt động       [ { type, id, lang, ts, preview } ]
 *
 *   Cổng React: ngoài event bus `reading-state-changed`, module giữ một số
 *   nguyên `version` tăng mỗi lần ghi + `subscribe()` để dùng với
 *   useSyncExternalStore (snapshot là số → tránh render-storm).
 * ════════════════════════════════════════════════════════════════════════════ */

import type { Highlight, HistoryEntry, HistoryType, Lang, LastPosition } from './types';

const PREFIX = 'book-state:';
const HISTORY_CAP = 200;

interface State {
  read: Record<string, number>;
  last: LastPosition | null;
  highlights: Record<string, Highlight[]>;
  history: HistoryEntry[];
}

let bookId: string | null = null;
let total = 0;
let state: State = blank();
let version = 0;

const listeners = new Set<() => void>();

function blank(): State {
  return { read: {}, last: null, highlights: {}, history: [] };
}

function key() {
  return PREFIX + bookId;
}
const hkey = (id: string, lang: Lang) => `${id}::${lang}`;

const now = () => Date.now();
function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return 'h-' + now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
}

/* ── Init + persist ───────────────────────────────────────────────────────── */

export function initState(id: string, totalSections: number): State {
  bookId = id;
  total = totalSections || 0;
  try {
    const raw = localStorage.getItem(key());
    state = raw ? { ...blank(), ...(JSON.parse(raw) as Partial<State>) } : blank();
  } catch {
    state = blank();
  }
  bump({ kind: 'init', id });
  return state;
}

function save(detail: Record<string, unknown> = {}) {
  try {
    localStorage.setItem(key(), JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
  bump(detail);
}

function bump(detail: Record<string, unknown> = {}) {
  version += 1;
  window.dispatchEvent(new CustomEvent('reading-state-changed', { detail }));
  for (const cb of listeners) cb();
}

/** Legacy event-bus API (vẫn dùng được nếu cần). */
export function onChange(cb: (detail: Record<string, unknown>) => void) {
  window.addEventListener('reading-state-changed', (e) =>
    cb((e as CustomEvent).detail || {})
  );
}

/** useSyncExternalStore hook plumbing. */
export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export const getVersion = () => version;

/* ── Tiến độ đọc ──────────────────────────────────────────────────────────── */

export const isRead = (id: string) => Boolean(state.read[id]);

export function markRead(id: string): boolean {
  if (state.read[id]) return false; // chỉ ghi lần đầu
  state.read[id] = now();
  // KHÔNG ghi "đã đọc" vào lịch sử — chỉ log thao tác tô đậm / ghi chú.
  save({ kind: 'read', id });
  return true;
}

export function progress() {
  const read = Object.keys(state.read).length;
  return { read, total, pct: total ? Math.round((read / total) * 100) : 0 };
}

/* ── Vị trí đọc dở (Tiếp tục đọc) ─────────────────────────────────────────── */

export function setLast(
  id: string,
  lang: Lang,
  scrollTop: number,
  meta: { title?: string } = {}
) {
  state.last = {
    id,
    lang,
    scrollTop: Math.max(0, Math.round(scrollTop || 0)),
    ts: now(),
    title: meta.title || (state.last && state.last.id === id ? state.last.title : ''),
  };
  save({ kind: 'last', id });
}

export const getLast = () => state.last;

export function clearLast() {
  state.last = null;
  save({ kind: 'last-clear' });
}

/* ── Highlight + ghi chú (gắn theo lang) ──────────────────────────────────── */

export function getHighlights(id: string, lang: Lang): Highlight[] {
  return state.highlights[hkey(id, lang)] || [];
}

export function addHighlight(
  id: string,
  lang: Lang,
  h: Partial<Highlight>,
  meta: { title?: string } = {}
): Highlight {
  const k = hkey(id, lang);
  const rec: Highlight = {
    id: uid(),
    blockIndex: 0,
    start: 0,
    end: 0,
    quote: '',
    color: 'amber',
    note: '',
    ts: now(),
    ...h,
  };
  (state.highlights[k] || (state.highlights[k] = [])).push(rec);
  pushHistory(
    {
      type: rec.note ? 'note' : 'highlight',
      id,
      lang,
      preview: (rec.quote || meta.title || '').slice(0, 90),
    },
    false
  );
  save({ kind: 'highlight-add', id, lang });
  return rec;
}

export function updateHighlight(
  id: string,
  lang: Lang,
  hid: string,
  patch: Partial<Highlight>
): Highlight | undefined {
  const arr = state.highlights[hkey(id, lang)];
  if (!arr) return;
  const rec = arr.find((x) => x.id === hid);
  if (!rec) return;
  const hadNote = Boolean(rec.note);
  Object.assign(rec, patch, { ts: now() });
  if (!hadNote && rec.note) {
    pushHistory({ type: 'note', id, lang, preview: (rec.quote || '').slice(0, 90) }, false);
  }
  save({ kind: 'highlight-update', id, lang });
  return rec;
}

export function removeHighlight(id: string, lang: Lang, hid: string) {
  const k = hkey(id, lang);
  const arr = state.highlights[k];
  if (!arr) return;
  state.highlights[k] = arr.filter((x) => x.id !== hid);
  if (!state.highlights[k].length) delete state.highlights[k];
  save({ kind: 'highlight-remove', id, lang });
}

/* ── Lịch sử hoạt động ────────────────────────────────────────────────────── */

export function pushHistory(entry: Omit<HistoryEntry, 'ts'> & { ts?: number }, persist = true) {
  state.history.unshift({ ts: now(), ...entry } as HistoryEntry);
  if (state.history.length > HISTORY_CAP) state.history.length = HISTORY_CAP;
  if (persist) save({ kind: 'history' });
}

export const getHistory = () => state.history;

export function clearHistory() {
  state.history = [];
  save({ kind: 'history-clear' });
}

export type { HistoryType };
