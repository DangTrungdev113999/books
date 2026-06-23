/* ════════════════════════════════════════════════════════════════════════════
 * feedback.js — Gửi "điều bạn học được" lên Telegram qua Cloudflare Worker.
 *   Mô phỏng feedbackClient.ts của Stream Intelligent.
 *   Worker URL lấy từ window.APP_CONFIG.WORKER_URL (config.js).
 * ════════════════════════════════════════════════════════════════════════════ */

const WORKER_URL = (window.APP_CONFIG && window.APP_CONFIG.WORKER_URL) || '';

export const isFeedbackEnabled = () => Boolean(WORKER_URL && WORKER_URL.startsWith('http'));

// client_id ổn định để rate-limit phía worker (UUID v4)
export function clientId() {
  let id = localStorage.getItem('book-client-id');
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) ||
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    localStorage.setItem('book-client-id', id);
  }
  return id;
}

/**
 * payload: { book_id, chapter, section_id, section_title, name, comment }
 * → trả về { ok:true } hoặc { ok:false, error, message, retry_after? }
 */
export async function submitFeedback(payload) {
  if (!isFeedbackEnabled()) {
    return { ok: false, error: 'disabled', message: 'Chưa cấu hình WORKER_URL' };
  }
  const body = {
    ...payload,
    timestamp: new Date().toISOString(),
    client_id: clientId(),
  };
  try {
    const resp = await fetch(`${WORKER_URL}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await resp.json();
  } catch (e) {
    return { ok: false, error: 'network', message: e instanceof Error ? e.message : 'lỗi mạng' };
  }
}
