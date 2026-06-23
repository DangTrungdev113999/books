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
        <h1 id="brand-title">{book.meta.titleVi}</h1>
        <div className="by" id="brand-by">
          {book.meta.author} · {book.meta.title}
        </div>
      </div>
      {controller ? (
        <Toc controller={controller} groups={entry.groups} book={book} onOpenSection={onOpenSection} />
      ) : (
        <nav id="toc"></nav>
      )}
    </aside>
  );
}
