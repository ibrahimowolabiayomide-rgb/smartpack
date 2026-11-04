import type { Metadata } from 'next';
import { AuthCard } from '@/features/auth/auth-card';
import { ResetPasswordForm } from '@/features/auth/reset-password-form';

export const metadata: Metadata = { title: 'Choose a new password', referrer: 'no-referrer' };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password">
      <ResetPasswordForm />
    </AuthCard>
  );
}
