'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { AUDIT_CATEGORIES } from '@smartpack/shared';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { AUDIT_ACTION_OPTIONS } from '@/lib/audit-labels';

const CATEGORY_LABELS: Record<string, string> = {
  security: 'Security',
  account: 'Account',
  administration: 'Administration',
  system: 'System',
};

export function AuditFilters({ category, action }: { category?: string; action?: string }) {
  const router = useRouter();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of ['category', 'action'] as const) {
      const value = String(data.get(key) ?? '');
      if (value) next.set(key, value);
    }
    const query = next.toString();
    router.push(`/dashboard/settings/audit${query ? `?${query}` : ''}` as Route);
  };
  return (
    <form
      onSubmit={onSubmit}
      role="search"
      aria-label="Filter audit events"
      className="flex flex-wrap items-end gap-3"
    >
      <div className="w-48">
        <SelectField
          label="Category"
          name="category"
          defaultValue={category ?? ''}
          options={[
            { value: '', label: 'All categories' },
            ...AUDIT_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] ?? value })),
          ]}
        />
      </div>
      <div className="w-72 max-w-full">
        <SelectField
          label="Event"
          name="action"
          defaultValue={action ?? ''}
          options={[{ value: '', label: 'All events' }, ...AUDIT_ACTION_OPTIONS]}
        />
      </div>
      <Button type="submit" variant="secondary">
        Apply
      </Button>
    </form>
  );
}
