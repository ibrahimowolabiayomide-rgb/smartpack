import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';

export const metadata: Metadata = { title: 'Terms' };

/**
 * Placeholder. No legal text has been supplied or approved, and none is invented here. Replace
 * this page with the approved text before the platform handles real company or worker data.
 */
export default function TermsPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6 py-10 lg:py-16">
      <h1 className="font-serif text-title font-semibold tracking-tight">Terms</h1>
      <Notice tone="warning" title="Not yet published">
        The terms that govern use of the platform have not been written or approved. Until approved
        text is provided, this page intentionally states nothing about legal rights or obligations.
      </Notice>
      <div>
        <ButtonLink href="/">Back to the home page</ButtonLink>
      </div>
    </div>
  );
}
