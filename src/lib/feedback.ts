/* ════════════════════════════════════════════════════════════════════════════
 * feedback.ts — Gửi "điều bạn học được" lên Telegram qua Cloudflare Worker.
 *   Worker URL lấy từ import.meta.env.VITE_WORKER_URL (.env / .env.local).
 * ════════════════════════════════════════════════════════════════════════════ */

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

export const isFeedbackEnabled = () => Boolean(WORKER_URL && WORKER_URL.startsWith('http'));

// client_id ổn định để rate-limit phía worker (UUID v4)
export function clientId(): string {
  let id = localStorage.getItem('book-client-id');
  if (!id) {
    id =
      (crypto.randomUUID && crypto.randomUUID()) ||
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    localStorage.setItem('book-client-id', id);
  }
  return id;
}

export interface FeedbackPayload {
  book_id: string;
  chapter: string;
  section_id: string;
  section_title: string;
  name: string;
  comment: string;
}

export interface FeedbackResult {
  ok: boolean;
  error?: string;
  message?: string;
  retry_after?: number;
}

export async function submitFeedback(payload: FeedbackPayload): Promise<FeedbackResult> {
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
    return (await resp.json()) as FeedbackResult;
  } catch (e) {
    return { ok: false, error: 'network', message: e instanceof Error ? e.message : 'lỗi mạng' };
  }
}
