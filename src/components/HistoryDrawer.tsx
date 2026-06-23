import { useEffect } from 'react';
import type { BookData, HistoryType } from '../lib/types';
import { useReadingState } from '../hooks/useReadingState';
import { getHistory, clearHistory } from '../lib/reading-state';
import { sectionLabel, relTime } from '../lib/labels';

const VERB: Record<HistoryType, string> = { read: 'Đã đọc', highlight: 'Tô đậm', note: 'Ghi chú' };

const HighlightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 11-6 6v3h3l6-6" />
    <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-3.2-3.2a2 2 0 0 1 0-2.8L16 6" />
  </svg>
);
const NoteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

interface Props {
  book: BookData;
  open: boolean;
  onClose: () => void;
  onOpenSection: (id: string, opts?: { lang?: 'vi' | 'en' }) => void;
}

export function HistoryDrawer({ book, open, onClose, onOpenSection }: Props) {
  useReadingState();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const items = getHistory().filter((h) => h.type !== 'read');

  return (
    <div id="history-overlay" onClick={(e) => (e.target as HTMLElement).id === 'history-overlay' && onClose()}>
      <aside id="history-panel" role="dialog" aria-label="Lịch sử hoạt động">
        <header className="hp-head">
          <div className="hp-title">
            <span className="hp-kicker">Nhật ký</span>
            <h2>Hoạt động đọc</h2>
          </div>
          <button className="hp-clear" onClick={() => clearHistory()}>
            Xoá hết
          </button>
          <button className="hp-close" aria-label="Đóng" onClick={onClose}>
            &times;
          </button>
        </header>
        <div id="history-list">
          {items.length === 0 ? (
            <div className="hp-empty">
              Chưa có ghi chú nào.
              <br />
              Bôi đậm một đoạn hoặc thêm ghi chú để lưu lại đây.
            </div>
          ) : (
            items.map((h, i) => (
              <button
                key={i}
                className="hist-row"
                onClick={() => {
                  if (!book.sections[h.id]) return;
                  onClose();
                  onOpenSection(h.id, { lang: h.lang });
                }}
              >
                <span className={`hist-ic hist-${h.type}`}>
                  {h.type === 'note' ? <NoteIcon /> : <HighlightIcon />}
                </span>
                <span className="hist-meta">
                  <span className="hist-top">
                    <span className="hist-verb">{VERB[h.type]}</span>
                    <span className="hist-time">{relTime(h.ts)}</span>
                  </span>
                  <span className="hist-sec">{sectionLabel(book, h.id)}</span>
                  {h.preview && h.type !== 'read' ? (
                    <span className="hist-prev">“{h.preview}”</span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
