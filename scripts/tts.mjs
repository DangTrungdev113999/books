/* ════════════════════════════════════════════════════════════════════════════
 * tts.mjs — Tạo audio "đọc sách" bằng Vbee TTS (giọng giống pipeline gen-video).
 *
 *   Đọc public/data/<book>.json (đã build), với mỗi section tiếng Việt:
 *     markdown → văn bản thuần → gọi Vbee → tải mp3 → public/audio/<book>/<sec>.mp3
 *   Cache theo hash nội dung (manifest.json) → CHỈ tạo lại phần đã đổi.
 *
 *   KEY KHÔNG nằm trong repo: đọc từ .env.local (đã .gitignore):
 *     VBEE_APP_ID=...          (app id, dạng UUID)
 *     VBEE_TOKEN=...           (JWT lấy ở Vbee Studio → API Tokens)
 *     VBEE_VOICE_CODE=...      (tuỳ chọn; mặc định giống gen-video-tai-chinh)
 *
 *   Chạy:  npm run build:books   (sinh public/data/*.json)  →  npm run build:audio
 *   Audio sinh ra được COMMIT vào repo → GitHub Pages phục vụ tĩnh, 0đ runtime.
 * ════════════════════════════════════════════════════════════════════════════ */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'public', 'data');
const AUDIO_DIR = join(ROOT, 'public', 'audio');

const VBEE_BASE = 'https://vbee.vn/api';
const DEFAULT_VOICE = 'hn_female_ngochuyen_full_24k-st'; // Ngọc Huyền 2.0 (review, Miền Bắc, x3 điểm)
const BITRATE = 64;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 300_000; // 5 phút / section
const RETRY_5XX = 1;

/* ── .env.local loader (chỉ cho script node; KHÔNG prefix VITE_ → không vào bundle) */
function loadEnvLocal() {
  const out = {};
  const file = join(ROOT, '.env.local');
  if (!existsSync(file)) return out;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

/* ── markdown → văn bản thuần để đọc (giữ xuống dòng làm nhịp nghỉ) ───────── */
function mdToSpeech(md) {
  let t = md || '';
  t = t.replace(/```[\s\S]*?```/g, ' '); // code block
  t = t.replace(/`([^`]*)`/g, '$1'); // inline code
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' '); // ảnh
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'); // link → text
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, ''); // heading marker
  t = t.replace(/^\s{0,3}>\s?/gm, ''); // blockquote
  t = t.replace(/^\s*[-*+]\s+/gm, ''); // bullet
  t = t.replace(/^\s*\d+\.\s+/gm, ''); // ordered list
  t = t.replace(/(\*\*|__|\*|_|~~)/g, ''); // emphasis
  t = t.replace(/\[đoạn gốc bị lỗi OCR\]/gi, ' '); // bỏ marker OCR — không đọc to
  t = t.replace(/\|/g, ' '); // bảng
  t = t.replace(/[ \t]+/g, ' ');
  t = t.replace(/\n{3,}/g, '\n\n'); // gộp dòng trống
  return t.trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sha256(s) {
  return createHash('sha256').update(s).digest('hex');
}

/* ── Gọi Vbee: POST tạo request → poll tới SUCCESS → trả audio_link ──────── */
async function vbeeRequest(method, path, body, env) {
  let attempt = 0;
  while (true) {
    const res = await fetch(`${VBEE_BASE}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${env.VBEE_TOKEN}`,
        'app-id': env.VBEE_APP_ID,
        'content-type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) {
      const ra = parseInt(res.headers.get('retry-after') || '5', 10);
      throw new Error(`Vbee 429 quota — thử lại sau ${ra}s`);
    }
    if (res.status >= 500 && attempt < RETRY_5XX) {
      attempt++;
      await sleep(500);
      continue;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.message || json?.result?.error_message || `HTTP ${res.status}`;
      throw new Error(`Vbee ${path} lỗi: ${msg}`);
    }
    return json;
  }
}

async function synthesize(text, voice, env) {
  const submit = await vbeeRequest(
    'POST',
    '/v1/tts',
    {
      app_id: env.VBEE_APP_ID,
      response_type: 'indirect',
      callback_url: 'https://books.local/vbee-callback', // placeholder: ta dùng polling
      input_text: text,
      voice_code: voice,
      audio_type: 'mp3',
      bitrate: BITRATE,
    },
    env
  );
  const requestId = submit?.result?.request_id;
  if (!requestId) throw new Error('Vbee không trả request_id');

  const start = Date.now();
  while (true) {
    await sleep(POLL_INTERVAL_MS);
    const poll = await vbeeRequest('GET', `/v1/tts/${requestId}`, null, env);
    const r = poll?.result || {};
    if (r.status === 'SUCCESS') {
      if (!r.audio_link) throw new Error('SUCCESS nhưng thiếu audio_link');
      return { link: r.audio_link, chars: r.characters ?? text.length };
    }
    if (r.status === 'FAILURE') {
      throw new Error(`Vbee FAILURE: ${r.error_code || ''} ${r.error_message || ''}`);
    }
    if (Date.now() - start > POLL_TIMEOUT_MS) throw new Error('Vbee quá 5 phút — bỏ qua');
  }
}

async function download(link) {
  const res = await fetch(link);
  if (!res.ok) throw new Error(`Tải audio lỗi HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
async function main() {
  const env = { ...loadEnvLocal(), ...process.env };
  if (!env.VBEE_APP_ID || !env.VBEE_TOKEN) {
    console.error(
      '✖ Thiếu VBEE_APP_ID / VBEE_TOKEN.\n' +
        '  Tạo file .env.local ở gốc dự án với:\n' +
        '    VBEE_APP_ID=...\n    VBEE_TOKEN=...\n'
    );
    process.exit(1);
  }
  const voice = env.VBEE_VOICE_CODE || DEFAULT_VOICE;
  const onlyBook = process.argv[2] || null; // tuỳ chọn: build 1 sách

  const registryPath = join(DATA_DIR, 'books.json');
  if (!existsSync(registryPath)) {
    console.error('✖ Chưa có public/data/books.json. Chạy "npm run build:books" trước.');
    process.exit(1);
  }
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));

  let totalNew = 0;
  let totalChars = 0;
  for (const entry of registry.books) {
    if (onlyBook && entry.id !== onlyBook) continue;
    const dataPath = join(DATA_DIR, entry.data);
    if (!existsSync(dataPath)) {
      console.warn(`⚠ Bỏ qua ${entry.id}: thiếu ${entry.data}`);
      continue;
    }
    const book = JSON.parse(readFileSync(dataPath, 'utf8'));
    const outDir = join(AUDIO_DIR, entry.id);
    mkdirSync(outDir, { recursive: true });

    const manifestPath = join(outDir, 'manifest.json');
    let manifest = { voice, sections: {} };
    if (existsSync(manifestPath)) {
      try {
        const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
        if (m.voice === voice) manifest = m; // đổi giọng → tạo lại toàn bộ
      } catch {}
    }

    const order = book.order || Object.keys(book.sections);
    console.log(`\n📖 ${entry.titleVi || entry.id} — ${order.length} mục, giọng ${voice}`);

    for (const id of order) {
      const sec = book.sections[id];
      if (!sec || !sec.md_vi) continue;
      const text = mdToSpeech(sec.md_vi);
      if (!text || text.length < 2) continue;

      const hash = sha256(`${voice}\n${text}`);
      const file = `${id}.mp3`;
      const have = manifest.sections[id];
      if (have && have.hash === hash && existsSync(join(outDir, file))) {
        console.log(`  · ${id} — đã có (bỏ qua)`);
        continue;
      }

      process.stdout.write(`  ⏳ ${id} — tổng hợp (${text.length} ký tự)… `);
      try {
        const { link, chars } = await synthesize(text, voice, env);
        const buf = await download(link);
        writeFileSync(join(outDir, file), buf);
        manifest.sections[id] = { hash, chars, bytes: buf.length };
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8'); // lưu sau MỖI mục (an toàn nếu ngắt)
        totalNew++;
        totalChars += chars;
        console.log(`✓ ${(buf.length / 1024).toFixed(0)} KB`);
      } catch (e) {
        console.log(`✖ ${e.message}`);
      }
    }
    // dọn manifest: bỏ mục không còn trong order
    for (const id of Object.keys(manifest.sections))
      if (!order.includes(id)) delete manifest.sections[id];
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  }

  console.log(`\n✅ Xong. ${totalNew} mục mới, ~${totalChars.toLocaleString('vi-VN')} ký tự tính phí.`);
}

main().catch((e) => {
  console.error('✖ Lỗi:', e.message);
  process.exit(1);
});
