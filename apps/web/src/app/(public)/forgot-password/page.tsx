import type { Metadata } from 'next';
import { AuthCard } from '@/features/auth/auth-card';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email address and we will send a reset link if it belongs to an account."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
