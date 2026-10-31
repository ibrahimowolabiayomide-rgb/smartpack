import { cn } from '@/lib/cn';

/**
 * Placeholder blocks shown while a page streams in. Announced once to assistive technology
 * through the status role; the blocks themselves are hidden from it.
 */
export function LoadingState({ label = 'Loading', rows = 4 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">{label}…</span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <div className="h-5 w-40 rounded-sm bg-sunken motion-safe:animate-pulse" />
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className={cn(
              'h-9 rounded-sm bg-sunken motion-safe:animate-pulse',
              index % 2 === 0 ? 'w-full' : 'w-5/6',
            )}
          />
        ))}
      </div>
    </div>
  );
}
