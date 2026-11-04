import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SettingsLoading from './(app)/dashboard/settings/loading';

describe('Settings loading state', () => {
  it('announces that Settings is loading and shows placeholder blocks, not a blank page', () => {
    const { container } = render(<SettingsLoading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading settings');
    expect(container.querySelectorAll('[aria-hidden="true"] > div').length).toBeGreaterThan(3);
  });
});
