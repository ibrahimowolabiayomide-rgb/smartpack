'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Asks the server to render the page again, which repeats the live API health request (it is never
 * cached). The busy state lasts exactly as long as the server takes to answer.
 */
export function RefreshStatusButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button size="sm" loading={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? 'Checking' : 'Check again'}
    </Button>
  );
}
