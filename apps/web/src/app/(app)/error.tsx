'use client';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';

/** Catches an unexpected failure in any signed-in page and keeps the shell around it intact. */
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="This page could not be displayed"
      description="Something went wrong while preparing this page. You can try again."
      action={
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
