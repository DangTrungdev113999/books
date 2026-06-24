import { useCallback, useEffect, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Mindmap } from './components/Mindmap';
import { ReaderModal } from './components/ReaderModal';
import { ResumeCard } from './components/ResumeCard';
import { Watermark } from './components/Watermark';
import { HistoryDrawer } from './components/HistoryDrawer';
import { useRegistry } from './hooks/useRegistry';
import { useBook } from './hooks/useBook';
import { useTheme } from './hooks/useTheme';
import { initState } from './lib/reading-state';
import { setBook, openSection, closeModal } from './lib/popup';
import { resetHighlightUI } from './lib/highlight';
import type { MindmapController } from './lib/mindmap';
import type { Lang } from './lib/types';

export function App() {
  const { registry, error: regError } = useRegistry();
  const themeCtl = useTheme();

  const [bookId, setBookId] = useState<string | null>(null);
  const [controller, setController] = useState<MindmapController | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // chọn sách đầu tiên khi registry sẵn sàng
  useEffect(() => {
    if (registry && !bookId) setBookId(registry.books[0].id);
  }, [registry, bookId]);

  const entry = registry?.books.find((b) => b.id === bookId) || null;
  const { book, error: bookError } = useBook(entry?.data || null);

  // Khởi tạo reading-state + popup TRONG render khi đổi sách — chạy trước khi
  // Mindmap (con) mount, đảm bảo decorate() đọc đúng state của sách hiện tại.
  const readyId = useRef<string | null>(null);
  if (book && readyId.current !== book.meta.id) {
    initState(book.meta.id, book.meta.sectionCount);
    setBook(book, entry?.pdf ? `${import.meta.env.BASE_URL}${entry.pdf}` : null);
    readyId.current = book.meta.id;
  }

  // Đổi sách → đóng modal + dọn highlight UI.
  useEffect(() => {
    closeModal();
    resetHighlightUI();
  }, [bookId]);

  const open = useCallback((id: string, opts?: { lang?: Lang; scrollTop?: number }) => {
    openSection(id, opts || {});
  }, []);

  if (regError) {
    return (
      <div style={{ padding: 32 }}>
        <b>Lỗi tải registry.</b> Hãy chạy: <code>npm run build:books</code>
        <div style={{ color: '#999', marginTop: 8 }}>{regError}</div>
      </div>
    );
  }
  if (!registry || !entry || !book) {
    return (
      <div style={{ padding: 32, color: 'hsl(var(--fg-2))' }}>
        {bookError ? (
          <>
            <b>Lỗi tải dữ liệu sách.</b> Hãy chạy: <code>npm run build:books</code>
            <div style={{ marginTop: 8 }}>{bookError}</div>
          </>
        ) : (
          'Đang tải…'
        )}
      </div>
    );
  }

  return (
    <>
      <div id="app">
        <Sidebar
          registry={registry}
          entry={entry}
          book={book}
          controller={controller}
          onChangeBook={setBookId}
          onOpenSection={open}
        />
        <main id="main">
          <Topbar themeCtl={themeCtl} onOpenHistory={() => setHistoryOpen(true)} />
          <ResumeCard book={book} onResume={(id, opts) => open(id, opts)} />
          <Mindmap key={bookId!} outline={book.markmap} onOpenSection={open} onReady={setController} />
          <Watermark />
        </main>
      </div>

      <HistoryDrawer book={book} open={historyOpen} onClose={() => setHistoryOpen(false)} onOpenSection={open} />
      <ReaderModal />
    </>
  );
}
