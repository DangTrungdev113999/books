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
              <div className="crumb" id="modal-crumb"></div>
              <h2 id="modal-title"></h2>
            </div>
            <div className="lang-toggle" id="lang-toggle">
              <button data-lang="vi" className="active">
                Tiếng Việt
              </button>
              <button data-lang="en">English</button>
            </div>
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
