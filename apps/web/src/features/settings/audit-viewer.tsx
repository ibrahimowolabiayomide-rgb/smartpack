'use client';

import { useState } from 'react';
import { auditEntrySchema, cursorPageSchema, type AuditEntry } from '@smartpack/shared';
import { Button } from '@/components/ui/button';
import { DataTable, Td, Th } from '@/components/ui/data-table';
import { Notice } from '@/components/ui/notice';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiRequest, describeFailure } from '@/lib/api/browser';
import { describeAuditAction, summariseMetadata } from '@/lib/audit-labels';
import { formatTimestamp } from '@/lib/format';

const pageSchema = cursorPageSchema(auditEntrySchema);

/** Shows the first page rendered by the server and loads older events on request. */
export function AuditViewer({
  initial,
  nextCursor,
  query,
  timeZone,
}: {
  initial: AuditEntry[];
  nextCursor: string | null;
  /** The active filters, already encoded, so "load more" continues the same list. */
  query: string;
  timeZone: string;
}) {
  const [entries, setEntries] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = async () => {
    if (!cursor) return;
    setPending(true);
    setError(null);
    const result = await apiRequest(
      'GET',
      `/organizations/current/audit-logs?${query}&cursor=${cursor}` as `/${string}`,
      {
        schema: pageSchema,
      },
    );
    setPending(false);
    if (result.ok) {
      setEntries((current) => [...current, ...result.data.items]);
      setCursor(result.data.nextCursor);
    } else {
      setError(describeFailure(result));
    }
  };

  return (
    <div className="flex flex-col">
      <DataTable caption="Audit events, newest first" stacked flush>
        <thead>
          <tr>
            <Th>When</Th>
            <Th>Event</Th>
            <Th>By</Th>
            <Th>Details</Th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <Td label="When" className="whitespace-nowrap">
                {formatTimestamp(entry.occurredAt, timeZone)}
              </Td>
              <Td label="Event">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{describeAuditAction(entry.action)}</span>
                  {entry.outcome === 'failure' ? (
                    <StatusBadge tone="critical">Failed</StatusBadge>
                  ) : null}
                </div>
                <div className="break-all font-mono text-meta text-ink-subtle">{entry.action}</div>
              </Td>
              <Td label="By">
                {entry.actor?.displayName ?? (
                  <span className="text-ink-subtle">System or unknown</span>
                )}
              </Td>
              <Td label="Details">
                <ul className="flex flex-col text-meta text-ink-muted">
                  {summariseMetadata(entry.metadata).map((line) => (
                    <li key={line} className="break-all">
                      {line}
                    </li>
                  ))}
                </ul>
                {entry.requestId ? (
                  <div className="font-mono text-meta text-ink-subtle">
                    req {entry.requestId.slice(0, 8)}
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      <div className="flex flex-col items-start gap-3 border-t border-line p-4">
        {error ? (
          <div role="alert">
            <Notice tone="warning" title="Could not load more events">
              {error}
            </Notice>
          </div>
        ) : null}
        {cursor ? (
          <Button onClick={() => void loadMore()} loading={pending}>
            Load older events
          </Button>
        ) : (
          <p className="text-meta text-ink-subtle">
            End of the log. Events cannot be edited or deleted.
          </p>
        )}
      </div>
    </div>
  );
}
