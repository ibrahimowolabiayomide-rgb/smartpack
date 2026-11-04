'use client';

import { useRouter } from 'next/navigation';
import { messageSchema } from '@smartpack/shared';
import { DropdownMenu, type MenuItem } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { useSession } from '@/features/auth/session-context';
import { apiRequest } from '@/lib/api/browser';

/** Up to two capital letters from a display name, for the narrow-screen trigger. */
function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => [...word][0] ?? '');
  return (letters.length > 1 ? letters[0]! + letters[letters.length - 1]! : (letters[0] ?? ''))
    .toUpperCase()
    .slice(0, 2);
}

/** Account menu: who is signed in, account settings, and sign-out. */
export function UserMenu() {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();

  const signOut = async () => {
    const result = await apiRequest('POST', '/auth/logout', { body: {}, schema: messageSchema });
    // A 401 means the session was already gone; either way this device is signed out.
    if (result.ok || result.httpStatus === 401) {
      router.replace('/login?reason=signed-out');
      router.refresh();
    } else {
      toast.notify({
        tone: 'error',
        title: 'Could not sign out',
        description: 'The service did not confirm it. Try again.',
      });
    }
  };

  const items: readonly MenuItem[] = [
    { id: 'security', label: 'Account and security', href: '/dashboard/settings/security' },
    { id: 'sign-out', label: 'Sign out', onSelect: () => void signOut() },
  ];
  return (
    <DropdownMenu
      label={user.user.displayName}
      narrowLabel={initialsOf(user.user.displayName)}
      items={items}
    />
  );
}
