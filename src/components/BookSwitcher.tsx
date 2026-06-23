import type { RegistryBook } from '../lib/types';

interface Props {
  books: RegistryBook[];
  currentId: string;
  onChange: (id: string) => void;
}

/** Dropdown chọn sách ở đầu sidebar. Ẩn nếu chỉ có 1 sách. */
export function BookSwitcher({ books, currentId, onChange }: Props) {
  if (books.length < 2) return null;
  return (
    <label className="book-switcher">
      <span className="bs-label">Sách</span>
      <select value={currentId} onChange={(e) => onChange(e.target.value)}>
        {books.map((b) => (
          <option key={b.id} value={b.id}>
            {b.titleVi || b.title}
          </option>
        ))}
      </select>
    </label>
  );
}
