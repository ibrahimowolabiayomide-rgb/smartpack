'use client';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="This page could not be displayed"
      description="Something went wrong while preparing the overview. You can try again."
      action={
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
