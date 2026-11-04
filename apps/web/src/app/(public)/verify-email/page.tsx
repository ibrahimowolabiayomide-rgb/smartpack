import type { Metadata } from 'next';
import { AuthCard } from '@/features/auth/auth-card';
import { VerifyEmailPanel } from '@/features/auth/verify-email-panel';

export const metadata: Metadata = { title: 'Verify your email', referrer: 'no-referrer' };

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Verify your email">
      <VerifyEmailPanel />
    </AuthCard>
  );
}
