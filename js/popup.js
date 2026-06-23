/* ════════════════════════════════════════════════════════════════════════════
 * popup.js — Modal đọc nội dung một section.
 *   • Render markdown (marked) → HTML, áp typography theme.
 *   • Toggle EN/VI (primary). Hover đoạn VI → tooltip EN (chỉ khi section.aligned).
 *   • Section thiếu bản VI → badge "đang cập nhật", ép hiển thị EN.
 *   • Form góp ý ở cuối → feedback.js.
 * ════════════════════════════════════════════════════════════════════════════ */

import { submitFeedback, isFeedbackEnabled } from './feedback.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

let current = null; // section đang mở
let lang = 'vi';
let meta = null;

marked.setOptions({ breaks: false, gfm: true });

/* ── Mở section ───────────────────────────────────────────────────────────*/

export function openSection(section, bookMeta) {
  current = section;
  meta = bookMeta;
  lang = section.hasVi ? 'vi' : 'en';

  $('#modal-crumb').textContent = `${bookMeta.titleVi} · ${section.chapter}`;
  $('#modal-title').textContent = lang === 'vi' ? section.title_vi : section.title_en;

  // Lang toggle khả dụng?
  const viBtn = $('#lang-toggle [data-lang="vi"]');
  const enBtn = $('#lang-toggle [data-lang="en"]');
  viBtn.disabled = !section.md_vi;
  enBtn.disabled = !section.md_en;
  viBtn.style.opacity = section.md_vi ? '' : '0.4';
  enBtn.style.opacity = section.md_en ? '' : '0.4';

  renderBody();
  setupFeedback();

  $('#overlay').classList.add('open');
  $('#modal-body').scrollTop = 0;
  document.body.style.overflow = 'hidden';
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

  // badge "đang cập nhật" khi xem mục chưa có VI
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

  // Hover tooltip EN cho từng đoạn VI (chỉ khi căn chỉnh sạch)
  if (lang === 'vi' && current.aligned && current.md_en) {
    attachParagraphTooltips(art);
  }
}

/* ── Tooltip EN cho đoạn VI ────────────────────────────────────────────────*/

function attachParagraphTooltips(art) {
  const enBlocks = (current.md_en || '').split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const ps = $$('p', art);
  if (ps.length !== enBlocks.length) return; // không khớp → bỏ qua an toàn
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
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  const r = tt.getBoundingClientRect();
  if (x + r.width > window.innerWidth - 10) x = e.clientX - r.width - pad;
  if (y + r.height > window.innerHeight - 10) y = e.clientY - r.height - pad;
  tt.style.left = `${x}px`;
  tt.style.top = `${y}px`;
}
function hideTooltip() {
  $('#tooltip').classList.remove('show');
}

/* ── Feedback form ────────────────────────────────────────────────────────*/

function setupFeedback() {
  const fb = $('#feedback');
  if (!isFeedbackEnabled()) {
    fb.classList.add('hidden');
    return;
  }
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
      book_id: meta.id,
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
    } else if (res.error === 'rate_limited') {
      setStatus(status, 'err', `Bạn gửi hơi nhiều — thử lại sau ${Math.ceil((res.retry_after || 0) / 60)} phút`);
    } else {
      setStatus(status, 'err', res.message || 'Gửi thất bại, thử lại sau');
    }
  };
}

function setStatus(el, kind, msg) {
  el.className = `status ${kind}`;
  el.textContent = msg;
}

/* ── Wiring chung (1 lần) ─────────────────────────────────────────────────*/

function initOnce() {
  $('#modal-close').addEventListener('click', closeModal);
  $('#overlay').addEventListener('click', (e) => {
    if (e.target.id === 'overlay') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#overlay').classList.contains('open')) closeModal();
  });
  $('#lang-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-lang]');
    if (!btn || btn.disabled) return;
    lang = btn.dataset.lang;
    renderBody();
  });
}

initOnce();
