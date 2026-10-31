import { Wordmark } from '@/components/brand/wordmark';
import { StatusBadge } from '@/components/ui/status-badge';
import { MobileNav } from './mobile-nav';

/** Header bar: drawer trigger and wordmark on small screens, build marker on all. */
export function TopBar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-ground px-4 sm:px-6 lg:px-10">
      <MobileNav />
      <Wordmark className="lg:hidden" />
      <div className="ml-auto flex items-center gap-3">
        <StatusBadge tone="warning">Development preview</StatusBadge>
      </div>
    </header>
  );
}
