import { useEffect, useRef } from 'react';
import { createMindmap, type MindmapController } from '../lib/mindmap';
import { useReadingState } from '../hooks/useReadingState';

interface Props {
  /** outline markmap (book.markmap). Component nên được key theo bookId ở parent. */
  outline: string;
  onOpenSection: (id: string) => void;
  /** nhận controller khi sẵn sàng (Sidebar dùng để dựng TOC + focusChapter). */
  onReady: (c: MindmapController | null) => void;
}

export function Mindmap({ outline, onOpenSection, onReady }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const ctrlRef = useRef<MindmapController | null>(null);
  const version = useReadingState();

  // refs cho callback để effect mount-once không phụ thuộc identity
  const openRef = useRef(onOpenSection);
  const readyRef = useRef(onReady);
  openRef.current = onOpenSection;
  readyRef.current = onReady;

  useEffect(() => {
    if (!svgRef.current) return;
    const ctrl = createMindmap(svgRef.current, outline, {
      onOpenSection: (id) => openRef.current(id),
    });
    ctrlRef.current = ctrl;
    readyRef.current(ctrl);
    return () => {
      ctrl.destroy();
      ctrlRef.current = null;
      readyRef.current(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outline]);

  // Read-state đổi → chỉ tô lại trạng thái đọc, KHÔNG dựng lại map.
  useEffect(() => {
    ctrlRef.current?.decorate();
  }, [version]);

  return (
    <>
      <svg id="map" ref={svgRef}></svg>
    </>
  );
}
