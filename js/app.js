/* ════════════════════════════════════════════════════════════════════════════
 * app.js — Entry chính của trình đọc mindmap.
 *   • Nạp data/books.json → chọn sách → nạp data/<book>.json
 *   • Render cả cây sách bằng markmap (1 cây lớn, mặc định mở tới chương)
 *   • Sidebar: nhóm → chương; phân biệt state "đọc" (lá → popup) vs "xổ" (chương)
 *   • Click lá (#sec-…) → popup
 *   • Theme switcher kiểu Stream Intelligent (search + phím tắt + live preview)
 * ════════════════════════════════════════════════════════════════════════════ */

import { THEMES, DEFAULT_THEME } from './themes.js';
import { setBook, openSection } from './popup.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const INITIAL_EXPAND = 3; // root + nhóm + chương hiện sẵn; mục (lá) gập, click để xem

let book = null;
let registry = null;
let mm = null;
let mmRoot = null;

/* ── SVG icon helpers ─────────────────────────────────────────────────────*/
const ICON = {
  read: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
};

/* ── Ép node markmap luôn hiển thị (chống transition d3 treo khi tab throttle) */
function ensureVisible() {
  document
    .querySelectorAll('#map foreignObject, #map path, #map circle, #map line')
    .forEach((el) => { el.style.opacity = '1'; });
}

/* ═══ THEME SWITCHER (UI/UX copy Stream Intelligent) ══════════════════════ */

let themePreviewOriginal = null; // snapshot để revert khi huỷ

function dots(sw) {
  return `<span class="dots">${sw.map((c) => `<span style="background:${c}"></span>`).join('')}</span>`;
}

function buildThemeMenu() {
  const menu = $('#theme-menu');
  menu.innerHTML = `
    <div class="tm-label">Giao diện</div>
    <div class="tm-keys">
      <span class="grp"><span class="keycap">↑</span><span class="keycap">↓</span> xem trước</span>
      <span class="grp"><span class="keycap">↵</span> chọn</span>
      <span class="grp"><span class="keycap">Esc</span> huỷ</span>
    </div>
    <label class="tm-search">${ICON.search}<input id="tm-input" placeholder="Tìm giao diện…" spellcheck="false" /></label>
    <div class="tm-list" id="tm-list"></div>`;
  renderThemeRows('');

  const input = $('#tm-input');
  input.addEventListener('input', () => renderThemeRows(input.value));
  input.addEventListener('keydown', (e) => {
    const rows = $$('#tm-list .theme-row');
    if (!rows.length) return;
    let i = rows.findIndex((r) => r.classList.contains('preview'));
    if (i < 0) i = rows.findIndex((r) => r.classList.contains('active'));
    if (e.key === 'ArrowDown') { e.preventDefault(); previewRow(rows, Math.min(rows.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); previewRow(rows, Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); commitTheme(rows[i]?.dataset.id || currentTheme()); }
    else if (e.key === 'Escape') { e.preventDefault(); closeThemeMenu(true); }
  });
}

function renderThemeRows(query) {
  const q = query.trim().toLowerCase();
  const list = THEMES.filter(
    (t) => !q || (`${t.label} ${t.id}`).toLowerCase().includes(q)
  );
  const cur = currentTheme();
  const el = $('#tm-list');
  if (!list.length) { el.innerHTML = '<div class="tm-empty">Không có giao diện khớp</div>'; return; }
  el.innerHTML = list.map((t) => `
    <div class="theme-row ${t.id === cur ? 'active' : ''}" data-id="${t.id}">
      ${dots(t.swatches)}
      <span class="meta"><span class="name">${t.label}</span></span>
      ${t.id === cur ? `<span class="check">${ICON.check}</span>` : (t.mood === 'dark' ? '<span class="tag">tối</span>' : '')}
    </div>`).join('');
  $$('#tm-list .theme-row').forEach((row) => {
    row.addEventListener('mouseenter', () => applyTheme(row.dataset.id, true));
    row.addEventListener('click', () => commitTheme(row.dataset.id));
  });
}

function previewRow(rows, i) {
  rows.forEach((r) => r.classList.remove('preview'));
  const row = rows[i];
  if (!row) return;
  row.classList.add('preview');
  row.scrollIntoView({ block: 'nearest' });
  applyTheme(row.dataset.id, true);
}

const currentTheme = () => document.documentElement.dataset.theme || DEFAULT_THEME;

function applyTheme(id, preview = false) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  document.documentElement.dataset.theme = t.id;
  $('#theme-label').textContent = t.label;
  $('#theme-swatch').innerHTML = t.swatches.map((c) => `<span style="background:${c}"></span>`).join('');
  if (!preview) localStorage.setItem('book-theme', t.id);
}

function commitTheme(id) {
  applyTheme(id);
  themePreviewOriginal = null;
  closeThemeMenu(false);
}

function openThemeMenu() {
  themePreviewOriginal = currentTheme();
  buildThemeMenu();
  $('#theme-menu').classList.add('open');
  setTimeout(() => $('#tm-input')?.focus(), 30);
}

function closeThemeMenu(revert) {
  if (revert && themePreviewOriginal) applyTheme(themePreviewOriginal);
  themePreviewOriginal = null;
  $('#theme-menu').classList.remove('open');
}

function initTheme() {
  applyTheme(localStorage.getItem('book-theme') || DEFAULT_THEME);
  $('#theme-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if ($('#theme-menu').classList.contains('open')) closeThemeMenu(true);
    else openThemeMenu();
  });
  document.addEventListener('click', (e) => {
    if ($('#theme-menu').classList.contains('open') && !e.target.closest('#theme-menu') && !e.target.closest('#theme-btn')) {
      closeThemeMenu(true);
    }
  });
}

/* ═══ MARKMAP ═════════════════════════════════════════════════════════════ */

function setFold(node, folded) {
  if (!node.payload) node.payload = {};
  node.payload.fold = folded ? 1 : 0;
}

// Mở rộng riêng một chương: mở nhóm chứa nó, gập nhóm/chương khác, fit lại.
function focusChapter(target, groupNode) {
  for (const group of mmRoot.children || []) {
    setFold(group, group !== groupNode);
    for (const ch of group.children || []) {
      if (ch.children && ch.children.length) setFold(ch, ch !== target);
    }
  }
  mm.renderData();
  ensureVisible();
  setTimeout(() => { mm.renderData(); mm.fit(); ensureVisible(); }, 70);
}

function renderMindmap() {
  const { Transformer, Markmap } = window.markmap;
  const { root } = new Transformer().transform(book.markmap);
  mmRoot = root;

  mm = Markmap.create(
    '#map',
    {
      duration: 0, // tránh transition d3 treo ở opacity≈0 khi tab throttle
      initialExpandLevel: INITIAL_EXPAND,
      spacingVertical: 12,
      spacingHorizontal: 96,
      paddingX: 18,
    },
    root
  );

  ensureVisible();
  setTimeout(() => { mm.fit(); ensureVisible(); }, 60);

  $('#map').addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a) {
      const href = a.getAttribute('href') || '';
      if (href.startsWith('#sec-')) {
        e.preventDefault();
        e.stopPropagation();
        openSection(href.slice(1));
      }
    }
  }, true);
}

/* ═══ SIDEBAR ═════════════════════════════════════════════════════════════ */

function plainText(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || '').trim();
}

function buildSidebar() {
  const entry = registry.books.find((b) => b.id === book.meta.id) || registry.books[0];
  const toc = $('#toc');
  toc.innerHTML = '';
  const groupsTree = mmRoot.children || [];

  entry.groups.forEach((group, gi) => {
    const groupNode = groupsTree[gi];
    if (!groupNode) return;
    const gEl = document.createElement('div');
    gEl.className = 'toc-group';
    gEl.innerHTML = `<div class="toc-group-title">${group.title}</div>`;

    (groupNode.children || []).forEach((chNode, ci) => {
      const title = plainText(chNode.content);
      const isExpandable = chNode.children && chNode.children.length;
      const item = document.createElement('div');
      item.className = 'toc-item';
      item.dataset.kind = isExpandable ? 'expand' : 'read';
      item.title = isExpandable ? 'Mở các mục trên sơ đồ' : 'Đọc ngay';
      item.innerHTML =
        `<span class="no">${ci + 1}</span>` +
        `<span class="label">${title}</span>` +
        `<span class="kind">${isExpandable ? ICON.expand : ICON.read}</span>`;
      item.addEventListener('click', () => {
        $$('.toc-item').forEach((x) => x.classList.remove('active'));
        item.classList.add('active');
        if (isExpandable) {
          focusChapter(chNode, groupNode);
        } else {
          const m = /href="#(sec-[^"]+)"/.exec(chNode.content);
          if (m && book.sections[m[1]]) openSection(m[1]);
        }
      });
      gEl.appendChild(item);
    });
    toc.appendChild(gEl);
  });
}

/* ═══ BOOT ════════════════════════════════════════════════════════════════ */

async function boot() {
  initTheme();
  try {
    registry = await fetch('data/books.json').then((r) => r.json());
    book = await fetch(registry.books[0].data).then((r) => r.json());
  } catch (err) {
    $('#map-title').innerHTML = '<b>Lỗi tải dữ liệu.</b> Hãy chạy: node scripts/build.mjs';
    console.error(err);
    return;
  }

  $('#brand-title').textContent = book.meta.titleVi;
  $('#brand-by').textContent = `${book.meta.author} · ${book.meta.title}`;
  $('#map-title').innerHTML = `<b>${book.meta.titleVi}</b> — ${book.meta.sectionCount} mục`;

  setBook(book);
  renderMindmap();
  buildSidebar();
}

boot();
