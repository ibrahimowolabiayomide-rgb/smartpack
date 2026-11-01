'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Tabs following the WAI-ARIA tabs pattern: one tab stop for the tab list, arrow keys move between
 * tabs (and activate them), Home and End jump to the ends, and every panel is labelled by its tab.
 * Inactive panels stay in the document but are hidden, so their content is not lost on switching.
 */
export function Tabs({
  label,
  tabs,
  defaultTabId,
}: {
  /** Names the tab list for assistive technology, e.g. "Custody views". */
  label: string;
  tabs: readonly TabItem[];
  defaultTabId?: string;
}) {
  const baseId = useId();
  const [activeId, setActiveId] = useState(defaultTabId ?? tabs[0]?.id);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const targets: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = tabs[target];
    if (!next) return;
    setActiveId(next.id);
    tabRefs.current.get(next.id)?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label={label}
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {tabs.map((tab, index) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) tabRefs.current.set(tab.id, node);
                else tabRefs.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(event) => move(event, index)}
              className={cn(
                '-mb-px shrink-0 border-b-2 px-4 py-2.5 text-ui font-medium whitespace-nowrap pointer-coarse:py-3',
                selected
                  ? 'border-accent text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== activeId}
          tabIndex={0}
          className="rounded-sm outline-offset-4"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
