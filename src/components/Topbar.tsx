import { useState } from 'react';
import { ThemeMenu } from './ThemeMenu';
import { useReadingState } from '../hooks/useReadingState';
import { progress } from '../lib/reading-state';
import type { Theme } from '../lib/themes';

const RING_C = 2 * Math.PI * 9; // chu vi vòng tròn tiến độ (r=9)

interface ThemeCtl {
  themeId: string;
  theme: Theme;
  preview: (id: string) => void;
  revert: () => void;
  commit: (id: string) => void;
}

interface Props {
  themeCtl: ThemeCtl;
  onOpenHistory: () => void;
}

export function Topbar({ themeCtl, onOpenHistory }: Props) {
  useReadingState(); // re-render khi tiến độ đổi
  const { read, total, pct } = progress();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div id="topbar">
        <div id="map-title"></div>
        <div id="topbar-right">
          {total > 0 && (
            <button
              id="progress-pill"
              className={read === total ? 'is-done' : ''}
              aria-label="Tiến độ đọc"
              title={`Đã đọc ${read}/${total} mục · ${pct}%`}
              onClick={onOpenHistory}
            >
              <span className="ring">
                <svg viewBox="0 0 24 24">
                  <circle className="ring-bg" cx="12" cy="12" r="9" />
                  <circle
                    className="ring-fg"
                    cx="12"
                    cy="12"
                    r="9"
                    style={{
                      strokeDasharray: RING_C.toFixed(1),
                      strokeDashoffset: (RING_C * (1 - pct / 100)).toFixed(1),
                    }}
                  />
                </svg>
                <span className="ring-pct">{pct}</span>
              </span>
              <span className="ptext">
                <b>{read}</b>
                <span className="sep">/</span>
                <span>{total}</span>
              </span>
            </button>
          )}
          <button className="icon-btn" id="history-btn" aria-label="Lịch sử hoạt động" onClick={onOpenHistory}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v5h5" />
              <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
              <path d="M12 7v5l3 2" />
            </svg>
            <span>Hoạt động</span>
          </button>
          <button
            className="icon-btn"
            id="theme-btn"
            aria-haspopup="true"
            aria-label="Đổi giao diện"
            onClick={(e) => {
              e.stopPropagation();
              if (menuOpen) {
                themeCtl.revert();
                setMenuOpen(false);
              } else {
                setMenuOpen(true);
              }
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
              <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
              <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
              <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996C18.978 16.668 22 13.646 22 9.9 22 5.646 17.5 2 12 2z" />
            </svg>
            <span id="theme-label">{themeCtl.theme.label}</span>
            <span className="swatch-trio" id="theme-swatch">
              {themeCtl.theme.swatches.map((c, k) => (
                <span key={k} style={{ background: c }} />
              ))}
            </span>
          </button>
        </div>
      </div>
      <ThemeMenu
        open={menuOpen}
        currentId={themeCtl.themeId}
        onPreview={themeCtl.preview}
        onRevert={themeCtl.revert}
        onCommit={themeCtl.commit}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
}
