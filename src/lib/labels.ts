import type { BookData } from './types';

/** Nhãn hiển thị cho một section (xử lý riêng "Tổng quan chương"). */
export function sectionLabel(book: BookData, id: string): string {
  const s = book.sections[id];
  if (!s) return id;
  const t = s.title_vi || s.title_en || '';
  return t === 'Tổng quan chương' ? `${s.chapter} — Tổng quan` : t;
}

/** Thời gian tương đối kiểu "5 phút trước". */
export function relTime(ts: number): string {
  const d = Math.max(0, Date.now() - (ts || 0));
  const m = Math.floor(d / 60000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day} ngày trước`;
  return new Date(ts).toLocaleDateString('vi-VN');
}
