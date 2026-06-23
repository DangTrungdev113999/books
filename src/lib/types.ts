/* Kiểu dữ liệu dùng chung cho trình đọc sách. Khớp với output của scripts/build.mjs. */

export type Lang = 'vi' | 'en';

/** Một section (lá) trong sách — đơn vị mở popup để đọc. */
export interface Section {
  idx: string;
  id: string;
  title_vi: string;
  title_en: string;
  md_vi: string | null;
  md_en: string | null;
  aligned: boolean;
  book: string;
  chapter: string;
  chapter_en: string;
  hasVi: boolean;
}

export interface BookMeta {
  id: string;
  title: string;
  titleVi: string;
  author: string;
  sectionCount: number;
  missingViFiles: number;
  generatedAt: string;
}

/** Dữ liệu một cuốn sách đã build (public/data/<id>.json). */
export interface BookData {
  meta: BookMeta;
  markmap: string;
  order: string[];
  sections: Record<string, Section>;
}

export interface RegistryGroup {
  title: string;
  files: string[];
}

export interface RegistryBook {
  id: string;
  title: string;
  titleVi: string;
  author: string;
  source: string;
  data: string;
  groups: RegistryGroup[];
}

export interface Registry {
  books: RegistryBook[];
}

/** Bản ghi highlight lưu trong localStorage (theo section + lang). */
export interface Highlight {
  id: string;
  blockIndex: number;
  start: number;
  end: number;
  quote: string;
  color: string;
  note: string;
  ts: number;
}

export type HistoryType = 'read' | 'highlight' | 'note';

export interface HistoryEntry {
  type: HistoryType;
  id: string;
  lang?: Lang;
  ts: number;
  preview?: string;
}

export interface LastPosition {
  id: string;
  lang: Lang;
  scrollTop: number;
  ts: number;
  title?: string;
}
