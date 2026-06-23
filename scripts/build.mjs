#!/usr/bin/env node
/* ────────────────────────────────────────────────────────────────────────────
 * build.mjs — Chuyển các file Markdown của một cuốn sách thành dữ liệu JSON
 * cho trình đọc mindmap (data/<book-id>.json).
 *
 *   • Đọc registry data/books.json (mỗi sách: source dir + nhóm chương).
 *   • Với mỗi file, ghép cặp EN (NN_*.md) + VI (NN_*_vi.md).
 *   • Tách mỗi file thành section theo heading H2 (H3 gộp vào H2).
 *   • Khớp EN↔VI theo thứ tự H2 khi số lượng bằng nhau; nếu lệch → 1 section.
 *   • Sinh markmap outline (markdown) cho cả cây sách; lá = section có link #sec-…
 *   • Xử lý chương thiếu bản VI (vd. Chương 4): md_vi = null.
 *
 * Chạy:  node scripts/build.mjs
 * Re-runnable: chạy lại mỗi khi có thêm file _vi.md mới.
 * ──────────────────────────────────────────────────────────────────────────── */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const REGISTRY = join(ROOT, 'data', 'books.json');

const INTRO_MIN_CHARS = 220; // intro phải đủ dài mới tách thành leaf riêng

/* ── Markdown parsing ─────────────────────────────────────────────────────── */

/**
 * Tách một file markdown chương thành { h1, intro, h2:[{title,md}], body }.
 * - Bỏ breadcrumb (dòng đầu `*[…]`), footer điều hướng (`--- ⬅ … ➡`),
 *   và block "Trong chương này:" (mục lục anchor).
 * - intro = nội dung giữa H1 và H2 đầu tiên (hoặc toàn bộ nếu không có H2).
 * - H3 được giữ nguyên và gộp vào markdown của H2 đang mở.
 */
function parseDoc(text) {
  let lines = text.replace(/\r\n/g, '\n').split('\n');

  // 1. Bỏ breadcrumb dòng đầu (in nghiêng, bắt đầu bằng *[)
  if (lines.length && /^\*\[/.test(lines[0].trim())) lines.shift();

  // 2. Cắt footer điều hướng: từ dòng `---` đứng ngay trước dòng chứa ⬅
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('⬅')) {
      let cut = i;
      // lùi qua các dòng trống tới dòng `---`
      let j = i - 1;
      while (j >= 0 && lines[j].trim() === '') j--;
      if (j >= 0 && /^-{3,}\s*$/.test(lines[j].trim())) cut = j;
      lines = lines.slice(0, cut);
      break;
    }
  }

  // 3. Bỏ block "Trong chương này:" + danh sách anchor theo sau
  const tocIdx = lines.findIndex((l) => /\*\*Trong chương này:\*\*/.test(l));
  if (tocIdx !== -1) {
    let end = tocIdx + 1;
    while (end < lines.length && (lines[end].trim() === '' || /^[-*]\s*\[/.test(lines[end].trim()))) end++;
    lines.splice(tocIdx, end - tocIdx);
  }

  // 4. Walk headings
  let h1 = '';
  const introLines = [];
  const h2 = []; // {title, lines:[]}
  let cur = null; // null = đang trong intro

  for (const line of lines) {
    const m1 = /^#\s+(.*)$/.exec(line);
    const m2 = /^##\s+(.*)$/.exec(line);
    if (m1) {
      h1 = m1[1].trim();
      continue;
    }
    if (m2) {
      cur = { title: m2[1].trim(), lines: [] };
      h2.push(cur);
      continue;
    }
    if (cur) cur.lines.push(line);
    else introLines.push(line);
  }

  const intro = introLines.join('\n').trim();
  const h2sections = h2.map((s) => ({ title: s.title, md: s.lines.join('\n').trim() }));
  // body = toàn bộ nội dung (intro + các H2 kèm tiêu đề) cho trường hợp fallback 1-section
  const bodyParts = [];
  if (intro) bodyParts.push(intro);
  for (const s of h2) bodyParts.push(`## ${s.title}\n\n${s.lines.join('\n').trim()}`);
  const body = bodyParts.join('\n\n').trim();

  return { h1, intro, h2: h2sections, body };
}

/* ── Section alignment ────────────────────────────────────────────────────── */

const paraCount = (md) => (md ? md.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean).length : 0);
const isAligned = (en, vi) => Boolean(en && vi) && paraCount(en) > 0 && paraCount(en) === paraCount(vi);

/**
 * Ghép một file (EN + VI?) thành danh sách section đã khớp.
 * Trả về { nodeTitleVi, nodeTitleEn, single, sections:[{idx,title_vi,title_en,md_vi,md_en,aligned}] }
 */
function buildFileSections(prefix, en, vi) {
  const nodeTitleEn = en.h1 || '';
  const nodeTitleVi = (vi && vi.h1) || nodeTitleEn;

  const sameH2 = vi && en.h2.length > 0 && en.h2.length === vi.h2.length;

  // Trường hợp 1 section: không có H2, hoặc EN/VI lệch số H2, hoặc thiếu VI
  if (!sameH2) {
    return {
      nodeTitleVi,
      nodeTitleEn,
      single: true,
      sections: [
        {
          idx: '00',
          id: `sec-${prefix}-00`,
          title_vi: nodeTitleVi,
          title_en: nodeTitleEn,
          md_vi: vi ? vi.body : null,
          md_en: en.body,
          aligned: isAligned(en.body, vi ? vi.body : null),
        },
      ],
    };
  }

  // Trường hợp nhiều section: intro (nếu đủ dài) + từng H2
  const sections = [];
  const introEn = en.intro;
  const introVi = vi.intro;
  if ((introVi && introVi.length >= INTRO_MIN_CHARS) || (introEn && introEn.length >= INTRO_MIN_CHARS)) {
    sections.push({
      idx: '00',
      id: `sec-${prefix}-00`,
      title_vi: 'Tổng quan chương',
      title_en: 'Overview',
      md_vi: introVi || null,
      md_en: introEn || null,
      aligned: isAligned(introEn, introVi),
    });
  }
  en.h2.forEach((s, i) => {
    const n = String(i + 1).padStart(2, '0');
    sections.push({
      idx: n,
      id: `sec-${prefix}-${n}`,
      title_vi: vi.h2[i].title,
      title_en: s.title,
      md_vi: vi.h2[i].md || null,
      md_en: s.md || null,
      aligned: isAligned(s.md, vi.h2[i].md),
    });
  });

  return { nodeTitleVi, nodeTitleEn, single: false, sections };
}

/* ── File discovery ───────────────────────────────────────────────────────── */

function findPair(srcDir, prefix) {
  const all = readdirSync(srcDir).filter((f) => f.startsWith(`${prefix}_`) && f.endsWith('.md'));
  const enFile = all.find((f) => !f.endsWith('_vi.md'));
  const viFile = all.find((f) => f.endsWith('_vi.md'));
  return {
    enFile: enFile ? join(srcDir, enFile) : null,
    viFile: viFile ? join(srcDir, viFile) : null,
  };
}

/* ── Markmap outline ──────────────────────────────────────────────────────── */

// markmap không thích ký tự [] ( ) trong text node ngoài cú pháp link → escape nhẹ
const nodeText = (t) => t.replace(/\|/g, '·').trim();
const linkNode = (title, id) => `[${nodeText(title).replace(/\]/g, '〕').replace(/\[/g, '〔')}](#${id})`;

/* ── Build one book ───────────────────────────────────────────────────────── */

function buildBook(book) {
  const srcDir = resolve(ROOT, book.source);
  const sectionsMap = {};
  const mm = [`# ${book.titleVi}`, '']; // markmap outline (markdown)

  let total = 0;
  let missingVi = 0;

  for (const group of book.groups) {
    mm.push(`## ${group.title}`, '');
    for (const prefix of group.files) {
      const { enFile, viFile } = findPair(srcDir, prefix);
      if (!enFile) {
        console.warn(`  ⚠ Không tìm thấy file EN cho prefix ${prefix}`);
        continue;
      }
      const en = parseDoc(readFileSync(enFile, 'utf8'));
      const vi = viFile ? parseDoc(readFileSync(viFile, 'utf8')) : null;
      if (!viFile) missingVi++;

      const built = buildFileSections(prefix, en, vi);

      // Ghi sections vào map + meta cho popup
      for (const s of built.sections) {
        sectionsMap[s.id] = {
          ...s,
          book: book.titleVi,
          chapter: built.nodeTitleVi,
          chapter_en: built.nodeTitleEn,
          hasVi: s.md_vi != null,
        };
        total++;
      }

      // Outline
      if (built.single) {
        // Node chương chính là lá (1 link)
        mm.push(`### ${linkNode(built.nodeTitleVi, built.sections[0].id)}`);
      } else {
        mm.push(`### ${nodeText(built.nodeTitleVi)}`);
        for (const s of built.sections) {
          mm.push(`#### ${linkNode(s.title_vi, s.id)}`);
        }
      }
    }
    mm.push('');
  }

  const out = {
    meta: {
      id: book.id,
      title: book.title,
      titleVi: book.titleVi,
      author: book.author,
      sectionCount: total,
      missingViFiles: missingVi,
      generatedAt: new Date().toISOString(),
    },
    markmap: mm.join('\n'),
    order: Object.keys(sectionsMap), // thứ tự đọc tuyến tính → cho nút "Mục tiếp theo"
    sections: sectionsMap,
  };

  const outPath = resolve(ROOT, book.data);
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`✓ ${book.id}: ${total} sections, ${missingVi} file thiếu VI → ${book.data}`);
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

function main() {
  if (!existsSync(REGISTRY)) {
    console.error(`Không tìm thấy registry: ${REGISTRY}`);
    process.exit(1);
  }
  const reg = JSON.parse(readFileSync(REGISTRY, 'utf8'));
  console.log(`Building ${reg.books.length} book(s)…`);
  for (const book of reg.books) buildBook(book);
  console.log('Xong.');
}

main();
