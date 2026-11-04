import { Wordmark } from '@/components/brand/wordmark';
import type { PublicBrand } from '@/lib/brand/config';
import { HelpMenu } from './help-menu';
import { MobileNav } from './mobile-nav';
import { UserMenu } from './user-menu';

/** Header bar: drawer trigger and wordmark on small screens; help and account menus on all. */
export function TopBar({ brand }: { brand: PublicBrand }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-ground px-4 sm:px-6 lg:px-10">
      <MobileNav logoSrc={brand.logoSrc} />
      <Wordmark className="lg:hidden" logoSrc={brand.logoSrc} />
      <div className="ml-auto flex items-center gap-1">
        <HelpMenu />
        <UserMenu />
      </div>
    </header>
  );
}
