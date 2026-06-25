/* ════════════════════════════════════════════════════════════════════════════
 * pdfpages.mjs — Map mỗi section → số trang PDF (mở PDF nhảy đúng trang).
 *
 *   Trích text từng trang PDF (pdftotext), rồi với mỗi section khớp md_en bằng
 *   bỏ phiếu shingle (5-gram) → trang khớp nhất. Output public/<book>.pages.json
 *   = { "sec-01-00": 8, ... } (commit; frontend fetch để mở iframe #page=N).
 *
 *   Cần: pdftotext (brew install poppler). Text layer PDF lẫn lộn nhưng đa số
 *   trang sạch → match vẫn né được trang rác (chọn trang điểm cao nhất).
 *
 *   Chạy:  npm run build:pages   (hoặc: node scripts/pdfpages.mjs)
 * ════════════════════════════════════════════════════════════════════════════ */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const PUBLIC = join(ROOT, 'public');

const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

function shingles(text, k = 5, step = 2, max = 60) {
  const w = norm(text).split(' ').filter(Boolean);
  const out = [];
  for (let i = 0; i + k <= w.length && out.length < max; i += step) out.push(w.slice(i, i + k).join(' '));
  return out;
}

function main() {
  const registry = JSON.parse(readFileSync(join(DATA_DIR, 'books.json'), 'utf8'));
  const onlyBook = process.argv[2] || null;

  for (const entry of registry.books) {
    if (onlyBook && entry.id !== onlyBook) continue;
    if (!entry.pdf) { console.log(`· ${entry.id}: không có PDF, bỏ qua`); continue; }
    const pdfPath = join(PUBLIC, entry.pdf);
    if (!existsSync(pdfPath)) { console.warn(`⚠ thiếu ${entry.pdf}`); continue; }

    console.log(`\n📕 ${entry.titleVi || entry.id} — trích text PDF…`);
    const raw = execFileSync('pdftotext', [pdfPath, '-'], { maxBuffer: 1 << 28 }).toString();
    const pageNorm = raw.split('\f').map(norm);
    console.log(`   ${pageNorm.length} trang`);

    const book = JSON.parse(readFileSync(join(DATA_DIR, entry.data), 'utf8'));
    const order = book.order || Object.keys(book.sections);
    const map = {};
    let ok = 0, weak = 0;

    for (const id of order) {
      const sec = book.sections[id];
      const text = sec?.md_en || sec?.md_vi; // ưu tiên EN (khớp PDF gốc); fallback VI
      if (!text) continue;
      const sh = shingles(text);
      if (!sh.length) continue;
      const scores = new Array(pageNorm.length).fill(0);
      for (const s of sh) for (let p = 0; p < pageNorm.length; p++) if (pageNorm[p].includes(s)) scores[p]++;
      let best = 0, bi = -1;
      for (let p = 0; p < scores.length; p++) if (scores[p] > best) { best = scores[p]; bi = p; }
      const ratio = best / sh.length;
      if (bi >= 0 && best >= 3) {
        map[id] = bi + 1; // #page là 1-based
        if (ratio < 0.3) weak++; else ok++;
      }
    }

    // điền section không khớp = trang của section trước (carry-forward, an toàn,
    // KHÔNG ép các trang đã khớp để tránh lan lỗi).
    let last = 1, filled = 0;
    for (const id of order) {
      if (!book.sections[id]) continue;
      if (map[id] == null) { map[id] = last; filled++; }
      else last = map[id];
    }

    const outPath = join(PUBLIC, `${entry.id}.pages.json`);
    writeFileSync(outPath, JSON.stringify(map));
    console.log(`   ✓ ${Object.keys(map).length} section → trang (${ok} chắc, ${weak} yếu, ${filled} carry-forward) → ${entry.id}.pages.json`);
  }
}

main();
