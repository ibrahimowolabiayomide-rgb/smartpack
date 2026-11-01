import type { Route } from 'next';
import type { ReactNode } from 'react';
import { FilterBar } from '@/components/ui/filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { Panel } from '@/components/ui/panel';
import { RecordsView } from '@/components/ui/records-view';
import { UnavailableState } from '@/components/ui/unavailable-state';
import { plannedColumns } from './planned-columns';

/**
 * The common shape of a record list: filter bar, table (cards on narrow screens) and paging. All
 * three are present so the layout is settled, and all three are honest: the controls are off and
 * say why, the table has no rows, and the pager reports that there is nothing to page through.
 */
export function ListWorkspace({
  title,
  headingId,
  columns,
  filters,
  filterLabel,
  basePath,
  phase,
  requires,
  unavailableTitle,
  unavailableDescription,
  filterReason,
  tableFrom,
}: {
  title: string;
  headingId: string;
  columns: readonly string[];
  filters: ReactNode;
  filterLabel: string;
  basePath: Route;
  phase: number;
  requires: string;
  unavailableTitle: string;
  unavailableDescription: string;
  /** Why the controls are off. Defaults to a sentence naming the phase. */
  filterReason?: string;
  tableFrom?: 'md' | 'xl';
}) {
  return (
    <Panel title={title} headingId={headingId} flush>
      <FilterBar
        label={filterLabel}
        unavailableReason={
          filterReason ?? `Search and filters turn on when records exist (Phase ${phase}).`
        }
      >
        {filters}
      </FilterBar>
      <RecordsView
        caption={`${title} (no records)`}
        columns={plannedColumns(columns)}
        rows={[]}
        getRowKey={() => ''}
        tableFrom={tableFrom}
        empty={
          <UnavailableState
            title={unavailableTitle}
            description={unavailableDescription}
            phase={phase}
            requires={requires}
          />
        }
      />
      <Pagination
        page={1}
        pageSize={25}
        total={0}
        hrefForPage={(page) => `${basePath}?page=${page}` as Route}
      />
    </Panel>
  );
}
