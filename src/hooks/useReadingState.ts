import { useSyncExternalStore } from 'react';
import { subscribe, getVersion } from '../lib/reading-state';

/**
 * Re-render component mỗi khi reading-state đổi. Trả về `version` (số nguyên) —
 * snapshot là số nên KHÔNG gây render-storm; component tự gọi progress()/
 * getHistory()/isRead()/getLast() để lấy dữ liệu mới.
 */
export function useReadingState(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}
