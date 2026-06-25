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
import { setupAudio, setAudioBook, loadAudioFor, stopAudio, hideAudio, audioAvailable } from './audio';
import { setupKaraoke, wrapWords, resetKaraoke } from './karaoke';
import type { BookData, Lang, Section } from './types';

void isFeedbackEnabled; // form luôn hiển thị; helper giữ để dùng nếu cần

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) =>
  r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) =>
  Array.from(r.querySelectorAll<T>(s));

let book: BookData | null = null;
let current: Section | null = null;
let lang: Lang = 'vi';

/* ── So sánh PDF gốc ──────────────────────────────────────────────────────*/
const BASE = import.meta.env.BASE_URL;
let pdfUrl: string | null = null;
let pdfPages: Record<string, number> | null = null; // section id → số trang PDF
let pdfShownPage = 0; // trang iframe đang hiển thị (tránh reload thừa)

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

export function setBook(b: BookData, pdf: string | null = null) {
  book = b;
  setAudioBook(b.meta.id);
  if (pdf !== pdfUrl) {
    pdfUrl = pdf;
    pdfShownPage = 0; // sách mới → iframe nạp lại đúng trang khi mở
    const frame = $<HTMLIFrameElement>('#pdf-frame');
    if (frame) frame.removeAttribute('src');
    // map section → trang PDF (best-effort, để mở PDF nhảy đúng trang)
    pdfPages = null;
    if (pdf) {
      fetch(`${BASE}${b.meta.id}.pages.json`, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .then((m) => { pdfPages = m; })
        .catch(() => { pdfPages = null; });
    }
  }
  closePdfPane();
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

  const viBtn = $<HTMLButtonElement>('#lang-toggle [data-lang="vi"]')!;
  const enBtn = $<HTMLButtonElement>('#lang-toggle [data-lang="en"]')!;
  viBtn.disabled = !section.md_vi;
  enBtn.disabled = !section.md_en;

  renderBody();
  renderNav();
  setupFeedback();
  syncPdfPage(); // pane đang mở → nhảy PDF tới trang của mục mới
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
  closePdfPane();
  stopAudio();
  resetKaraoke();
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

  resetKaraoke();
  const art = document.createElement('article');
  art.className = 'prose';
  art.innerHTML = marked.parse(md || '') as string;
  // Chip OCR phải chạy TRƯỚC tooltip/highlight: chỉ thay node <em>, giữ nguyên
  // số <p> để attachParagraphTooltips/renderHighlights không lệch chỉ số.
  decorateOcrBadges(art);
  // Bọc <span> từng từ TRƯỚC tooltip/highlight (giữ khoảng trắng → offset không lệch).
  if (lang === 'vi' && audioAvailable(current.id)) wrapWords(art);
  body.appendChild(art);

  // Nút "So sánh PDF" ở header: chỉ hiện khi sách có PDF gốc.
  $('#cmp-toggle')!.classList.toggle('hidden', !pdfUrl);

  if (lang === 'vi' && current.aligned && current.md_en) attachParagraphTooltips(art);
  resetHighlightUI();
  renderHighlights(art, current.id, lang);

  // Audio "đọc sách" là bản narration tiếng Việt → chỉ khả dụng khi đang xem VI.
  if (lang === 'vi') loadAudioFor(current.id);
  else hideAudio();
}

/* ── Chip "đoạn gốc lỗi OCR" → mở PDF đối chiếu ───────────────────────────*/

const OCR_RE = /^\s*\[?\s*đoạn gốc.*lỗi OCR\s*\]?\s*$/i;

function decorateOcrBadges(art: HTMLElement) {
  $$<HTMLElement>('em', art).forEach((em) => {
    if (!OCR_RE.test(em.textContent || '')) return;
    const chip = document.createElement(pdfUrl ? 'button' : 'span');
    chip.className = 'ocr-badge';
    chip.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="3" y="4" width="7" height="16" rx="1.2"/><rect x="14" y="4" width="7" height="16" rx="1.2"/></svg>' +
      '<span>đoạn gốc lỗi OCR</span>';
    if (pdfUrl) {
      (chip as HTMLButtonElement).type = 'button';
      chip.title = 'Mở bản PDF gốc bên cạnh để tự cuộn tới đoạn này';
      chip.addEventListener('click', openPdfPane);
    } else {
      chip.title = 'Đoạn gốc bị lỗi nhận dạng (OCR)';
    }
    em.replaceWith(chip);
  });
}

/* ── PDF pane (split bên phải) ────────────────────────────────────────────*/

function pdfPageFor(): number {
  return (current && pdfPages && pdfPages[current.id]) || 1;
}

/* Nạp iframe ở đúng trang của section hiện tại. Đổi chỉ-hash (#page=) KHÔNG làm
 * native PDF viewer nhảy trang → ép nạp lại (PDF đã cache nên không tải lại 22MB). */
function showPdfPage(force = false) {
  if (!pdfUrl) return;
  const page = pdfPageFor();
  if (!force && page === pdfShownPage) return;
  const frame = $<HTMLIFrameElement>('#pdf-frame')!;
  const target = `${pdfUrl}#page=${page}`;
  if (pdfShownPage > 0) {
    // Native PDF viewer bỏ qua đổi chỉ-hash sau khi load → THAY MỚI iframe để
    // initial-load tôn trọng #page. URL không đổi path → PDF dùng cache, không tải lại 22MB.
    const fresh = frame.cloneNode(false) as HTMLIFrameElement;
    armPdfLoading(fresh);
    fresh.src = target;
    frame.replaceWith(fresh);
  } else {
    armPdfLoading(frame);
    frame.src = target;
  }
  pdfShownPage = page;
}

/* Hiện spinner "đang tải" trên pane PDF tới khi iframe load xong (có fallback). */
function armPdfLoading(frame: HTMLIFrameElement) {
  const ld = $('#pdf-loading');
  ld?.classList.remove('hidden');
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    ld?.classList.add('hidden');
    frame.removeEventListener('load', finish);
    clearTimeout(timer);
  };
  const timer = setTimeout(finish, 10000); // fallback nếu 'load' không fire
  frame.addEventListener('load', finish);
}

/* Đổi mục khi pane đang mở → nhảy PDF tới trang tương ứng. */
export function syncPdfPage() {
  if ($('#overlay')?.classList.contains('compare')) showPdfPage();
}

function openPdfPane() {
  if (!pdfUrl) return;
  // Viewport hẹp: split không đủ chỗ → mở PDF ở tab mới (vẫn đúng trang).
  if (window.innerWidth < 900) {
    window.open(`${pdfUrl}#page=${pdfPageFor()}`, '_blank', 'noopener');
    return;
  }
  showPdfPage();
  $('#overlay')!.classList.add('compare');
  $('#cmp-toggle')!.classList.add('on');
}

function closePdfPane() {
  // KHÔNG xoá src: giữ nguyên vị trí cuộn của user khi mở lại / chuyển mục.
  $('#overlay')?.classList.remove('compare');
  $('#cmp-toggle')?.classList.remove('on');
}

function togglePdfPane() {
  if ($('#overlay')!.classList.contains('compare')) closePdfPane();
  else openPdfPane();
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
  $('#cmp-toggle')!.addEventListener('click', togglePdfPane);
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
  setupAudio();
  setupKaraoke();

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
