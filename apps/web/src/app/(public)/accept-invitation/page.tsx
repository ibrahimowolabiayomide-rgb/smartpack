import type { Metadata } from 'next';
import { AcceptInvitationForm } from '@/features/auth/accept-invitation-form';
import { AuthCard } from '@/features/auth/auth-card';

export const metadata: Metadata = { title: 'Accept your invitation', referrer: 'no-referrer' };

export default function AcceptInvitationPage() {
  return (
    <AuthCard
      title="Accept your invitation"
      description="Set up your access to the company's SmartPack workspace."
    >
      <AcceptInvitationForm />
    </AuthCard>
  );
}
