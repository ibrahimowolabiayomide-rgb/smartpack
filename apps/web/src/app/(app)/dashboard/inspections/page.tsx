import type { Metadata } from 'next';
import { DateField } from '@/components/ui/date-field';
import { SelectField } from '@/components/ui/select-field';
import { ListWorkspace } from '@/features/modules/list-workspace';
import { ModuleHeader } from '@/features/modules/module-header';
import { getModule } from '@/lib/modules';

export const metadata: Metadata = { title: 'Inspections' };

export default function InspectionsPage() {
  const { phase, requires } = getModule('inspections');
  return (
    <>
      <ModuleHeader moduleId="inspections" />
      <ListWorkspace
        title="Inspection history"
        headingId="inspection-history-heading"
        filterLabel="Filter inspections"
        columns={[
          'Inspection date',
          'SmartPack',
          'Inspector',
          'Condition',
          'Evidence photographs',
          'Notes',
        ]}
        filters={
          <>
            <DateField label="Inspected from" name="from" />
            <DateField label="Inspected to" name="to" />
            <SelectField
              label="Condition"
              name="condition"
              options={[{ value: '', label: 'All conditions' }]}
            />
          </>
        }
        basePath="/dashboard/inspections"
        phase={phase ?? 6}
        requires={requires ?? ''}
        unavailableTitle="No inspections are recorded"
        unavailableDescription="Each inspection will be listed with its date, inspector, condition, notes and evidence photographs. Inspection recording is not built yet."
      />
    </>
  );
}
