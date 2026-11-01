import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/ui/search-field';
import { SelectField } from '@/components/ui/select-field';
import { ListWorkspace } from '@/features/modules/list-workspace';
import { ModuleHeader } from '@/features/modules/module-header';
import { getModule } from '@/lib/modules';

export const metadata: Metadata = { title: 'Workers' };

export default function WorkersPage() {
  const { phase, requires } = getModule('workers');
  return (
    <>
      <ModuleHeader
        moduleId="workers"
        actions={
          <Button variant="primary" disabled>
            Add worker
          </Button>
        }
      />
      <ListWorkspace
        title="Worker records"
        headingId="worker-records-heading"
        filterLabel="Filter workers"
        columns={[
          'Worker',
          'Contact',
          'Employment status',
          'Current assignments',
          'Assigned SmartPacks',
          'Last activity',
        ]}
        filters={
          <>
            <SearchField label="Search" name="q" placeholder="Name or contact" autoComplete="off" />
            <SelectField
              label="Employment status"
              name="status"
              options={[{ value: '', label: 'All statuses' }]}
            />
            <SelectField
              label="Assignment"
              name="assignment"
              options={[{ value: '', label: 'Any assignment' }]}
            />
          </>
        }
        basePath="/dashboard/workers"
        phase={phase ?? 5}
        requires={requires ?? ''}
        unavailableTitle="No worker records exist"
        unavailableDescription="Workers will be listed here with their contact details, status, current assignments and the SmartPacks they hold. No workers have been created, because worker management is not built yet."
      />
    </>
  );
}
