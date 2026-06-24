import { useEffect } from 'react';
import { initReader } from '../lib/popup';

/**
 * Scaffold cố định của popup đọc + lớp UI nổi (tooltip/highlight). React render
 * cấu trúc + id MỘT LẦN; nội dung #modal-body do lib/popup.ts + lib/highlight.ts
 * quản lý imperative (React KHÔNG sở hữu subtree .prose). Component không unmount.
 */
export function ReaderModal() {
  useEffect(() => {
    initReader();
  }, []);

  return (
    <>
      {/* Popup */}
      <div id="overlay">
        <div id="modal" role="dialog" aria-modal="true">
          <header id="modal-head">
            <div className="htext">
              <h2 id="modal-title"></h2>
            </div>
            <div className="lang-toggle" id="lang-toggle">
              <button data-lang="vi" className="active" data-htip="Tiếng Việt" aria-label="Tiếng Việt">
                VI
              </button>
              <button data-lang="en" data-htip="English" aria-label="English">
                EN
              </button>
            </div>
            <button id="audio-toggle" className="hidden" aria-label="Nghe đọc sách" data-htip="Nghe đọc sách">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 14v-1a9 9 0 0 1 18 0v1" />
                <path d="M19 14a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-1v-5z" />
                <path d="M5 14a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h1v-5z" />
              </svg>
            </button>
            <button id="cmp-toggle" className="hidden" aria-label="So sánh bản gốc PDF" data-htip="So sánh với bản PDF gốc">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              <span>PDF</span>
            </button>
            <button id="modal-close" aria-label="Đóng">
              &times;
            </button>
          </header>
          <div id="modal-body"></div>
          <div id="modal-foot">
            {/* panel góp ý: gập mặc định, xổ ra khi bấm "Ghi điều học được" */}
            <section id="feedback">
              <div className="fb-inner">
                <div className="composer">
                  <input id="fb-name" className="cmp-name" type="text" placeholder="Tên của bạn" maxLength={50} />
                  <textarea
                    id="fb-comment"
                    className="cmp-text"
                    placeholder="Mình học được điều gì từ phần này?"
                    maxLength={1000}
                  ></textarea>
                  <div className="cmp-bar">
                    <span className="cmp-count" id="fb-count">
                      0
                    </span>
                    <span className="status" id="fb-status"></span>
                    <button className="btn-send" id="fb-send">
                      <span>Gửi</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 2 11 13" />
                        <path d="M22 2 15 22l-4-9-9-4Z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </section>
            {/* thanh phát "đọc sách" (Vbee TTS) — hiện khi section có audio */}
            <div id="audio-bar" className="hidden">
              <audio id="audio-el" preload="none"></audio>
              <button id="audio-play" aria-label="Phát / Tạm dừng">
                <svg className="ic-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <svg className="ic-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              </button>
              <span className="audio-label">Nghe</span>
              <span id="audio-cur" className="audio-time">0:00</span>
              <input id="audio-seek" className="audio-seek" type="range" min={0} max={0} defaultValue={0} aria-label="Tua" />
              <span id="audio-dur" className="audio-time">0:00</span>
              <button id="audio-speed" className="audio-speed" aria-label="Tốc độ đọc">1×</button>
            </div>

            {/* thanh footer gọn: luôn 1 dòng */}
            <div id="foot-bar">
              <button className="foot-btn" id="nav-prev" title="">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                <span>Trước</span>
              </button>
              <button className="foot-btn note-toggle" id="note-toggle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                <span>Ghi điều học được</span>
                <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 15l-6-6-6 6" />
                </svg>
              </button>
              <button className="foot-btn" id="nav-next" title="">
                <span>Tiếp</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Bản PDF gốc — split bên phải khi bật "So sánh". User tự cuộn tới đoạn cần. */}
        <aside id="pdf-pane" aria-label="Bản PDF gốc">
          <iframe id="pdf-frame" title="Bản PDF gốc"></iframe>
        </aside>
      </div>

      {/* Lớp UI nổi — do các module imperative tìm theo id */}
      <div id="tooltip"></div>
      <div id="navtip"></div>
      <div id="hl-toolbar" className="hidden"></div>
      <div id="hl-popover" className="hidden"></div>
      <div id="hl-note-tip" className="hidden"></div>
    </>
  );
}
