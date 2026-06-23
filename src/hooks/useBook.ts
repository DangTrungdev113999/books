import { useEffect, useState } from 'react';
import type { BookData } from '../lib/types';
import { dataUrl } from './useRegistry';

interface State {
  book: BookData | null;
  loading: boolean;
  error: string | null;
}

/** Nạp dữ liệu một cuốn sách (public/data/<dataFile>). */
export function useBook(dataFile: string | null): State {
  const [state, setState] = useState<State>({ book: null, loading: false, error: null });
  useEffect(() => {
    if (!dataFile) return;
    let alive = true;
    setState({ book: null, loading: true, error: null });
    fetch(dataUrl(dataFile))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<BookData>;
      })
      .then((book) => alive && setState({ book, loading: false, error: null }))
      .catch((e) => alive && setState({ book: null, loading: false, error: String(e) }));
    return () => {
      alive = false;
    };
  }, [dataFile]);
  return state;
}
