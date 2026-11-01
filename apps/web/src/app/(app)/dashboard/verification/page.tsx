import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/panel';
import { RecordsView } from '@/components/ui/records-view';
import { UnavailableState } from '@/components/ui/unavailable-state';
import { ModuleHeader } from '@/features/modules/module-header';
import { plannedColumns } from '@/features/modules/planned-columns';
import { getModule } from '@/lib/modules';

export const metadata: Metadata = { title: 'Verification' };

export default function VerificationPage() {
  const { phase, requires } = getModule('verification');
  const planned = phase ?? 6;
  return (
    <>
      <ModuleHeader moduleId="verification">
        <Notice title="What verification can and cannot establish">
          A QR code identifies an asset. A photograph is visual evidence. Neither one, on its own,
          proves where a bag is or that the bag in a photograph is the registered one. Verification
          will record both so people can review them, and it will not claim more than that.
        </Notice>
      </ModuleHeader>

      <Panel title="Scan a QR code" headingId="verification-scan-heading">
        <UnavailableState
          title="Scanning is not available"
          description="A worker will scan a SmartPack's QR code with the device camera and photograph the bag as evidence. Camera access is switched off in this build and no QR codes exist yet."
          phase={planned}
          requires={requires}
          action={<Button disabled>Start scan</Button>}
        />
      </Panel>

      <Panel title="Verification records" headingId="verification-records-heading" flush>
        <RecordsView
          caption="Verification records (no records)"
          columns={plannedColumns([
            'Verified at',
            'SmartPack',
            'Method',
            'Result',
            'Verified by',
            'Evidence photograph',
          ])}
          rows={[]}
          getRowKey={() => ''}
          empty={
            <UnavailableState
              title="No verification records exist"
              description="Each verification will be recorded here with its time, method, result and photographic evidence."
              phase={planned}
            />
          }
        />
      </Panel>

      <Panel title="Failed verification review" headingId="verification-failed-heading">
        <UnavailableState
          title="Nothing to review"
          description="Verifications that fail will be queued here for an administrator to review. No verification has been performed, so this queue is not in operation."
          phase={planned}
        />
      </Panel>
    </>
  );
}
