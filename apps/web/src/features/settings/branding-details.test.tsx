import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseBrandConfig } from '@/lib/brand/config';
import { BrandingDetails } from './branding-details';

/** Built with the real parser, so the component is tested against real configuration results. */
const brandFrom = (env: Record<string, string | undefined>) => parseBrandConfig(env);

function row(label: string): HTMLElement {
  const term = screen.getByText(label);
  const group = term.parentElement;
  if (!group) throw new Error(`No row for ${label}`);
  return group;
}

describe('BrandingDetails', () => {
  it('shows the configured name, logo and accent colour', () => {
    render(
      <BrandingDetails
        brand={brandFrom({
          BRAND_COMPANY_NAME: 'Example Manufacturing Ltd',
          BRAND_LOGO_URL: '/icon-192.png',
          BRAND_ACCENT_COLOR: '#1d4f91',
        })}
      />,
    );
    expect(
      within(row('Company name (web branding)')).getByText('Example Manufacturing Ltd'),
    ).toBeInTheDocument();
    expect(within(row('Logo')).getByText('Custom logo in use')).toBeInTheDocument();
    expect(within(row('Accent colour')).getByText('#1d4f91')).toBeInTheDocument();
    expect(screen.queryByText('Some branding values were ignored')).not.toBeInTheDocument();
  });

  it('says Not configured and names the defaults when nothing is set', () => {
    render(<BrandingDetails brand={brandFrom({})} />);
    expect(within(row('Company name (web branding)')).getByText('Not configured')).toBeVisible();
    expect(within(row('Logo')).getByText('SmartPack mark (default)')).toBeVisible();
    expect(within(row('Accent colour')).getByText('SmartPack green (default)')).toBeVisible();
    expect(screen.queryByText('Some branding values were ignored')).not.toBeInTheDocument();
  });

  it('explains every rejected value by variable name and never prints the value', () => {
    render(
      <BrandingDetails
        brand={brandFrom({
          BRAND_COMPANY_NAME: 'x'.repeat(200),
          BRAND_LOGO_URL: 'http://insecure.example/logo.png',
          BRAND_ACCENT_COLOR: '#f2e600',
        })}
      />,
    );
    expect(screen.getByText('Some branding values were ignored')).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    expect(text).toContain('BRAND_COMPANY_NAME was ignored');
    expect(text).toContain('BRAND_LOGO_URL was ignored');
    expect(text).toContain('BRAND_ACCENT_COLOR was ignored');
    expect(text).not.toContain('insecure.example');
    expect(text).not.toContain('#f2e600');
    // Rejected values fall back to the defaults.
    expect(within(row('Company name (web branding)')).getByText('Not configured')).toBeVisible();
  });
});
