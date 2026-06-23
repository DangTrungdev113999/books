import { useCallback, useEffect, useState } from 'react';
import { THEMES, DEFAULT_THEME, type Theme } from '../lib/themes';

const STORE_KEY = 'book-theme';
const byId = (id: string): Theme => THEMES.find((t) => t.id === id) || THEMES[0];

function setDomTheme(id: string) {
  document.documentElement.dataset.theme = id;
}

/**
 * Quản lý theme. `themeId` là theme đã chốt (persist). `preview()` đổi tạm
 * không lưu; `commit()` chốt + lưu; `revert()` quay lại theme đã chốt.
 */
export function useTheme() {
  const [themeId, setThemeId] = useState<string>(
    () => localStorage.getItem(STORE_KEY) || DEFAULT_THEME
  );

  // Áp theme đã chốt lên <html> mỗi khi đổi.
  useEffect(() => {
    setDomTheme(themeId);
  }, [themeId]);

  const preview = useCallback((id: string) => setDomTheme(id), []);
  const revert = useCallback(() => setDomTheme(themeId), [themeId]);
  const commit = useCallback((id: string) => {
    localStorage.setItem(STORE_KEY, id);
    setThemeId(id);
  }, []);

  return { themeId, theme: byId(themeId), preview, revert, commit };
}
