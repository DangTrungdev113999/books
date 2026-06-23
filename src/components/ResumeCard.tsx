import { useEffect, useState } from 'react';
import type { BookData } from '../lib/types';
import { useReadingState } from '../hooks/useReadingState';
import { getLast } from '../lib/reading-state';
import { sectionLabel } from '../lib/labels';

interface Props {
  book: BookData;
  onResume: (id: string, opts: { lang?: 'vi' | 'en'; scrollTop?: number }) => void;
}

/** Thẻ "Tiếp tục đọc" — hiện khi có vị trí đọc dở; ẩn sau khi bỏ qua. */
export function ResumeCard({ book, onResume }: Props) {
  useReadingState();
  const [dismissed, setDismissed] = useState(false);

  // Đổi sách → reset trạng thái bỏ qua.
  useEffect(() => {
    setDismissed(false);
  }, [book.meta.id]);

  const last = getLast();
  if (dismissed || !last || !book.sections[last.id]) return null;

  return (
    <div id="resume-card">
      <span className="rc-glyph">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </span>
      <div className="rc-text">
        <span className="rc-kicker">Tiếp tục đọc</span>
        <span className="rc-title">{sectionLabel(book, last.id)}</span>
      </div>
      <button
        className="rc-go"
        onClick={() => onResume(last.id, { lang: last.lang, scrollTop: last.scrollTop })}
      >
        Mở tiếp
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </svg>
      </button>
      <button className="rc-dismiss" aria-label="Bỏ qua" onClick={() => setDismissed(true)}>
        &times;
      </button>
    </div>
  );
}
