import { useEffect, useMemo, useRef, useState } from 'react';
import { THEMES } from '../lib/themes';

interface Props {
  open: boolean;
  currentId: string;
  onPreview: (id: string) => void;
  onRevert: () => void;
  onCommit: (id: string) => void;
  onClose: () => void;
}

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/** Theme switcher: search + ↑↓ xem trước + ↵ chọn + Esc huỷ. */
export function ThemeMenu({ open, currentId, onPreview, onRevert, onCommit, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [previewIdx, setPreviewIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return THEMES.filter((t) => !q || `${t.label} ${t.id}`.toLowerCase().includes(q));
  }, [query]);

  // Mở: reset, focus, đặt preview vào theme hiện tại.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setPreviewIdx(-1);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // Click ngoài → đóng + revert.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Element;
      if (!t.closest('#theme-menu') && !t.closest('#theme-btn')) {
        onRevert();
        onClose();
      }
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open, onRevert, onClose]);

  function movePreview(next: number) {
    if (!list.length) return;
    const i = Math.max(0, Math.min(list.length - 1, next));
    setPreviewIdx(i);
    onPreview(list[i].id);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!list.length) return;
    let i = previewIdx;
    if (i < 0) i = list.findIndex((t) => t.id === currentId);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      movePreview(i + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      movePreview(i - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onCommit(list[i]?.id || currentId);
      onClose();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onRevert();
      onClose();
    }
  }

  return (
    <div id="theme-menu" className={open ? 'open' : ''}>
      <div className="tm-label">Giao diện</div>
      <div className="tm-keys">
        <span className="grp">
          <span className="keycap">↑</span>
          <span className="keycap">↓</span> xem trước
        </span>
        <span className="grp">
          <span className="keycap">↵</span> chọn
        </span>
        <span className="grp">
          <span className="keycap">Esc</span> huỷ
        </span>
      </div>
      <label className="tm-search">
        <SearchIcon />
        <input
          id="tm-input"
          ref={inputRef}
          placeholder="Tìm giao diện…"
          spellCheck={false}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPreviewIdx(-1);
          }}
          onKeyDown={onKeyDown}
        />
      </label>
      <div className="tm-list" id="tm-list">
        {list.length === 0 ? (
          <div className="tm-empty">Không có giao diện khớp</div>
        ) : (
          list.map((t, i) => (
            <div
              key={t.id}
              className={`theme-row ${t.id === currentId ? 'active' : ''} ${i === previewIdx ? 'preview' : ''}`}
              data-id={t.id}
              onMouseEnter={() => onPreview(t.id)}
              onClick={() => {
                onCommit(t.id);
                onClose();
              }}
            >
              <span className="dots">
                {t.swatches.map((c, k) => (
                  <span key={k} style={{ background: c }} />
                ))}
              </span>
              <span className="meta">
                <span className="name">{t.label}</span>
              </span>
              {t.id === currentId ? (
                <span className="check">
                  <CheckIcon />
                </span>
              ) : t.mood === 'dark' ? (
                <span className="tag">tối</span>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
