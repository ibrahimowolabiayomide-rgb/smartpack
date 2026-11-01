import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/toast';
import { getBrandConfig } from '@/lib/brand/server';
import { PreviewBanner } from './preview-banner';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';

/**
 * Frame for every signed-in page: navigation rail, header and a main region.
 * The `id` on <main> is the target of the skip link in the root layout.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const brand = await getBrandConfig();
  return (
    <ToastProvider>
      <div className="flex min-h-dvh">
        <Sidebar brand={brand} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar brand={brand} />
          <PreviewBanner />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 px-4 py-8 outline-none sm:px-6 lg:px-10 lg:py-10"
          >
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
