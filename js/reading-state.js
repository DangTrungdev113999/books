/* ════════════════════════════════════════════════════════════════════════════
 * reading-state.js — Bộ nhớ hành trình đọc (client-side, localStorage).
 *   Lưu THEO TỪNG SÁCH ở key `book-state:<bookId>`:
 *     • read       — mục đã đọc xong         { id: ts }
 *     • last        — vị trí đọc dở           { id, lang, scrollTop, ts }
 *     • highlights  — đoạn tô + ghi chú       { "<id>::<lang>": [ {…} ] }
 *     • history     — nhật ký hoạt động       [ { type, id, lang, ts, preview } ]
 *
 *   ⚠ Highlight + scroll gắn theo NGÔN NGỮ: bản VI và EN render khác nhau nên
 *     một highlight chỉ có nghĩa với đúng lang đã tạo ra nó.
 *
 *   Mỗi lần ghi → phát sự kiện `reading-state-changed` trên window để
 *   topbar / mindmap / sidebar / popup tự cập nhật.
 * ════════════════════════════════════════════════════════════════════════════ */

const PREFIX = 'book-state:';
const HISTORY_CAP = 200;

let bookId = null;
let total = 0;
let state = blank();

function blank() {
  return { read: {}, last: null, highlights: {}, history: [] };
}

function key() { return PREFIX + bookId; }
const hkey = (id, lang) => `${id}::${lang}`;

const now = () => Date.now();
function uid() {
  try { return crypto.randomUUID(); } catch (_) {}
  return 'h-' + now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
}

/* ── Init + persist ───────────────────────────────────────────────────────── */

export function initState(id, totalSections) {
  bookId = id;
  total = totalSections || 0;
  try {
    const raw = localStorage.getItem(key());
    state = raw ? { ...blank(), ...JSON.parse(raw) } : blank();
  } catch (_) {
    state = blank();
  }
  return state;
}

function save(detail = {}) {
  try { localStorage.setItem(key(), JSON.stringify(state)); } catch (_) {}
  window.dispatchEvent(new CustomEvent('reading-state-changed', { detail }));
}

export function onChange(cb) {
  window.addEventListener('reading-state-changed', (e) => cb(e.detail || {}));
}

/* ── Tiến độ đọc ──────────────────────────────────────────────────────────── */

export const isRead = (id) => Boolean(state.read[id]);

export function markRead(id, meta = {}) {
  if (state.read[id]) return false;          // chỉ ghi lần đầu
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

export function setLast(id, lang, scrollTop, meta = {}) {
  state.last = { id, lang, scrollTop: Math.max(0, Math.round(scrollTop || 0)), ts: now(),
    title: meta.title || (state.last && state.last.id === id ? state.last.title : '') };
  save({ kind: 'last', id });
}

export const getLast = () => state.last;

export function clearLast() {
  state.last = null;
  save({ kind: 'last-clear' });
}

/* ── Highlight + ghi chú (gắn theo lang) ──────────────────────────────────── */

export function getHighlights(id, lang) {
  return state.highlights[hkey(id, lang)] || [];
}

export function addHighlight(id, lang, h, meta = {}) {
  const k = hkey(id, lang);
  const rec = { id: uid(), color: 'amber', note: '', ts: now(), ...h };
  (state.highlights[k] || (state.highlights[k] = [])).push(rec);
  pushHistory({ type: rec.note ? 'note' : 'highlight', id, lang,
    preview: (rec.quote || meta.title || '').slice(0, 90) }, false);
  save({ kind: 'highlight-add', id, lang });
  return rec;
}

export function updateHighlight(id, lang, hid, patch) {
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

export function removeHighlight(id, lang, hid) {
  const k = hkey(id, lang);
  const arr = state.highlights[k];
  if (!arr) return;
  state.highlights[k] = arr.filter((x) => x.id !== hid);
  if (!state.highlights[k].length) delete state.highlights[k];
  save({ kind: 'highlight-remove', id, lang });
}

/* ── Lịch sử hoạt động ────────────────────────────────────────────────────── */

export function pushHistory(entry, persist = true) {
  state.history.unshift({ ts: now(), ...entry });
  if (state.history.length > HISTORY_CAP) state.history.length = HISTORY_CAP;
  if (persist) save({ kind: 'history' });
}

export const getHistory = () => state.history;

export function clearHistory() {
  state.history = [];
  save({ kind: 'history-clear' });
}
