/* ════════════════════════════════════════════════════════════════════════════
 * highlight.js — Tô đậm (highlight) + ghi chú trên nội dung popup.
 *   • Quét chọn 1 đoạn trong .prose → thanh nổi: chọn màu tô / thêm ghi chú.
 *   • Neo theo (blockIndex trong .prose) + (start,end offset trên textContent)
 *     + quote làm fallback xác thực → tô lại đúng chỗ sau khi render/đổi ngôn ngữ.
 *   • Tô lại bằng Range API, bọc TỪNG text-node fragment trong <mark> riêng →
 *     an toàn khi vùng chọn cắt qua <strong>/<a> (nhiều text-node).
 *   • Highlight gắn theo (sectionId, lang) — xem reading-state.js.
 *   • Click vào đoạn đã tô → popover: đổi màu / ghi chú / xoá.
 *
 *   Màu highlight CỐ ĐỊNH (như bút dạ quang) — chữ vẫn dùng màu theme (--fg) nên
 *   đọc rõ trên mọi theme sáng/tối.
 * ════════════════════════════════════════════════════════════════════════════ */

import { getHighlights, addHighlight, updateHighlight, removeHighlight } from './reading-state.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

export const HL_COLORS = ['amber', 'green', 'sky', 'rose', 'violet'];

let ctx = () => ({ id: null, lang: 'vi' }); // getter ngữ cảnh mục đang mở
let editingHid = null;

/* ── Truy vấn DOM ─────────────────────────────────────────────────────────── */

const getProse = () => $('#modal-body .prose');

function blockOf(node, prose) {
  let el = node.nodeType === 3 ? node.parentElement : node;
  while (el && el.parentElement !== prose) el = el.parentElement;
  return el && el.parentElement === prose ? el : null;
}

// Offset ký tự (theo textContent) của một vị trí (node, offset) trong block.
// Dùng Range để đo → đúng cho mọi loại boundary (text-node HOẶC element, vd ngay
// sau một <strong>/<a>) — tránh lỗi đếm hụt khi boundary là element.
function textOffset(block, node, offsetInNode) {
  const r = document.createRange();
  r.setStart(block, 0);
  r.setEnd(node, offsetInNode);
  return r.toString().length;
}

/* ── Lấy "mỏ neo" từ vùng đang chọn ───────────────────────────────────────── */

function anchorFromSelection() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const prose = getProse();
  if (!prose || !prose.contains(range.commonAncestorContainer)) return null;

  const b1 = blockOf(range.startContainer, prose);
  const b2 = blockOf(range.endContainer, prose);
  if (!b1 || b1 !== b2) return null; // chỉ cho phép tô gọn trong 1 block

  const blockIndex = Array.prototype.indexOf.call(prose.children, b1);
  if (blockIndex < 0) return null;
  let start = textOffset(b1, range.startContainer, range.startOffset);
  let end = textOffset(b1, range.endContainer, range.endOffset);
  if (start > end) [start, end] = [end, start];
  const quote = b1.textContent.slice(start, end).trim();
  if (quote.length < 1) return null;
  // bỏ khoảng trắng thừa hai đầu cho gọn
  const lead = b1.textContent.slice(start, end).length - b1.textContent.slice(start, end).trimStart().length;
  start += lead;
  end = start + quote.length;
  return { blockIndex, start, end, quote };
}

/* ── Bọc <mark> cho một highlight đã neo ──────────────────────────────────── */

function applyOne(block, h) {
  const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let acc = 0;
  const frags = [];
  let n;
  while ((n = w.nextNode())) {
    const len = n.nodeValue.length;
    const ns = acc;
    const ne = acc + len;
    if (ne > h.start && ns < h.end) {
      frags.push([n, Math.max(0, h.start - ns), Math.min(len, h.end - ns)]);
    }
    acc = ne;
    if (acc >= h.end) break;
  }
  const lastNode = frags.length ? frags[frags.length - 1][0] : null; // fragment cuối (theo thứ tự đọc)
  // bọc từ cuối lên đầu để không làm lệch các fragment khác
  for (const [node, s, e] of frags.reverse()) {
    const r = document.createRange();
    r.setStart(node, s);
    r.setEnd(node, e);
    const mark = document.createElement('mark');
    mark.className = `hl hl-${h.color}` + (h.note ? ' has-note' : '');
    if (h.note && node === lastNode) mark.classList.add('note-end'); // chấm ghi chú chỉ ở cuối
    mark.dataset.hid = h.id;
    try { r.surroundContents(mark); } catch (_) { /* fragment không bọc được → bỏ qua */ }
  }
}

/* ── Render / refresh toàn bộ highlight của mục hiện tại ──────────────────── */

export function renderHighlights(prose, id, lang) {
  if (!prose) return;
  const hls = getHighlights(id, lang);
  const children = prose.children;
  for (const h of hls) {
    const block = children[h.blockIndex];
    if (!block) continue;
    if (block.textContent.slice(h.start, h.end) !== h.quote) continue; // nội dung đổi → degrade, bỏ qua
    applyOne(block, h);
  }
}

function removeAllMarks(prose) {
  $$('mark.hl', prose).forEach((m) => {
    const p = m.parentNode;
    while (m.firstChild) p.insertBefore(m.firstChild, m);
    p.removeChild(m);
  });
  prose.normalize();
}

function refresh() {
  const prose = getProse();
  if (!prose) return;
  const { id, lang } = ctx();
  removeAllMarks(prose);
  renderHighlights(prose, id, lang);
}

/* ── Thanh nổi khi quét chọn ──────────────────────────────────────────────── */

function colorDotsHTML(active) {
  return HL_COLORS.map((c) =>
    `<button class="hl-swatch hl-${c}${c === active ? ' on' : ''}" data-color="${c}" aria-label="${c}"></button>`
  ).join('');
}

function showToolbar() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return hideToolbar();
  const a = anchorFromSelection();
  const tb = $('#hl-toolbar');
  if (!a) return hideToolbar();
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  if (!rect.width && !rect.height) return hideToolbar();
  tb.innerHTML =
    `<span class="hl-swatches">${colorDotsHTML('')}</span>` +
    `<span class="hl-div"></span>` +
    `<button class="hl-note-btn" data-note="1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>Ghi chú</button>`;
  tb.classList.remove('hidden');
  tb.style.visibility = 'hidden';
  const r = tb.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - r.width / 2;
  left = Math.max(10, Math.min(left, window.innerWidth - r.width - 10));
  let top = rect.top - r.height - 10;
  if (top < 10) top = rect.bottom + 10;
  tb.style.left = `${left}px`;
  tb.style.top = `${top}px`;
  tb.style.visibility = '';

  tb.querySelectorAll('.hl-swatch').forEach((b) =>
    b.addEventListener('mousedown', (e) => { e.preventDefault(); createFromSelection(b.dataset.color, false); }));
  tb.querySelector('.hl-note-btn').addEventListener('mousedown', (e) => { e.preventDefault(); createFromSelection('amber', true); });
}

function hideToolbar() { $('#hl-toolbar').classList.add('hidden'); }

function createFromSelection(color, withNote) {
  const a = anchorFromSelection();
  if (!a) return hideToolbar();
  const { id, lang } = ctx();
  const rec = addHighlight(id, lang, { ...a, color, note: '' });
  window.getSelection().removeAllRanges();
  hideToolbar();
  refresh();
  if (withNote) openPopover(rec.id);
}

/* ── Popover sửa/xoá (đổi màu · ghi chú · xoá) ────────────────────────────── */

function findHl(hid) {
  const { id, lang } = ctx();
  return getHighlights(id, lang).find((h) => h.id === hid);
}

function openPopover(hid) {
  const rec = findHl(hid);
  if (!rec) return;
  editingHid = hid;
  const pop = $('#hl-popover');
  pop.innerHTML =
    `<div class="hp-row hp-swatches">${colorDotsHTML(rec.color)}</div>` +
    `<textarea class="hp-note" placeholder="Thêm ghi chú riêng cho đoạn này…" maxlength="600">${(rec.note || '').replace(/</g, '&lt;')}</textarea>` +
    `<div class="hp-actions">` +
      `<button class="hp-del"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>Xoá</button>` +
      `<button class="hp-save">Lưu ghi chú</button>` +
    `</div>`;
  pop.classList.remove('hidden');

  // định vị cạnh đoạn tô
  const mark = $(`mark.hl[data-hid="${hid}"]`);
  pop.style.visibility = 'hidden';
  const r = pop.getBoundingClientRect();
  const m = (mark || $('#modal')).getBoundingClientRect();
  let left = Math.min(m.left, window.innerWidth - r.width - 12);
  left = Math.max(12, left);
  let top = m.bottom + 8;
  if (top + r.height > window.innerHeight - 12) top = Math.max(12, m.top - r.height - 8);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  pop.style.visibility = '';

  pop.querySelectorAll('.hl-swatch').forEach((b) =>
    b.addEventListener('click', () => {
      const { id, lang } = ctx();
      updateHighlight(id, lang, hid, { color: b.dataset.color });
      pop.querySelectorAll('.hl-swatch').forEach((x) => x.classList.toggle('on', x === b));
      refresh();
    }));
  const ta = pop.querySelector('.hp-note');
  pop.querySelector('.hp-save').addEventListener('click', () => {
    const { id, lang } = ctx();
    updateHighlight(id, lang, hid, { note: ta.value.trim() });
    refresh();
    closePopover();
  });
  pop.querySelector('.hp-del').addEventListener('click', () => {
    const { id, lang } = ctx();
    removeHighlight(id, lang, hid);
    refresh();
    closePopover();
  });
  setTimeout(() => ta.focus(), 30);
}

function closePopover() { editingHid = null; $('#hl-popover').classList.add('hidden'); }

/* ── Wiring (1 lần) ───────────────────────────────────────────────────────── */

export function setupHighlighter(getCtx) {
  ctx = getCtx;
  const body = $('#modal-body');

  // mouseup trong nội dung: có vùng chọn → thanh nổi; click vào đoạn đã tô → popover
  body.addEventListener('mouseup', (e) => {
    const mark = e.target.closest && e.target.closest('mark.hl');
    const sel = window.getSelection();
    const hasSel = sel && !sel.isCollapsed && sel.toString().trim().length > 0;
    if (hasSel) { setTimeout(showToolbar, 0); return; }
    if (mark) { openPopover(mark.dataset.hid); return; }
  });

  // ẩn thanh nổi / popover khi cuộn hoặc click ra ngoài
  body.addEventListener('scroll', () => { hideToolbar(); if (!$('#hl-popover').classList.contains('hidden')) closePopover(); }, { passive: true });
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('#hl-toolbar') && !e.target.closest('mark.hl')) hideToolbar();
    // KHÔNG đóng popover khi bấm trong thanh nổi (nút "Ghi chú" vừa MỞ popover) hay trên đoạn tô
    if (!e.target.closest('#hl-popover') && !e.target.closest('mark.hl') && !e.target.closest('#hl-toolbar')) {
      if (!$('#hl-popover').classList.contains('hidden')) closePopover();
    }
  });
}

export function resetHighlightUI() { hideToolbar(); closePopover(); }
