import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DateField } from './date-field';
import { FilterBar } from './filter-bar';
import { PasswordField } from './password-field';
import { Pagination, pageRange } from './pagination';
import { RecordsView, type RecordColumn } from './records-view';
import { SearchField } from './search-field';
import { SelectField } from './select-field';
import { UnavailableState } from './unavailable-state';

describe('PasswordField', () => {
  it('hides the password by default and reveals it with the toggle', async () => {
    render(<PasswordField label="Password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('keeps what was typed when toggled', async () => {
    render(<PasswordField label="Password" />);
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveValue('secret');
  });

  it('is reachable by keyboard and never submits the form', async () => {
    render(
      <form>
        <PasswordField label="Password" />
      </form>,
    );
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute('type', 'button');
  });

  it('announces its error and links it to the input', () => {
    render(<PasswordField label="Password" error="Enter your password." />);
    expect(screen.getByLabelText('Password')).toBeInvalid();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your password.');
  });

  it('disables the toggle with the input', () => {
    render(<PasswordField label="Password" disabled />);
    expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();
  });
});

describe('SelectField / SearchField / DateField', () => {
  it('label their controls', () => {
    render(
      <>
        <SelectField label="Status" options={[{ value: '', label: 'All statuses' }]} />
        <SearchField label="Search" />
        <DateField label="From" />
      </>,
    );
    expect(screen.getByLabelText('Status')).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText('Search')).toHaveAttribute('type', 'search');
    expect(screen.getByLabelText('From')).toHaveAttribute('type', 'date');
  });

  it('let a person choose an option', async () => {
    render(
      <SelectField
        label="Status"
        options={[
          { value: '', label: 'All' },
          { value: 'x', label: 'Option X' },
        ]}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Option X');
    expect(screen.getByLabelText('Status')).toHaveValue('x');
  });

  it('take typed and picked values', async () => {
    render(
      <>
        <SearchField label="Search" />
        <DateField label="From" />
      </>,
    );
    await userEvent.type(screen.getByLabelText('Search'), 'abc');
    expect(screen.getByLabelText('Search')).toHaveValue('abc');
    await userEvent.type(screen.getByLabelText('From'), '2026-10-31');
    expect(screen.getByLabelText('From')).toHaveValue('2026-10-31');
  });
});

describe('FilterBar', () => {
  it('disables every control and says why when unavailable', () => {
    render(
      <FilterBar label="Filter things" unavailableReason="Turns on when records exist.">
        <SearchField label="Search" />
        <SelectField label="Status" options={[{ value: '', label: 'All' }]} />
      </FilterBar>,
    );
    expect(screen.getByLabelText('Search')).toBeDisabled();
    expect(screen.getByLabelText('Status')).toBeDisabled();
    expect(screen.getByText('Turns on when records exist.')).toBeVisible();
    expect(screen.getByRole('group', { name: 'Filter things' })).toBeDisabled();
  });

  it('leaves controls usable when there is no reason to disable them', () => {
    render(
      <FilterBar label="Filter things">
        <SearchField label="Search" />
      </FilterBar>,
    );
    expect(screen.getByLabelText('Search')).toBeEnabled();
  });
});

describe('Pagination', () => {
  it('computes the visible range', () => {
    expect(pageRange(1, 25, 0)).toBeNull();
    expect(pageRange(1, 25, 10)).toEqual({ from: 1, to: 10 });
    expect(pageRange(2, 25, 60)).toEqual({ from: 26, to: 50 });
    expect(pageRange(3, 25, 60)).toEqual({ from: 51, to: 60 });
  });

  it('says there is nothing to page through and disables both buttons', () => {
    render(
      <Pagination page={1} pageSize={25} total={0} hrefForPage={(p) => `/x?page=${p}` as never} />,
    );
    expect(screen.getByText('No records to page through')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('links to neighbouring pages and disables the edge it is on', () => {
    render(
      <Pagination page={1} pageSize={25} total={60} hrefForPage={(p) => `/x?page=${p}` as never} />,
    );
    expect(screen.getByText('Showing 1 to 25 of 60')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/x?page=2');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });
});

describe('UnavailableState', () => {
  it('names the phase and the dependency', () => {
    render(
      <UnavailableState title="Nothing here" description="Because." phase={4} requires="The API" />,
    );
    expect(screen.getByText('Planned for Phase 4')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument();
    expect(screen.getByText('Depends on: The API')).toBeInTheDocument();
  });
});

interface Row {
  id: string;
  name: string;
  status: string;
}
const columns: RecordColumn<Row>[] = [
  { id: 'name', header: 'Name', primary: true, cell: (r) => r.name },
  { id: 'status', header: 'Status', cell: (r) => r.status },
];

describe('RecordsView', () => {
  it('renders a table and a card list for the same rows', () => {
    const rows: Row[] = [
      { id: '1', name: 'Test row one', status: 'Alpha' },
      { id: '2', name: 'Test row two', status: 'Beta' },
    ];
    render(
      <RecordsView
        caption="Test records"
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        empty={<p>none</p>}
      />,
    );
    const table = screen.getByRole('table', { name: 'Test records' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Name', 'Status']);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    const list = screen.getByRole('list', { name: 'Test records' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText('none')).not.toBeInTheDocument();
  });

  it('keeps the headings and shows the empty state exactly once when there are no rows', () => {
    render(
      <RecordsView
        caption="Test records"
        columns={columns}
        rows={[]}
        getRowKey={(r: Row) => r.id}
        empty={<p>Nothing to show</p>}
      />,
    );
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getAllByText('Nothing to show')).toHaveLength(1);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
