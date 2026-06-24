import { BookSwitcher } from './BookSwitcher';
import { Toc } from './Toc';
import type { MindmapController } from '../lib/mindmap';
import type { BookData, Registry, RegistryBook } from '../lib/types';

interface Props {
  registry: Registry;
  entry: RegistryBook; // mục registry của sách hiện tại (chứa groups)
  book: BookData;
  controller: MindmapController | null;
  onChangeBook: (id: string) => void;
  onOpenSection: (id: string) => void;
}

export function Sidebar({ registry, entry, book, controller, onChangeBook, onOpenSection }: Props) {
  return (
    <aside id="sidebar">
      <div id="brand">
        <BookSwitcher books={registry.books} currentId={book.meta.id} onChange={onChangeBook} />
        <div className="masthead">
          <div className="mh-row">
            <div className="mh-text">
              <h1 id="brand-title">{book.meta.titleVi}</h1>
              <div className="by" id="brand-by">
                {book.meta.author} · {book.meta.title}
              </div>
            </div>
            <svg
              className="mh-chev"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>
      {controller ? (
        <Toc controller={controller} groups={entry.groups} book={book} onOpenSection={onOpenSection} />
      ) : (
        <nav id="toc"></nav>
      )}
      {entry.pdf && (
        <a
          className="source-doc"
          href={`${import.meta.env.BASE_URL}${entry.pdf}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Mở bản gốc PDF trong tab mới"
        >
          <span className="sd-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M8 13h4M8 17h6" />
            </svg>
          </span>
          <span className="sd-text">
            <span className="sd-label">Bản gốc</span>
          </span>
          <svg className="sd-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 17 17 7" />
            <path d="M9 7h8v8" />
          </svg>
        </a>
      )}
    </aside>
  );
}
