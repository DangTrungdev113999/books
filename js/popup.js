/* ════════════════════════════════════════════════════════════════════════════
 * popup.js — Modal đọc nội dung một section.
 *   • Render markdown (marked) → HTML, áp typography theme.
 *   • Toggle EN/VI (primary). Hover đoạn VI → tooltip EN (khi section.aligned).
 *   • Section thiếu bản VI → badge "đang cập nhật", ép hiển thị EN.
 *   • Điều hướng Trước / Mục tiếp theo (theo book.order).
 *   • Form góp ý → feedback.js.
 * ════════════════════════════════════════════════════════════════════════════ */

import { submitFeedback, isFeedbackEnabled } from './feedback.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

let book = null; // { meta, order, sections }
let current = null; // section đang mở
let lang = 'vi';

marked.setOptions({ breaks: false, gfm: true });

export function setBook(b) { book = b; }

/* ── Mở section theo id ───────────────────────────────────────────────────*/

export function openSection(id) {
  const section = book.sections[id];
  if (!section) return;
  current = section;
  lang = section.hasVi ? 'vi' : 'en';

  $('#modal-crumb').textContent = `${book.meta.titleVi} · ${section.chapter}`;

  const viBtn = $('#lang-toggle [data-lang="vi"]');
  const enBtn = $('#lang-toggle [data-lang="en"]');
  viBtn.disabled = !section.md_vi;
  enBtn.disabled = !section.md_en;

  renderBody();
  renderNav();
  setupFeedback();

  $('#overlay').classList.add('open');
  $('#modal-body').scrollTop = 0;
  document.body.style.overflow = 'hidden';
  // đồng bộ highlight sidebar (nếu là mục thuộc 1 chương đơn)
}

function closeModal() {
  $('#overlay').classList.remove('open');
  document.body.style.overflow = '';
  hideTooltip();
}

/* ── Render body theo ngôn ngữ ────────────────────────────────────────────*/

function renderBody() {
  const md = lang === 'vi' ? current.md_vi : current.md_en;
  const body = $('#modal-body');
  body.innerHTML = '';

  $('#modal-title').textContent = lang === 'vi' ? current.title_vi : current.title_en;
  $$('#lang-toggle button').forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));

  if (lang === 'en' && !current.md_vi) {
    const badge = document.createElement('div');
    badge.className = 'vi-pending';
    badge.textContent = '🇻🇳 Bản tiếng Việt đang được cập nhật — tạm hiển thị bản gốc tiếng Anh';
    body.appendChild(badge);
  }

  const art = document.createElement('article');
  art.className = 'prose';
  art.innerHTML = marked.parse(md || '');
  body.appendChild(art);

  if (lang === 'vi' && current.aligned && current.md_en) attachParagraphTooltips(art);
}

/* ── Điều hướng Trước / Tiếp ──────────────────────────────────────────────*/

function renderNav() {
  const order = book.order || Object.keys(book.sections);
  const i = order.indexOf(current.id);
  const prevId = i > 0 ? order[i - 1] : null;
  const nextId = i >= 0 && i < order.length - 1 ? order[i + 1] : null;

  const prevBtn = $('#nav-prev');
  const nextBtn = $('#nav-next');

  if (prevId) {
    prevBtn.disabled = false;
    $('#prev-title').textContent = navTitle(book.sections[prevId]);
    prevBtn.onclick = () => { openSection(prevId); $('#modal-body').scrollTop = 0; };
  } else { prevBtn.disabled = true; $('#prev-title').textContent = '—'; prevBtn.onclick = null; }

  if (nextId) {
    nextBtn.disabled = false;
    $('#next-title').textContent = navTitle(book.sections[nextId]);
    nextBtn.onclick = () => { openSection(nextId); $('#modal-body').scrollTop = 0; };
  } else { nextBtn.disabled = true; $('#next-title').textContent = '—'; nextBtn.onclick = null; }
}

function navTitle(sec) {
  const t = sec.title_vi || sec.title_en || '';
  return t === 'Tổng quan chương' ? `${sec.chapter} — Tổng quan` : t;
}

/* ── Tooltip EN cho đoạn VI ────────────────────────────────────────────────*/

function attachParagraphTooltips(art) {
  const enBlocks = (current.md_en || '').split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const ps = $$('p', art);
  if (ps.length !== enBlocks.length) return;
  ps.forEach((p, i) => {
    p.dataset.en = enBlocks[i].replace(/[*_`#>]/g, '').trim();
    p.addEventListener('mouseenter', (e) => showTooltip(e, p.dataset.en));
    p.addEventListener('mousemove', moveTooltip);
    p.addEventListener('mouseleave', hideTooltip);
  });
}

function showTooltip(e, text) {
  const tt = $('#tooltip');
  tt.textContent = text;
  tt.classList.add('show');
  moveTooltip(e);
}
function moveTooltip(e) {
  const tt = $('#tooltip');
  const pad = 14;
  let x = e.clientX + pad, y = e.clientY + pad;
  const r = tt.getBoundingClientRect();
  if (x + r.width > window.innerWidth - 10) x = e.clientX - r.width - pad;
  if (y + r.height > window.innerHeight - 10) y = e.clientY - r.height - pad;
  tt.style.left = `${x}px`;
  tt.style.top = `${y}px`;
}
function hideTooltip() { $('#tooltip').classList.remove('show'); }

/* ── Feedback form ────────────────────────────────────────────────────────*/

function setupFeedback() {
  const fb = $('#feedback');
  if (!isFeedbackEnabled()) { fb.classList.add('hidden'); return; }
  fb.classList.remove('hidden');

  const nameEl = $('#fb-name');
  const commentEl = $('#fb-comment');
  const status = $('#fb-status');
  const sendBtn = $('#fb-send');

  nameEl.value = localStorage.getItem('book-fb-name') || '';
  commentEl.value = '';
  status.textContent = '';
  status.className = 'status';

  sendBtn.onclick = async () => {
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
      name, comment,
    });

    sendBtn.disabled = false;
    if (res.ok) { setStatus(status, 'ok', '✓ Đã gửi! Cảm ơn bạn.'); commentEl.value = ''; }
    else if (res.error === 'rate_limited') setStatus(status, 'err', `Bạn gửi hơi nhiều — thử lại sau ${Math.ceil((res.retry_after || 0) / 60)} phút`);
    else setStatus(status, 'err', res.message || 'Gửi thất bại, thử lại sau');
  };
}

function setStatus(el, kind, msg) { el.className = `status ${kind}`; el.textContent = msg; }

/* ── Wiring chung (1 lần) ─────────────────────────────────────────────────*/

function initOnce() {
  $('#modal-close').addEventListener('click', closeModal);
  $('#overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay') closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (!$('#overlay').classList.contains('open')) return;
    if (e.key === 'Escape') closeModal();
    else if (e.key === 'ArrowRight' && !$('#nav-next').disabled) $('#nav-next').click();
    else if (e.key === 'ArrowLeft' && !$('#nav-prev').disabled) $('#nav-prev').click();
  });
  $('#lang-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-lang]');
    if (!btn || btn.disabled) return;
    lang = btn.dataset.lang;
    renderBody();
  });
}

initOnce();
