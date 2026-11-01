import type { RecordColumn } from '@/components/ui/records-view';

/**
 * Column headings for a record list whose module does not exist yet. The first heading is the
 * record's name on narrow screens. `cell` renders nothing because there are no rows to render;
 * the row type is `never` so no record shape is invented before the module defines it.
 */
export function plannedColumns(headers: readonly string[]): RecordColumn<never>[] {
  return headers.map((header, index) => ({
    id: header.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    header,
    primary: index === 0,
    cell: () => null,
  }));
}
