/* ════════════════════════════════════════════════════════════════════════════
 * app.js — Entry chính của trình đọc mindmap.
 *   • Nạp data/books.json → chọn sách → nạp data/<book>.json
 *   • Render cả cây sách bằng markmap (1 cây lớn)
 *   • Sidebar: nhóm → chương; click chương = "focus" (mở rộng chương đó, gập phần còn lại)
 *   • Click lá (section có #sec-…) → mở popup
 *   • Theme switcher (27 theme, mặc định Salon sáng)
 * ════════════════════════════════════════════════════════════════════════════ */

import { THEMES, DEFAULT_THEME } from './themes.js';
import { openSection } from './popup.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

let book = null; // { meta, markmap, sections }
let registry = null; // books.json
let mm = null; // markmap instance
let mmRoot = null; // transformed tree
const chapterNodes = []; // { node, title } để sidebar focus

/* ── Theme ────────────────────────────────────────────────────────────────*/

function buildThemeMenu() {
  const menu = $('#theme-menu');
  menu.innerHTML = THEMES.map(
    (t) => `
    <div class="theme-row" data-id="${t.id}">
      <span class="dots">
        <span style="background:${t.swatches[0]}"></span>
        <span style="background:${t.swatches[1]}"></span>
        <span style="background:${t.swatches[2]}"></span>
      </span>
      <span>${t.label}</span>
      ${t.mood === 'dark' ? '<span class="tag">tối</span>' : ''}
    </div>`
  ).join('');
  menu.addEventListener('click', (e) => {
    const row = e.target.closest('.theme-row');
    if (!row) return;
    applyTheme(row.dataset.id);
    menu.classList.remove('open');
  });
}

function applyTheme(id) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  document.documentElement.dataset.theme = t.id;
  localStorage.setItem('book-theme', t.id);
  $('#theme-label').textContent = t.label;
  $('#theme-swatch').style.background = t.swatches[1];
  $$('.theme-row').forEach((r) => r.classList.toggle('active', r.dataset.id === t.id));
}

function initTheme() {
  buildThemeMenu();
  applyTheme(localStorage.getItem('book-theme') || DEFAULT_THEME);
  $('#theme-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#theme-menu').classList.toggle('open');
  });
  document.addEventListener('click', () => $('#theme-menu').classList.remove('open'));
}

/* ── Markmap ──────────────────────────────────────────────────────────────*/

// Ép mọi node/nhánh về opacity 1 (chống transition d3 bị treo khi tab throttle)
function ensureVisible() {
  document
    .querySelectorAll('#map foreignObject, #map path, #map circle, #map line')
    .forEach((el) => {
      el.style.opacity = '1';
    });
}

// Gập/mở một node: payload.fold = 1 → gập (mutate tại chỗ để markmap giữ tham chiếu)
function setFold(node, folded) {
  if (!node.payload) node.payload = {};
  node.payload.fold = folded ? 1 : 0;
}

// Mở rộng riêng một chương: mở nhóm chứa nó, gập nhóm/chương khác, rồi căn giữa.
// Dùng renderData() (tôn trọng payload.fold) thay vì setData() (sẽ reset theo
// initialExpandLevel). centerNode() để đưa chương vào giữa khung nhìn.
function focusChapter(target, groupNode) {
  for (const group of mmRoot.children || []) {
    setFold(group, group !== groupNode);
    for (const ch of group.children || []) {
      if (ch.children && ch.children.length) setFold(ch, ch !== target);
    }
  }
  mm.renderData();
  ensureVisible();
  // Render lần 2 sau khi markmap đã đo kích thước các node vừa hiện (tránh
  // node mới có size 0 ở lần render đầu → vô hình), rồi fit khung nhìn.
  setTimeout(() => {
    mm.renderData();
    mm.fit();
    ensureVisible();
  }, 70);
}

function renderMindmap() {
  const { Transformer } = window.markmap;
  const transformer = new Transformer();
  const { root } = transformer.transform(book.markmap);
  mmRoot = root;

  const { Markmap } = window.markmap;
  mm = Markmap.create(
    '#map',
    {
      // duration: 0 — markmap fade-in dùng d3 transition; nếu tab bị throttle
      // (không focus / chạy nền) transition có thể đóng băng ở opacity≈0 khiến
      // map trắng xoá. Tắt animation → node luôn hiển thị đầy đủ, mọi môi trường.
      duration: 0,
      initialExpandLevel: 2,
      spacingVertical: 10,
      spacingHorizontal: 90,
      paddingX: 18,
    },
    root
  );

  // An toàn kép: ép hiện đủ (phòng trường hợp transition vẫn còn treo)
  ensureVisible();
  setTimeout(() => {
    mm.fit();
    ensureVisible();
  }, 50);

  // Click lá → popup
  $('#map').addEventListener(
    'click',
    (e) => {
      const a = e.target.closest('a');
      if (a) {
        const href = a.getAttribute('href') || '';
        if (href.startsWith('#sec-')) {
          e.preventDefault();
          e.stopPropagation();
          const sec = book.sections[href.slice(1)];
          if (sec) openSection(sec, book.meta);
        }
      }
    },
    true
  );
}

/* ── Sidebar TOC ──────────────────────────────────────────────────────────*/

// Bóc text thuần từ content HTML của node markmap
function plainText(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || '').trim();
}

function buildSidebar() {
  const bookEntry = registry.books.find((b) => b.id === book.meta.id) || registry.books[0];
  const toc = $('#toc');
  toc.innerHTML = '';
  chapterNodes.length = 0;

  // map prefix → chapter node (đi theo thứ tự cây)
  const groupsTree = mmRoot.children || [];

  bookEntry.groups.forEach((group, gi) => {
    const groupNode = groupsTree[gi];
    const gEl = document.createElement('div');
    gEl.className = 'toc-group';
    gEl.innerHTML = `<div class="toc-group-title">${group.title}</div>`;
    const chNodes = (groupNode && groupNode.children) || [];
    chNodes.forEach((chNode, ci) => {
      const title = plainText(chNode.content);
      chapterNodes.push({ node: chNode, title });
      const item = document.createElement('div');
      item.className = 'toc-item';
      item.innerHTML = `<span class="no">${ci + 1}</span><span>${title}</span>`;
      item.addEventListener('click', () => {
        $$('.toc-item').forEach((x) => x.classList.remove('active'));
        item.classList.add('active');
        // lá đơn (không có con) → mở popup luôn; chương có con → focus
        if (chNode.children && chNode.children.length) {
          focusChapter(chNode, groupNode);
        } else {
          const a = /href="#(sec-[^"]+)"/.exec(chNode.content);
          if (a && book.sections[a[1]]) openSection(book.sections[a[1]], book.meta);
        }
      });
      gEl.appendChild(item);
    });
    toc.appendChild(gEl);
  });
}

/* ── Boot ─────────────────────────────────────────────────────────────────*/

async function boot() {
  initTheme();
  try {
    registry = await fetch('data/books.json').then((r) => r.json());
    const entry = registry.books[0];
    book = await fetch(entry.data).then((r) => r.json());
  } catch (err) {
    $('#map-title').innerHTML = '<b>Lỗi tải dữ liệu sách.</b> Hãy chạy: node scripts/build.mjs';
    console.error(err);
    return;
  }

  $('#brand-title').textContent = book.meta.titleVi;
  $('#brand-by').textContent = `${book.meta.author} · ${book.meta.title}`;
  $('#map-title').innerHTML = `<b>${book.meta.titleVi}</b> — ${book.meta.sectionCount} mục`;

  renderMindmap();
  buildSidebar();
}

boot();
