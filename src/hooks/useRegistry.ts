import { useEffect, useState } from 'react';
import type { Registry } from '../lib/types';

const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;

interface State {
  registry: Registry | null;
  error: string | null;
}

/** Nạp registry các sách (public/data/books.json). */
export function useRegistry(): State {
  const [state, setState] = useState<State>({ registry: null, error: null });
  useEffect(() => {
    let alive = true;
    fetch(dataUrl('books.json'))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Registry>;
      })
      .then((registry) => alive && setState({ registry, error: null }))
      .catch((e) => alive && setState({ registry: null, error: String(e) }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export { dataUrl };
