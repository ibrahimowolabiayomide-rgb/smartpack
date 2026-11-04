import { Notice } from '@/components/ui/notice';
import type { BrandConfig } from '@/lib/brand/config';

/**
 * How this web server is branded, read from its real configuration (BRAND_COMPANY_NAME,
 * BRAND_LOGO_URL, BRAND_ACCENT_COLOR). Nothing here is stored in the database or invented: a
 * value that is not set says "Not configured" or names the default, and a value that was
 * supplied but rejected is explained in a warning that names the variable, never its value.
 *
 * This is separate from the company's registered name above it, which comes from the database.
 */
export function BrandingDetails({ brand }: { brand: BrandConfig }) {
  const rows: ReadonlyArray<{ label: string; value: string }> = [
    { label: 'Company name (web branding)', value: brand.companyName ?? 'Not configured' },
    { label: 'Logo', value: brand.logoSrc ? 'Custom logo in use' : 'SmartPack mark (default)' },
    {
      label: 'Accent colour',
      value: brand.accent ? brand.accent.accent : 'SmartPack green (default)',
    },
  ];

  return (
    <section aria-labelledby="branding-heading" className="flex flex-col gap-3">
      <h3 id="branding-heading" className="text-ui font-semibold">
        Web branding
      </h3>
      <dl className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-2.5 first:border-t"
          >
            <dt className="text-ink-muted">{row.label}</dt>
            <dd className="text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-meta text-ink-subtle">
        These values are read from the web server&apos;s environment (BRAND_COMPANY_NAME,
        BRAND_LOGO_URL, BRAND_ACCENT_COLOR) and change when the server is restarted, with no
        rebuild. No official company identity or contact details have been supplied.
      </p>
      {brand.warnings.length > 0 ? (
        <Notice tone="warning" title="Some branding values were ignored">
          <ul className="list-disc pl-5">
            {brand.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
    </section>
  );
}
