'use client';

import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/ui/search-field';
import { SelectField } from '@/components/ui/select-field';

/** GET-style filters: the state lives in the address, so a filtered list can be bookmarked and shared. */
export function MemberFilters({ status, search }: { status?: string; search?: string }) {
  const router = useRouter();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    const nextStatus = String(data.get('status') ?? '');
    const nextSearch = String(data.get('search') ?? '').trim();
    if (nextStatus) next.set('status', nextStatus);
    if (nextSearch) next.set('search', nextSearch);
    const query = next.toString();
    router.push(`/dashboard/settings/members${query ? `?${query}` : ''}` as Route);
  };
  return (
    <form
      onSubmit={onSubmit}
      role="search"
      aria-label="Filter members"
      className="flex flex-wrap items-end gap-3"
    >
      <div className="min-w-56 flex-1">
        <SearchField label="Search by name or email" name="search" defaultValue={search ?? ''} />
      </div>
      <div className="w-44">
        <SelectField
          label="Status"
          name="status"
          defaultValue={status ?? ''}
          options={[
            { value: '', label: 'Active and suspended' },
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'removed', label: 'Removed' },
          ]}
        />
      </div>
      <Button type="submit" variant="secondary">
        Apply
      </Button>
    </form>
  );
}
