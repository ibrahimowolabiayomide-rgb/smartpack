import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Td, Th } from './data-table';

export interface RecordColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** The column that names a record. It becomes the title line of each card on small screens. */
  primary?: boolean;
}

/**
 * The same records in two layouts, chosen by screen width rather than by shrinking one:
 *
 * - wide screens: a table with real column headings;
 * - narrow screens: a list of cards, each led by the primary column, with the other columns as
 *   labelled pairs.
 *
 * With no rows, the table keeps its column headings (so the structure is visible) and `empty` is
 * shown once beneath it. Use `EmptyState` when the module works and has no records, and
 * `UnavailableState` when the module does not exist yet.
 *
 * This is a server component: `cell` functions are called on the server.
 */
export function RecordsView<T>({
  caption,
  columns,
  rows,
  getRowKey,
  empty,
  tableFrom,
}: {
  caption: string;
  columns: readonly RecordColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  empty: ReactNode;
  /** Width from which the table replaces the cards. Defaults to `xl` for tables of five or more columns, otherwise `md`. */
  tableFrom?: 'md' | 'xl';
}) {
  const primary = columns.find((column) => column.primary) ?? columns[0];
  const secondary = columns.filter((column) => column !== primary);
  const from = tableFrom ?? (columns.length > 4 ? 'xl' : 'md');
  const showTable = from === 'xl' ? 'hidden xl:block' : 'hidden md:block';
  const hideCards = from === 'xl' ? 'xl:hidden' : 'md:hidden';

  return (
    <div>
      <div
        role="region"
        aria-label={caption}
        tabIndex={0}
        className={cn(showTable, 'overflow-x-auto')}
      >
        <table className="w-full border-collapse text-left text-ui [&_tbody_tr:not(:last-child)]:border-b [&_tbody_tr]:border-line">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <Th key={column.id} className="px-3 align-bottom">
                  {column.header}
                </Th>
              ))}
            </tr>
          </thead>
          {rows.length > 0 ? (
            <tbody>
              {rows.map((row) => (
                <tr key={getRowKey(row)}>
                  {columns.map((column) => (
                    <Td key={column.id} className="px-3">
                      {column.cell(row)}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : null}
        </table>
      </div>

      {rows.length > 0 ? (
        <ul className={cn(hideCards, 'divide-y divide-line')} aria-label={caption}>
          {rows.map((row) => (
            <li key={getRowKey(row)} className="flex flex-col gap-2 px-5 py-4">
              {primary ? <div className="font-medium text-ink">{primary.cell(row)}</div> : null}
              <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-meta">
                {secondary.map((column) => (
                  <div key={column.id} className="contents">
                    <dt className="text-ink-subtle">{column.header}</dt>
                    <dd className="text-ink">{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      ) : null}

      {rows.length === 0 ? <div className="p-5">{empty}</div> : null}
    </div>
  );
}
