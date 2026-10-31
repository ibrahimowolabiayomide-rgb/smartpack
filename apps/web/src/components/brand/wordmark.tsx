import { cn } from '@/lib/cn';
import { PRODUCT_NAME } from '@/lib/app-info';

/** The SmartPack mark: a backpack outline on the accent colour. Drawn here, not an icon font. */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect width="28" height="28" rx="3" fill="var(--accent)" />
      <g fill="none" stroke="var(--accent-ink)" strokeWidth="1.6" strokeLinejoin="miter">
        <path d="M8.5 21.5V13a5.5 5.5 0 0 1 11 0v8.5z" />
        <path d="M11.5 8V6.5h5V8" />
        <path d="M11.5 21.5v-4.5h5v4.5" />
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark />
      <span className="font-serif text-lead font-semibold tracking-tight">{PRODUCT_NAME}</span>
    </span>
  );
}
