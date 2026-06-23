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
  $('#modal-foot').classList.remove('fb-open'); // mỗi mục mở ra: panel góp ý gập lại

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
    prevBtn.dataset.tip = navTitle(book.sections[prevId]);
    prevBtn.onclick = () => openSection(prevId);
  } else { prevBtn.disabled = true; prevBtn.removeAttribute('data-tip'); prevBtn.onclick = null; }

  if (nextId) {
    nextBtn.disabled = false;
    nextBtn.dataset.tip = navTitle(book.sections[nextId]);
    nextBtn.onclick = () => openSection(nextId);
  } else { nextBtn.disabled = true; nextBtn.removeAttribute('data-tip'); nextBtn.onclick = null; }
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

/* ── Tooltip tên bài cho nút Trước/Tiếp (fixed, không bị cắt) ──────────────*/

function showNavTip(btn, kicker) {
  const tip = btn.dataset.tip;
  if (!tip || btn.disabled) return;
  const nt = $('#navtip');
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
function hideNavTip() { $('#navtip').classList.remove('show'); }

/* ── Feedback form ────────────────────────────────────────────────────────*/

function setupFeedback() {
  const fb = $('#feedback');
  // Luôn hiện ô góp ý — kể cả khi chưa cấu hình worker (để gõ/đọc thử ngay).
  // Khi đã có WORKER_URL → gửi Telegram thật; chưa có → báo nhẹ nhàng.
  fb.classList.remove('hidden');

  const nameEl = $('#fb-name');
  const commentEl = $('#fb-comment');
  const status = $('#fb-status');
  const sendBtn = $('#fb-send');

  nameEl.value = localStorage.getItem('book-fb-name') || '';
  commentEl.value = '';
  status.textContent = '';
  status.className = 'status';
  const c = $('#fb-count');
  if (c) { c.textContent = '0 / 1000'; c.classList.remove('warn'); }

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
    else if (res.error === 'disabled') setStatus(status, '', '⚙️ Tính năng gửi Telegram sẽ bật sau khi cấu hình worker.');
    else if (res.error === 'rate_limited') setStatus(status, 'err', `Bạn gửi hơi nhiều — thử lại sau ${Math.ceil((res.retry_after || 0) / 60)} phút`);
    else setStatus(status, 'err', res.message || 'Gửi thất bại, thử lại sau');
  };
}

function setStatus(el, kind, msg) { el.className = `status ${kind}`; el.textContent = msg; }

/* ── Wiring chung (1 lần) ─────────────────────────────────────────────────*/

function initOnce() {
  $('#modal-close').addEventListener('click', closeModal);
  $('#note-toggle').addEventListener('click', () => {
    const foot = $('#modal-foot');
    foot.classList.toggle('fb-open');
    if (foot.classList.contains('fb-open')) setTimeout(() => $('#fb-name').focus(), 80);
  });

  // tooltip tên bài (fixed) cho prev/next
  $('#nav-prev').addEventListener('mouseenter', (e) => showNavTip(e.currentTarget, 'Mục trước'));
  $('#nav-next').addEventListener('mouseenter', (e) => showNavTip(e.currentTarget, 'Mục tiếp theo'));
  $('#nav-prev').addEventListener('mouseleave', hideNavTip);
  $('#nav-next').addEventListener('mouseleave', hideNavTip);
  $('#nav-prev').addEventListener('click', hideNavTip);
  $('#nav-next').addEventListener('click', hideNavTip);

  // char counter composer
  const cmt = $('#fb-comment');
  cmt.addEventListener('input', () => {
    const n = cmt.value.length;
    const c = $('#fb-count');
    c.textContent = `${n} / 1000`;
    c.classList.toggle('warn', n > 900);
  });
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
