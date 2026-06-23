/**
 * Cloudflare Worker — "Bạn học được gì" → Telegram.
 * Clone từ Stream Intelligent (worker/feedback.ts), đổi context sang sách.
 *
 * Endpoint: POST /api/feedback
 * Secrets (wrangler secret put):
 *   TELEGRAM_BOT_TOKEN              — bot CŨ (lấy lại từ worker Stream Intelligent)
 *   TELEGRAM_FEEDBACK_GROUP_ID     — group MỚI
 * Vars (wrangler.toml [vars], tuỳ chọn):
 *   SITE_URL                       — URL gốc trang đọc, để gắn link (vd. https://<user>.github.io/<repo>)
 * KV binding: FEEDBACK_RL (rate-limit)
 */

const ALLOWED_ORIGINS = [
  'https://dangtrungdev113999.github.io',
  'http://localhost:8099',
  'http://localhost:5173',
  'http://127.0.0.1:8099',
];

const MAX_REQS_PER_HOUR = 12;
const SECONDS_PER_HOUR = 3600;

const SLUG_RE = /^[A-Za-z0-9_-]+$/;
const SEC_RE = /^sec-[0-9]{2}-[0-9]{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function corsHeaders(origin) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function htmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function validate(p) {
  if (!p || typeof p !== 'object') return { ok: false, field: 'body', message: 'thiếu' };

  if (!p.name || typeof p.name !== 'string') return { ok: false, field: 'name', message: 'thiếu' };
  const name = p.name.trim().replace(/[\x00-\x1f]/g, '');
  if (name.length < 1 || name.length > 50) return { ok: false, field: 'name', message: '1-50 ký tự' };

  if (!p.comment || typeof p.comment !== 'string') return { ok: false, field: 'comment', message: 'thiếu' };
  const comment = p.comment.trim();
  if (comment.length < 5 || comment.length > 1000) return { ok: false, field: 'comment', message: '5-1000 ký tự' };

  if (!p.book_id || !SLUG_RE.test(p.book_id) || p.book_id.length > 100)
    return { ok: false, field: 'book_id', message: 'invalid book_id' };
  if (!p.section_id || !SEC_RE.test(p.section_id))
    return { ok: false, field: 'section_id', message: 'invalid section_id' };

  const chapter = typeof p.chapter === 'string' ? p.chapter.slice(0, 300) : '';
  const section_title = typeof p.section_title === 'string' ? p.section_title.slice(0, 300) : '';

  if (!p.client_id || !UUID_RE.test(p.client_id)) return { ok: false, field: 'client_id', message: 'invalid uuid' };

  if (!p.timestamp || typeof p.timestamp !== 'string') return { ok: false, field: 'timestamp', message: 'thiếu' };
  const ts = Date.parse(p.timestamp);
  if (isNaN(ts)) return { ok: false, field: 'timestamp', message: 'invalid ISO' };
  const nowMs = Date.now();
  if (ts > nowMs + 5 * 60 * 1000) return { ok: false, field: 'timestamp', message: 'in future' };
  if (ts < nowMs - 24 * 60 * 60 * 1000) return { ok: false, field: 'timestamp', message: 'too old' };

  return { ok: true, v: { name, comment, book_id: p.book_id, section_id: p.section_id, chapter, section_title, timestamp: p.timestamp, client_id: p.client_id } };
}

async function rateLimitCheck(kv, client_id) {
  const nowSec = Math.floor(Date.now() / 1000);
  const hourBucket = Math.floor(nowSec / SECONDS_PER_HOUR);
  const key = `rl:${client_id}:${hourBucket}`;
  const current = parseInt((await kv.get(key)) ?? '0', 10);
  if (current >= MAX_REQS_PER_HOUR) {
    return { ok: false, retry_after: SECONDS_PER_HOUR - (nowSec % SECONDS_PER_HOUR) };
  }
  await kv.put(key, String(current + 1), { expirationTtl: SECONDS_PER_HOUR });
  return { ok: true };
}

function buildTelegramMessage(p, siteUrl) {
  const link = siteUrl ? `${siteUrl.replace(/\/$/, '')}/#${p.section_id}` : '';
  const tsLocal = new Date(p.timestamp).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
  });
  const lines = [
    `📘 <b>Học được gì — ${htmlEscape(p.book_id)}</b>`,
    `${htmlEscape(p.chapter)}${p.section_title ? ' · ' + htmlEscape(p.section_title) : ''}`,
    ``,
    `🧑 <b>${htmlEscape(p.name)}</b>:`,
    htmlEscape(p.comment),
  ];
  if (link) lines.push(``, `🔗 ${link}`);
  lines.push(`🕐 ${tsLocal}`);
  return lines.join('\n');
}

async function postTelegram(env, text) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_FEEDBACK_GROUP_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const data = await resp.json();
  if (data.ok && data.result) return { ok: true, message_id: data.result.message_id };
  return { ok: false, message: data.description ?? 'unknown telegram error' };
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin');
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (url.pathname !== '/api/feedback' || req.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'not_found' }, 404, origin);
    }
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin);
    }

    let payload;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: 'validation', message: 'invalid json' }, 400, origin);
    }

    const v = validate(payload);
    if (!v.ok) {
      return jsonResponse({ ok: false, error: 'validation', field: v.field, message: v.message }, 400, origin);
    }

    const rl = await rateLimitCheck(env.FEEDBACK_RL, v.v.client_id);
    if (!rl.ok) {
      return jsonResponse({ ok: false, error: 'rate_limited', retry_after: rl.retry_after }, 429, origin);
    }

    const text = buildTelegramMessage(v.v, env.SITE_URL || origin);
    const tg = await postTelegram(env, text);
    if (!tg.ok) {
      return jsonResponse({ ok: false, error: 'telegram_fail', message: tg.message }, 502, origin);
    }
    return jsonResponse({ ok: true, telegram_message_id: tg.message_id }, 200, origin);
  },
};
