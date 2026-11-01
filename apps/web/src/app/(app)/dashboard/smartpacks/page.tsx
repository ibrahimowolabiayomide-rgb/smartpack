import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/ui/search-field';
import { SelectField } from '@/components/ui/select-field';
import { ListWorkspace } from '@/features/modules/list-workspace';
import { ModuleHeader } from '@/features/modules/module-header';
import { getModule } from '@/lib/modules';

export const metadata: Metadata = { title: 'SmartPacks' };

export default function SmartPacksPage() {
  const { phase, requires } = getModule('smartpacks');
  return (
    <>
      <ModuleHeader
        moduleId="smartpacks"
        actions={
          <Button variant="primary" disabled>
            Register SmartPack
          </Button>
        }
      />
      <ListWorkspace
        title="SmartPack records"
        headingId="smartpack-records-heading"
        filterLabel="Filter SmartPacks"
        columns={[
          'Asset ID',
          'Serial number',
          'QR identity',
          'Status',
          'Current custodian',
          'Last known location',
          'Condition',
          'Registered',
        ]}
        filters={
          <>
            <SearchField
              label="Search"
              name="q"
              placeholder="Asset ID or serial number"
              autoComplete="off"
            />
            <SelectField
              label="Status"
              name="status"
              options={[{ value: '', label: 'All statuses' }]}
            />
            <SelectField
              label="Condition"
              name="condition"
              options={[{ value: '', label: 'All conditions' }]}
            />
          </>
        }
        basePath="/dashboard/smartpacks"
        phase={phase ?? 4}
        requires={requires ?? ''}
        tableFrom="xl"
        unavailableTitle="No SmartPack records exist"
        unavailableDescription="Registered backpacks will be listed here with their identity, QR code, custodian, last known location and condition. Nothing has been registered, because registration is not built yet."
      />
    </>
  );
}
