/* ════════════════════════════════════════════════════════════════════════════
 * align.mjs — Căn timing TỪNG TỪ cho karaoke read-along (Groq Whisper).
 *
 *   Chạy SAU build:audio. Với mỗi section có mp3 (trong manifest), gọi Groq
 *   Whisper trên file mp3 sẵn có → lấy {word,start,end}; rồi CĂN về đúng chuỗi
 *   từ nguồn (tokenize y hệt cách frontend tách từ trong DOM) bằng LCS + nội suy.
 *   Output public/audio/<book>/<sec>.words.json = { n, words:[{w,s}] } (s = giây
 *   từ active). Cache theo hash → chỉ căn lại section đổi.
 *
 *   KEY: GROQ_API_KEY trong .env.local (gitignore, KHÔNG prefix VITE_). Free key
 *   ở console.groq.com. Audio + words.json commit sẵn → CI/Pages không cần key.
 *
 *   Chạy:  npm run build:audio   →   npm run build:align   (hoặc: node scripts/align.mjs <book>)
 * ════════════════════════════════════════════════════════════════════════════ */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const AUDIO_DIR = join(ROOT, 'public', 'audio');

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MODEL = 'whisper-large-v3';
const RETRY = 3;

marked.setOptions({ breaks: false, gfm: true });

function loadEnvLocal() {
  const out = {};
  const file = join(ROOT, '.env.local');
  if (!existsSync(file)) return out;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[line.slice(0, eq).trim()] = v;
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

/* ── Tokenize KHỚP DOM: marked → bỏ tag → decode entity → bỏ marker OCR → tách từ.
 *   Phải khớp cách karaoke.ts walk text-node trong .prose (cùng nguồn md_vi). */
function sourceTokens(md) {
  let html = marked.parse(md || '');
  html = html.replace(/<[^>]+>/g, ' '); // bỏ tag (giữ text như textContent)
  html = html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');
  html = html.replace(/\[đoạn gốc bị lỗi OCR\]/gi, ' '); // badge: không đọc, frontend bỏ qua
  return html.split(/\s+/).filter(Boolean);
}

const norm = (w) => w.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '');

/* ── LCS giữa token nguồn S và token Whisper W (đã norm) → cặp khớp (i,j) ──── */
function lcsPairs(a, b) {
  const n = a.length, m = b.length;
  // DP độ dài LCS (Int32 phẳng)
  const dp = new Int32Array((n + 1) * (m + 1));
  const W = m + 1;
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i * W + j] = a[i] && a[i] === b[j]
        ? dp[(i + 1) * W + (j + 1)] + 1
        : Math.max(dp[(i + 1) * W + j], dp[i * W + (j + 1)]);
  const pairs = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] && a[i] === b[j]) { pairs.push([i, j]); i++; j++; }
    else if (dp[(i + 1) * W + j] >= dp[i * W + (j + 1)]) i++;
    else j++;
  }
  return pairs;
}

/* ── Gán start (giây) cho từng token nguồn: khớp lấy thẳng, hở thì nội suy ──── */
function alignTimes(srcTokens, whWords, duration) {
  const S = srcTokens.map(norm);
  const Wn = whWords.map((w) => norm(w.word));
  const pairs = lcsPairs(S, Wn);

  const start = new Array(srcTokens.length).fill(null);
  for (const [i, j] of pairs) start[i] = whWords[j].start;

  // nội suy các khoảng chưa có mốc, theo độ dài chữ tích luỹ
  let prevIdx = -1, prevT = 0;
  const anchors = [];
  for (let i = 0; i < start.length; i++) if (start[i] != null) anchors.push(i);
  anchors.push(start.length); // mốc ảo cuối = hết audio

  const timeAt = (i) => (i >= start.length ? duration : start[i]);
  let a = 0;
  for (let i = 0; i < start.length; i++) {
    if (start[i] != null) { prevIdx = i; prevT = start[i]; continue; }
    // tìm mốc kế tiếp
    let nextIdx = start.length, nextT = duration;
    for (let k = i + 1; k < start.length; k++) if (start[k] != null) { nextIdx = k; nextT = start[k]; break; }
    const lo = prevIdx < 0 ? 0 : prevT;
    const fromI = prevIdx < 0 ? -1 : prevIdx;
    // chia đều theo số token trong khoảng (đơn giản, ổn định)
    const span = nextIdx - fromI;
    const pos = i - fromI;
    start[i] = lo + ((nextT - lo) * pos) / span;
  }
  void timeAt; void a; void anchors;

  // ép đơn điệu không giảm
  for (let i = 1; i < start.length; i++) if (start[i] < start[i - 1]) start[i] = start[i - 1];
  return start.map((s) => Math.max(0, Math.round(s * 1000) / 1000));
}

async function groqAlign(mp3Path, sec, env) {
  const buf = readFileSync(mp3Path);
  for (let attempt = 0; ; attempt++) {
    const fd = new FormData();
    fd.append('file', new Blob([buf], { type: 'audio/mpeg' }), `${sec}.mp3`);
    fd.append('model', MODEL);
    fd.append('language', 'vi');
    fd.append('response_format', 'verbose_json');
    fd.append('timestamp_granularities[]', 'word');
    const res = await fetch(GROQ_URL, { method: 'POST', headers: { authorization: `Bearer ${env.GROQ_API_KEY}` }, body: fd });
    if (res.status === 429 && attempt < RETRY) {
      const ra = parseInt(res.headers.get('retry-after') || '0', 10) || 8 * (attempt + 1);
      console.log(`    429 — chờ ${ra}s rồi thử lại`);
      await sleep(ra * 1000);
      continue;
    }
    if (res.status >= 500 && attempt < RETRY) { await sleep(1000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const j = await res.json();
    return { words: j.words || [], duration: j.duration || 0 };
  }
}

async function main() {
  const env = { ...loadEnvLocal(), ...process.env };
  if (!env.GROQ_API_KEY) {
    console.error('✖ Thiếu GROQ_API_KEY trong .env.local (free ở console.groq.com).');
    process.exit(1);
  }
  const onlyBook = process.argv[2] || null;
  const registry = JSON.parse(readFileSync(join(DATA_DIR, 'books.json'), 'utf8'));

  let nNew = 0;
  for (const entry of registry.books) {
    if (onlyBook && entry.id !== onlyBook) continue;
    const book = JSON.parse(readFileSync(join(DATA_DIR, entry.data), 'utf8'));
    const dir = join(AUDIO_DIR, entry.id);
    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
    const order = book.order || Object.keys(book.sections);
    console.log(`\n📖 ${entry.titleVi || entry.id} — căn timing`);

    for (const id of order) {
      if (!manifest.sections[id]) continue; // chưa có audio → bỏ qua
      const sec = book.sections[id];
      const tokens = sourceTokens(sec.md_vi);
      if (tokens.length < 2) continue;
      const hash = sha256(tokens.join(' '));
      const outPath = join(dir, `${id}.words.json`);
      if (existsSync(outPath)) {
        try { if (JSON.parse(readFileSync(outPath, 'utf8')).hash === hash) { console.log(`  · ${id} — đã căn (bỏ qua)`); continue; } } catch {}
      }
      process.stdout.write(`  ⏳ ${id} — Groq (${tokens.length} từ)… `);
      try {
        const { words, duration } = await groqAlign(join(dir, `${id}.mp3`), id, env);
        const starts = alignTimes(tokens, words, duration);
        const out = { hash, n: tokens.length, dur: duration, words: tokens.map((w, i) => ({ w, s: starts[i] })) };
        writeFileSync(outPath, JSON.stringify(out));
        nNew++;
        console.log(`✓ ${tokens.length} từ, ${words.length} whisper, ${duration.toFixed(0)}s`);
      } catch (e) {
        console.log(`✖ ${e.message}`);
      }
    }
  }
  console.log(`\n✅ Xong. ${nNew} section căn mới.`);
}

main().catch((e) => { console.error('✖', e.message); process.exit(1); });
