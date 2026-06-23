/* ════════════════════════════════════════════════════════════════════════════
 * mindmap.ts — Controller bọc markmap (port phần markmap của js/app.js).
 *   createMindmap(svg, outline, handlers) → { mm, root, destroy, decorate,
 *   focusChapter, forceVisible }. React component Mindmap mount/unmount nó theo
 *   bookId; Sidebar đọc `root` để dựng TOC và gọi focusChapter.
 * ════════════════════════════════════════════════════════════════════════════ */

import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import { getLast, isRead } from './reading-state';

const INITIAL_EXPAND = 3; // root + nhóm + chương hiện sẵn; lá gập, click để xem

/** Node markmap (chỉ những field ta dùng). */
export interface MMNode {
  content: string;
  children?: MMNode[];
  payload?: { fold?: number };
}

export interface MindmapController {
  mm: Markmap;
  root: MMNode;
  destroy(): void;
  decorate(): void;
  focusChapter(target: MMNode, groupNode: MMNode): void;
  forceVisible(): void;
}

interface Handlers {
  onOpenSection: (id: string) => void;
}

function setFold(node: MMNode, folded: boolean) {
  if (!node.payload) node.payload = {};
  node.payload.fold = folded ? 1 : 0;
}

export function createMindmap(
  svg: SVGSVGElement,
  outline: string,
  handlers: Handlers
): MindmapController {
  const { root } = new Transformer().transform(outline);
  const mmRoot = root as unknown as MMNode;

  const mm = Markmap.create(
    svg,
    {
      duration: 0, // tránh transition d3 treo ở opacity≈0 khi tab throttle
      initialExpandLevel: INITIAL_EXPAND,
      spacingVertical: 12,
      spacingHorizontal: 96,
      paddingX: 18,
    },
    root
  );

  // Ép node markmap luôn hiển thị (chống transition d3 treo khi tab throttle).
  function forceVisible() {
    svg
      .querySelectorAll('foreignObject, path, circle, line')
      .forEach((el) => ((el as HTMLElement).style.opacity = '1'));
    decorate();
  }

  // Gắn trạng thái đọc lên các lá: đã đọc (✓) / đang đọc dở.
  function decorate() {
    const last = getLast();
    svg.querySelectorAll('a[href^="#sec-"]').forEach((a) => {
      const id = (a.getAttribute('href') || '').slice(1);
      a.classList.toggle('is-read', isRead(id));
      a.classList.toggle('is-current', Boolean(last && last.id === id));
    });
  }

  // Mở rộng riêng một chương: mở nhóm chứa nó, gập nhóm/chương khác, fit lại.
  function focusChapter(target: MMNode, groupNode: MMNode) {
    for (const group of mmRoot.children || []) {
      setFold(group, group !== groupNode);
      for (const ch of group.children || []) {
        if (ch.children && ch.children.length) setFold(ch, ch !== target);
      }
    }
    void mm.renderData();
    forceVisible();
    setTimeout(() => {
      void mm.renderData();
      void mm.fit();
      forceVisible();
    }, 70);
  }

  function onClick(e: MouseEvent) {
    const a = (e.target as Element).closest('a');
    if (a) {
      const href = a.getAttribute('href') || '';
      if (href.startsWith('#sec-')) {
        e.preventDefault();
        e.stopPropagation();
        handlers.onOpenSection(href.slice(1));
      }
      return;
    }
    // Click vào CHỮ của node (không phải lá) → xổ/gập children
    const fo = (e.target as Element).closest('foreignObject');
    if (fo) {
      const g = (e.target as Element).closest('g.markmap-node') as
        | (SVGGElement & { __data__?: MMNode })
        | null;
      const node = g && g.__data__;
      if (node && node.children && node.children.length) {
        e.preventDefault();
        e.stopPropagation();
        if (!node.payload) node.payload = {};
        node.payload.fold = node.payload.fold ? 0 : 1;
        void mm.renderData(node as never);
        forceVisible();
        setTimeout(() => {
          void mm.renderData(node as never);
          forceVisible();
        }, 60);
      }
    }
  }

  svg.addEventListener('click', onClick, true);

  forceVisible();
  setTimeout(() => {
    void mm.fit();
    forceVisible();
  }, 60);

  function destroy() {
    svg.removeEventListener('click', onClick, true);
    mm.destroy();
    svg.replaceChildren();
  }

  return { mm, root: mmRoot, destroy, decorate, focusChapter, forceVisible };
}

/** Lấy text thuần từ content HTML của một node. */
export function plainText(html: string): string {
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || '').trim();
}

/** Tập hợp mọi section-id (lá) nằm dưới một node chương. */
export function collectSecIds(node: MMNode): string[] {
  const ids: string[] = [];
  const walk = (n: MMNode) => {
    const m = /href="#(sec-[^"]+)"/.exec(n.content || '');
    if (m) ids.push(m[1]);
    (n.children || []).forEach(walk);
  };
  walk(node);
  return ids;
}
