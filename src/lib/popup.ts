/* ════════════════════════════════════════════════════════════════════════════
 * popup.ts — Modal đọc nội dung một section (port từ js/popup.js).
 *   Imperative: render markdown (marked) vào #modal-body .prose, toggle EN/VI,
 *   điều hướng Trước/Tiếp, theo dõi cuộn → tiến độ, tooltip EN, form góp ý.
 *   React render scaffold (#overlay/#modal/...) một lần rồi gọi initReader().
 * ════════════════════════════════════════════════════════════════════════════ */

import { marked } from 'marked';
import { submitFeedback, isFeedbackEnabled } from './feedback';
import { markRead, setLast } from './reading-state';
import { renderHighlights, setupHighlighter, resetHighlightUI } from './highlight';
import type { BookData, Lang, Section } from './types';

void isFeedbackEnabled; // form luôn hiển thị; helper giữ để dùng nếu cần

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) =>
  r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) =>
  Array.from(r.querySelectorAll<T>(s));

let book: BookData | null = null;
let current: Section | null = null;
let lang: Lang = 'vi';

/* ── Theo dõi tiến độ đọc ──────────────────────────────────────────────────*/
let suppressTrack = false;
let dwellTimer: ReturnType<typeof setTimeout> | null = null;
let lastSaveAt = 0;

function markReadCurrent() {
  if (!current) return;
  markRead(current.id);
}

function saveLast(force = false) {
  if (!current || suppressTrack) return;
  const t = Date.now();
  if (!force && t - lastSaveAt < 500) return;
  lastSaveAt = t;
  setLast(current.id, lang, $('#modal-body')!.scrollTop, { title: navTitle(current) });
}

function onBodyScroll() {
  if (!current || suppressTrack) return;
  saveLast();
  const body = $('#modal-body')!;
  if (body.scrollTop + body.clientHeight >= body.scrollHeight - 40) markReadCurrent();
}

function armDwell() {
  if (dwellTimer) clearTimeout(dwellTimer);
  dwellTimer = setTimeout(() => {
    const body = $('#modal-body')!;
    if (current && body.scrollHeight <= body.clientHeight + 8) markReadCurrent();
  }, 2500);
}

marked.setOptions({ breaks: false, gfm: true });

export function setBook(b: BookData) {
  book = b;
}

/* ── Mở section theo id ───────────────────────────────────────────────────*/

export function openSection(id: string, opts: { lang?: Lang; scrollTop?: number } = {}) {
  if (!book) return;
  const section = book.sections[id];
  if (!section) return;
  current = section;
  const wl = opts.lang;
  lang =
    (wl === 'vi' && section.md_vi) || (wl === 'en' && section.md_en)
      ? wl
      : section.hasVi
        ? 'vi'
        : 'en';

  $('#modal-crumb')!.textContent = `${book.meta.titleVi} · ${section.chapter}`;

  const viBtn = $<HTMLButtonElement>('#lang-toggle [data-lang="vi"]')!;
  const enBtn = $<HTMLButtonElement>('#lang-toggle [data-lang="en"]')!;
  viBtn.disabled = !section.md_vi;
  enBtn.disabled = !section.md_en;

  renderBody();
  renderNav();
  setupFeedback();
  $('#modal-foot')!.classList.remove('fb-open');

  $('#overlay')!.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Khôi phục vị trí cuộn SAU khi render (tránh markRead nhầm). setTimeout (KHÔNG rAF).
  const body = $('#modal-body')!;
  suppressTrack = true;
  if (dwellTimer) clearTimeout(dwellTimer);
  body.scrollTop = 0;
  setTimeout(() => {
    body.scrollTop = opts.scrollTop ? Math.min(opts.scrollTop, body.scrollHeight) : 0;
    setTimeout(() => {
      suppressTrack = false;
      saveLast(true);
      armDwell();
    }, 40);
  }, 0);
}

export function closeModal() {
  saveLast(true);
  if (dwellTimer) clearTimeout(dwellTimer);
  resetHighlightUI();
  $('#overlay')?.classList.remove('open');
  document.body.style.overflow = '';
  hideTooltip();
}

export function isOpen() {
  return Boolean($('#overlay')?.classList.contains('open'));
}

/* ── Render body theo ngôn ngữ ────────────────────────────────────────────*/

function renderBody() {
  if (!current) return;
  const md = lang === 'vi' ? current.md_vi : current.md_en;
  const body = $('#modal-body')!;
  body.innerHTML = '';

  $('#modal-title')!.textContent = lang === 'vi' ? current.title_vi : current.title_en;
  $$<HTMLElement>('#lang-toggle button').forEach((b) =>
    b.classList.toggle('active', b.dataset.lang === lang)
  );

  if (lang === 'en' && !current.md_vi) {
    const badge = document.createElement('div');
    badge.className = 'vi-pending';
    badge.textContent =
      '🇻🇳 Bản tiếng Việt đang được cập nhật — tạm hiển thị bản gốc tiếng Anh';
    body.appendChild(badge);
  }

  const art = document.createElement('article');
  art.className = 'prose';
  art.innerHTML = marked.parse(md || '') as string;
  body.appendChild(art);

  if (lang === 'vi' && current.aligned && current.md_en) attachParagraphTooltips(art);
  resetHighlightUI();
  renderHighlights(art, current.id, lang);
}

/* ── Điều hướng Trước / Tiếp ──────────────────────────────────────────────*/

function renderNav() {
  if (!book || !current) return;
  const order = book.order || Object.keys(book.sections);
  const i = order.indexOf(current.id);
  const prevId = i > 0 ? order[i - 1] : null;
  const nextId = i >= 0 && i < order.length - 1 ? order[i + 1] : null;

  const prevBtn = $<HTMLButtonElement>('#nav-prev')!;
  const nextBtn = $<HTMLButtonElement>('#nav-next')!;

  if (prevId) {
    prevBtn.disabled = false;
    prevBtn.dataset.tip = navTitle(book.sections[prevId]);
    prevBtn.onclick = () => openSection(prevId);
  } else {
    prevBtn.disabled = true;
    prevBtn.removeAttribute('data-tip');
    prevBtn.onclick = null;
  }

  if (nextId) {
    nextBtn.disabled = false;
    nextBtn.dataset.tip = navTitle(book.sections[nextId]);
    nextBtn.onclick = () => {
      markReadCurrent();
      openSection(nextId);
    };
  } else {
    nextBtn.disabled = true;
    nextBtn.removeAttribute('data-tip');
    nextBtn.onclick = null;
  }
}

function navTitle(sec: Section): string {
  const t = sec.title_vi || sec.title_en || '';
  return t === 'Tổng quan chương' ? `${sec.chapter} — Tổng quan` : t;
}

/* ── Tooltip EN cho đoạn VI ────────────────────────────────────────────────*/

function attachParagraphTooltips(art: HTMLElement) {
  if (!current) return;
  const enBlocks = (current.md_en || '')
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  const ps = $$<HTMLElement>('p', art);
  if (ps.length !== enBlocks.length) return;
  ps.forEach((p, i) => {
    p.dataset.en = enBlocks[i].replace(/[*_`#>]/g, '').trim();
    p.addEventListener('mouseenter', (e) => showTooltip(e, p.dataset.en!));
    p.addEventListener('mousemove', moveTooltip);
    p.addEventListener('mouseleave', hideTooltip);
  });
}

function showTooltip(e: MouseEvent, text: string) {
  if ((e.target as Element).closest?.('mark.hl.has-note')) return;
  const tt = $('#tooltip')!;
  tt.textContent = text;
  tt.classList.add('show');
  moveTooltip(e);
}
function moveTooltip(e: MouseEvent) {
  if ((e.target as Element).closest?.('mark.hl.has-note')) {
    hideTooltip();
    return;
  }
  const tt = $('#tooltip')!;
  const pad = 14;
  let x = e.clientX + pad,
    y = e.clientY + pad;
  const r = tt.getBoundingClientRect();
  if (x + r.width > window.innerWidth - 10) x = e.clientX - r.width - pad;
  if (y + r.height > window.innerHeight - 10) y = e.clientY - r.height - pad;
  tt.style.left = `${x}px`;
  tt.style.top = `${y}px`;
}
function hideTooltip() {
  $('#tooltip')?.classList.remove('show');
}

/* ── Tooltip tên bài cho nút Trước/Tiếp (fixed) ───────────────────────────*/

function showNavTip(btn: HTMLButtonElement, kicker: string) {
  const tip = btn.dataset.tip;
  if (!tip || btn.disabled) return;
  const nt = $('#navtip')!;
  nt.innerHTML = `<span class="nt-kicker">${kicker}</span>${tip.replace(/</g, '&lt;')}`;
  nt.style.visibility = 'hidden';
  nt.classList.add('show');
  const b = btn.getBoundingClientRect();
  const r = nt.getBoundingClientRect();
  let left = b.left + b.width / 2 - r.width / 2;
  left = Math.max(10, Math.min(left, window.innerWidth - r.width - 10));
  nt.style.left = `${left}px`;
  nt.style.top = `${b.top - r.height - 9}px`;
  nt.style.visibility = '';
}
function hideNavTip() {
  $('#navtip')!.classList.remove('show');
}

/* ── Feedback form ────────────────────────────────────────────────────────*/

function setupFeedback() {
  const fb = $('#feedback')!;
  fb.classList.remove('hidden');

  const nameEl = $<HTMLInputElement>('#fb-name')!;
  const commentEl = $<HTMLTextAreaElement>('#fb-comment')!;
  const status = $('#fb-status')!;
  const sendBtn = $<HTMLButtonElement>('#fb-send')!;

  nameEl.value = localStorage.getItem('book-fb-name') || '';
  commentEl.value = '';
  status.textContent = '';
  status.className = 'status';
  const c = $('#fb-count');
  if (c) {
    c.textContent = '0 / 1000';
    c.classList.remove('warn');
  }

  sendBtn.onclick = async () => {
    if (!book || !current) return;
    const name = nameEl.value.trim();
    const comment = commentEl.value.trim();
    if (name.length < 1) return setStatus(status, 'err', 'Nhập tên của bạn');
    if (comment.length < 5) return setStatus(status, 'err', 'Viết ít nhất 5 ký tự');

    localStorage.setItem('book-fb-name', name);
    sendBtn.disabled = true;
    setStatus(status, '', 'Đang gửi…');

    const res = await submitFeedback({
      book_id: book.meta.id,
      chapter: current.chapter,
      section_id: current.id,
      section_title: current.title_vi || current.title_en,
      name,
      comment,
    });

    sendBtn.disabled = false;
    if (res.ok) {
      setStatus(status, 'ok', '✓ Đã gửi! Cảm ơn bạn.');
      commentEl.value = '';
    } else if (res.error === 'disabled')
      setStatus(status, '', '⚙️ Tính năng gửi Telegram sẽ bật sau khi cấu hình worker.');
    else if (res.error === 'rate_limited')
      setStatus(
        status,
        'err',
        `Bạn gửi hơi nhiều — thử lại sau ${Math.ceil((res.retry_after || 0) / 60)} phút`
      );
    else setStatus(status, 'err', res.message || 'Gửi thất bại, thử lại sau');
  };
}

function setStatus(el: Element, kind: string, msg: string) {
  el.className = `status ${kind}`;
  el.textContent = msg;
}

/* ── Wiring chung (1 lần) — gọi từ React sau khi scaffold mounted ─────────*/

let inited = false;
export function initReader() {
  if (inited) return;
  inited = true;

  $('#modal-close')!.addEventListener('click', closeModal);
  $('#note-toggle')!.addEventListener('click', () => {
    const foot = $('#modal-foot')!;
    foot.classList.toggle('fb-open');
    if (foot.classList.contains('fb-open')) setTimeout(() => $<HTMLInputElement>('#fb-name')!.focus(), 80);
  });

  $<HTMLButtonElement>('#nav-prev')!.addEventListener('mouseenter', (e) =>
    showNavTip(e.currentTarget as HTMLButtonElement, 'Mục trước')
  );
  $<HTMLButtonElement>('#nav-next')!.addEventListener('mouseenter', (e) =>
    showNavTip(e.currentTarget as HTMLButtonElement, 'Mục tiếp theo')
  );
  $('#nav-prev')!.addEventListener('mouseleave', hideNavTip);
  $('#nav-next')!.addEventListener('mouseleave', hideNavTip);
  $('#nav-prev')!.addEventListener('click', hideNavTip);
  $('#nav-next')!.addEventListener('click', hideNavTip);

  $('#modal-body')!.addEventListener('scroll', onBodyScroll, { passive: true });

  setupHighlighter(() => ({ id: current && current.id, lang }));

  const cmt = $<HTMLTextAreaElement>('#fb-comment')!;
  cmt.addEventListener('input', () => {
    const n = cmt.value.length;
    const c = $('#fb-count')!;
    c.textContent = `${n} / 1000`;
    c.classList.toggle('warn', n > 900);
  });
  $('#overlay')!.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'overlay') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') closeModal();
    else if (e.key === 'ArrowRight' && !$<HTMLButtonElement>('#nav-next')!.disabled)
      $<HTMLButtonElement>('#nav-next')!.click();
    else if (e.key === 'ArrowLeft' && !$<HTMLButtonElement>('#nav-prev')!.disabled)
      $<HTMLButtonElement>('#nav-prev')!.click();
  });
  $('#lang-toggle')!.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('button[data-lang]');
    if (!btn || btn.disabled) return;
    lang = btn.dataset.lang as Lang;
    renderBody();
  });
}
