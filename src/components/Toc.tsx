import { useState } from 'react';
import type { MindmapController, MMNode } from '../lib/mindmap';
import { collectSecIds, plainText } from '../lib/mindmap';
import type { BookData, RegistryGroup } from '../lib/types';
import { useReadingState } from '../hooks/useReadingState';
import { isRead, getLast } from '../lib/reading-state';

const ExpandIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);
const ReadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);
const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

interface Props {
  controller: MindmapController;
  groups: RegistryGroup[];
  book: BookData;
  onOpenSection: (id: string) => void;
}

export function Toc({ controller, groups, book, onOpenSection }: Props) {
  useReadingState(); // re-render khi tiến độ đổi
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const last = getLast();
  const groupsTree = controller.root.children || [];

  return (
    <nav id="toc">
      {groups.map((group, gi) => {
        const groupNode = groupsTree[gi];
        if (!groupNode) return null;
        return (
          <div className="toc-group" key={gi}>
            <div className="toc-group-title">{group.title}</div>
            {(groupNode.children || []).map((chNode: MMNode, ci) => {
              const title = plainText(chNode.content);
              const isExpandable = Boolean(chNode.children && chNode.children.length);
              const secIds = collectSecIds(chNode);
              const key = `${gi}-${ci}`;
              const readCount = secIds.filter(isRead).length;
              const isDone = secIds.length > 0 && readCount === secIds.length;
              const isPartial = readCount > 0 && readCount < secIds.length;
              const isCurrent = Boolean(last && secIds.includes(last.id));

              const cls = [
                'toc-item',
                activeKey === key ? 'active' : '',
                isDone ? 'is-done' : '',
                isPartial ? 'is-partial' : '',
                isCurrent ? 'is-current' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div
                  key={key}
                  className={cls}
                  data-kind={isExpandable ? 'expand' : 'read'}
                  title={isExpandable ? 'Mở các mục trên sơ đồ' : 'Đọc ngay'}
                  onClick={() => {
                    setActiveKey(key);
                    if (isExpandable) {
                      controller.focusChapter(chNode, groupNode);
                    } else {
                      const m = /href="#(sec-[^"]+)"/.exec(chNode.content);
                      if (m && book.sections[m[1]]) onOpenSection(m[1]);
                    }
                  }}
                >
                  <span className="no">{ci + 1}</span>
                  <span className="label">{title}</span>
                  <span className="tick" aria-hidden="true">
                    <CheckIcon />
                  </span>
                  <span className="kind">{isExpandable ? <ExpandIcon /> : <ReadIcon />}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
