/* ════════════════════════════════════════════════════════════════════════════
 * highlight.ts — Tô đậm (highlight) + ghi chú trên nội dung popup.
 *   Port gần như nguyên bản từ js/highlight.js — vẫn thao tác DOM theo #id
 *   (Range/TreeWalker). React render scaffold #modal-body / #hl-* một lần, module
 *   này tự tìm node và mutate; React KHÔNG sở hữu subtree .prose.
 *   Highlight gắn theo (sectionId, lang) — xem reading-state.ts.
 * ════════════════════════════════════════════════════════════════════════════ */

import { getHighlights, addHighlight, updateHighlight, removeHighlight } from './reading-state';
import type { Highlight, Lang } from './types';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) =>
  r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) =>
  Array.from(r.querySelectorAll<T>(s));

export const HL_COLORS = ['amber', 'green', 'sky', 'rose', 'violet'];

interface Ctx {
  id: string | null;
  lang: Lang;
}
let ctx: () => Ctx = () => ({ id: null, lang: 'vi' });
let editingHid: string | null = null;

/* ── Truy vấn DOM ─────────────────────────────────────────────────────────── */

const getProse = () => $<HTMLElement>('#modal-body .prose');

function blockOf(node: Node, prose: HTMLElement): Element | null {
  let el: Element | null = node.nodeType === 3 ? (node.parentElement as Element) : (node as Element);
  while (el && el.parentElement !== prose) el = el.parentElement;
  return el && el.parentElement === prose ? el : null;
}

function textOffset(block: Element, node: Node, offsetInNode: number): number {
  const r = document.createRange();
  r.setStart(block, 0);
  r.setEnd(node, offsetInNode);
  return r.toString().length;
}

/* ── Lấy "mỏ neo" từ vùng đang chọn ───────────────────────────────────────── */

interface Anchor {
  blockIndex: number;
  start: number;
  end: number;
  quote: string;
}

function anchorFromSelection(): Anchor | null {
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
  const text = b1.textContent || '';
  const quote = text.slice(start, end).trim();
  if (quote.length < 1) return null;
  const lead = text.slice(start, end).length - text.slice(start, end).trimStart().length;
  start += lead;
  end = start + quote.length;
  return { blockIndex, start, end, quote };
}

/* ── Bọc <mark> cho một highlight đã neo ──────────────────────────────────── */

function applyOne(block: Element, h: Highlight) {
  const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let acc = 0;
  const frags: Array<[Text, number, number]> = [];
  let n: Node | null;
  while ((n = w.nextNode())) {
    const tn = n as Text;
    const len = tn.nodeValue!.length;
    const ns = acc;
    const ne = acc + len;
    if (ne > h.start && ns < h.end) {
      frags.push([tn, Math.max(0, h.start - ns), Math.min(len, h.end - ns)]);
    }
    acc = ne;
    if (acc >= h.end) break;
  }
  const lastNode = frags.length ? frags[frags.length - 1][0] : null;
  for (const [node, s, e] of frags.reverse()) {
    const r = document.createRange();
    r.setStart(node, s);
    r.setEnd(node, e);
    const mark = document.createElement('mark');
    mark.className = `hl hl-${h.color}` + (h.note ? ' has-note' : '');
    if (h.note && node === lastNode) mark.classList.add('note-end');
    mark.dataset.hid = h.id;
    try {
      r.surroundContents(mark);
    } catch {
      /* fragment không bọc được → bỏ qua */
    }
  }
}

/* ── Render / refresh toàn bộ highlight của mục hiện tại ──────────────────── */

export function renderHighlights(prose: HTMLElement | null, id: string, lang: Lang) {
  if (!prose) return;
  const hls = getHighlights(id, lang);
  const children = prose.children;
  for (const h of hls) {
    const block = children[h.blockIndex];
    if (!block) continue;
    if ((block.textContent || '').slice(h.start, h.end) !== h.quote) continue; // nội dung đổi → bỏ qua
    applyOne(block, h);
  }
}

function removeAllMarks(prose: HTMLElement) {
  $$<HTMLElement>('mark.hl', prose).forEach((m) => {
    const p = m.parentNode!;
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
  if (id) renderHighlights(prose, id, lang);
}

/* ── Thanh nổi khi quét chọn ──────────────────────────────────────────────── */

function colorDotsHTML(active: string) {
  return HL_COLORS.map(
    (c) =>
      `<button class="hl-swatch hl-${c}${c === active ? ' on' : ''}" data-color="${c}" aria-label="${c}"></button>`
  ).join('');
}

function showToolbar() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return hideToolbar();
  const a = anchorFromSelection();
  const tb = $<HTMLElement>('#hl-toolbar')!;
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

  tb.querySelectorAll<HTMLElement>('.hl-swatch').forEach((b) =>
    b.addEventListener('mousedown', (e) => {
      e.preventDefault();
      createFromSelection(b.dataset.color!, false);
    })
  );
  tb.querySelector<HTMLElement>('.hl-note-btn')!.addEventListener('mousedown', (e) => {
    e.preventDefault();
    createFromSelection('amber', true);
  });
}

function hideToolbar() {
  $<HTMLElement>('#hl-toolbar')?.classList.add('hidden');
}

function createFromSelection(color: string, withNote: boolean) {
  const a = anchorFromSelection();
  if (!a) return hideToolbar();
  const { id, lang } = ctx();
  if (!id) return hideToolbar();
  const rec = addHighlight(id, lang, { ...a, color, note: '' });
  window.getSelection()?.removeAllRanges();
  hideToolbar();
  refresh();
  if (withNote) openPopover(rec.id);
}

/* ── Popover sửa/xoá (đổi màu · ghi chú · xoá) ────────────────────────────── */

function findHl(hid: string): Highlight | undefined {
  const { id, lang } = ctx();
  if (!id) return undefined;
  return getHighlights(id, lang).find((h) => h.id === hid);
}

function openPopover(hid: string) {
  const rec = findHl(hid);
  if (!rec) return;
  editingHid = hid;
  const pop = $<HTMLElement>('#hl-popover')!;
  pop.innerHTML =
    `<div class="hp-row hp-swatches">${colorDotsHTML(rec.color)}</div>` +
    `<textarea class="hp-note" placeholder="Thêm ghi chú riêng cho đoạn này…" maxlength="600">${(rec.note || '').replace(/</g, '&lt;')}</textarea>` +
    `<div class="hp-actions">` +
    `<button class="hp-del"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>Xoá</button>` +
    `<button class="hp-save">Lưu ghi chú</button>` +
    `</div>`;
  pop.classList.remove('hidden');

  const mark = $<HTMLElement>(`mark.hl[data-hid="${hid}"]`);
  pop.style.visibility = 'hidden';
  const r = pop.getBoundingClientRect();
  const m = (mark || $<HTMLElement>('#modal')!).getBoundingClientRect();
  let left = Math.min(m.left, window.innerWidth - r.width - 12);
  left = Math.max(12, left);
  let top = m.bottom + 8;
  if (top + r.height > window.innerHeight - 12) top = Math.max(12, m.top - r.height - 8);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  pop.style.visibility = '';

  pop.querySelectorAll<HTMLElement>('.hl-swatch').forEach((b) =>
    b.addEventListener('click', () => {
      const { id, lang } = ctx();
      if (!id) return;
      updateHighlight(id, lang, hid, { color: b.dataset.color });
      pop.querySelectorAll('.hl-swatch').forEach((x) => x.classList.toggle('on', x === b));
      refresh();
    })
  );
  const ta = pop.querySelector<HTMLTextAreaElement>('.hp-note')!;
  pop.querySelector<HTMLElement>('.hp-save')!.addEventListener('click', () => {
    const { id, lang } = ctx();
    if (!id) return;
    updateHighlight(id, lang, hid, { note: ta.value.trim() });
    refresh();
    closePopover();
  });
  pop.querySelector<HTMLElement>('.hp-del')!.addEventListener('click', () => {
    const { id, lang } = ctx();
    if (!id) return;
    removeHighlight(id, lang, hid);
    refresh();
    closePopover();
  });
  setTimeout(() => ta.focus(), 30);
}

function closePopover() {
  editingHid = null;
  $<HTMLElement>('#hl-popover')?.classList.add('hidden');
}

/* ── Tooltip hiện ghi chú khi hover đoạn đã ghi chú ───────────────────────── */

function showNoteTip(mark: HTMLElement, e: MouseEvent) {
  const rec = findHl(mark.dataset.hid!);
  if (!rec || !rec.note) return;
  const tip = $<HTMLElement>('#hl-note-tip')!;
  tip.innerHTML =
    '<span class="nt-label">Ghi chú</span><span class="nt-body"></span><span class="nt-hint">Bấm để sửa</span>';
  tip.querySelector<HTMLElement>('.nt-body')!.textContent = rec.note;
  tip.classList.remove('hidden');
  positionNoteTip(e);
  $<HTMLElement>('#tooltip')?.classList.remove('show'); // ẩn tooltip EN nếu đang hiện
}

function positionNoteTip(e: MouseEvent) {
  const tip = $<HTMLElement>('#hl-note-tip')!;
  const pad = 14;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  const r = tip.getBoundingClientRect();
  if (x + r.width > window.innerWidth - 10) x = e.clientX - r.width - pad;
  if (y + r.height > window.innerHeight - 10) y = e.clientY - r.height - pad;
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}

function hideNoteTip() {
  $<HTMLElement>('#hl-note-tip')?.classList.add('hidden');
}

/* ── Wiring (1 lần) ───────────────────────────────────────────────────────── */

export function setupHighlighter(getCtx: () => Ctx) {
  ctx = getCtx;
  const body = $<HTMLElement>('#modal-body')!;

  body.addEventListener('mouseup', (e) => {
    const mark = (e.target as Element).closest?.('mark.hl') as HTMLElement | null;
    const sel = window.getSelection();
    const hasSel = sel && !sel.isCollapsed && sel.toString().trim().length > 0;
    if (hasSel) {
      setTimeout(showToolbar, 0);
      return;
    }
    if (mark) {
      openPopover(mark.dataset.hid!);
      return;
    }
  });

  body.addEventListener('mouseover', (e) => {
    const mk = (e.target as Element).closest?.('mark.hl.has-note') as HTMLElement | null;
    if (mk) showNoteTip(mk, e as MouseEvent);
  });
  body.addEventListener('mousemove', (e) => {
    const mk = (e.target as Element).closest?.('mark.hl.has-note') as HTMLElement | null;
    if (mk) positionNoteTip(e as MouseEvent);
    else if (!$<HTMLElement>('#hl-note-tip')!.classList.contains('hidden')) hideNoteTip();
  });
  body.addEventListener('mouseout', (e) => {
    const ev = e as MouseEvent;
    const mk = (ev.target as Element).closest?.('mark.hl.has-note') as HTMLElement | null;
    const to = ev.relatedTarget as Element | null;
    if (mk && (!to || !to.closest || !to.closest('mark.hl.has-note'))) hideNoteTip();
  });

  body.addEventListener(
    'scroll',
    () => {
      hideToolbar();
      hideNoteTip();
      if (!$<HTMLElement>('#hl-popover')!.classList.contains('hidden')) closePopover();
    },
    { passive: true }
  );
  document.addEventListener('mousedown', (e) => {
    const t = e.target as Element;
    if (!t.closest('#hl-toolbar') && !t.closest('mark.hl')) hideToolbar();
    if (!t.closest('#hl-popover') && !t.closest('mark.hl') && !t.closest('#hl-toolbar')) {
      if (!$<HTMLElement>('#hl-popover')!.classList.contains('hidden')) closePopover();
    }
  });
}

export function resetHighlightUI() {
  hideToolbar();
  closePopover();
  hideNoteTip();
}

void editingHid; // giữ tham chiếu (trạng thái nội bộ popover đang mở)
