'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { organizationSchema, type Organization } from '@smartpack/shared';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { apiRequest, describeFailure, type FieldErrors } from '@/lib/api/browser';

/** Edits the company name, time zone and country. The reference (slug) never changes. */
export function CompanyProfileForm({ organization }: { organization: Organization }) {
  const router = useRouter();
  const toast = useToast();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const timeZone = String(data.get('timeZone') ?? '').trim();
    const country = String(data.get('country') ?? '')
      .trim()
      .toUpperCase();

    const body: Record<string, string | null> = {};
    if (name !== organization.name) body.name = name;
    if (timeZone !== organization.timeZone) body.timeZone = timeZone;
    if (country !== (organization.country ?? '')) body.country = country === '' ? null : country;
    if (Object.keys(body).length === 0) {
      setMessage('Nothing has changed.');
      setErrors({});
      return;
    }

    setPending(true);
    setMessage(null);
    const result = await apiRequest('PATCH', '/organizations/current', {
      body,
      schema: organizationSchema,
    });
    setPending(false);
    if (result.ok) {
      setErrors({});
      toast.notify({ tone: 'success', title: 'Company profile saved' });
      router.refresh();
      return;
    }
    setErrors(result.fieldErrors);
    if (Object.keys(result.fieldErrors).length === 0) setMessage(describeFailure(result));
  };

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      aria-label="Company profile"
      className="flex flex-col gap-4"
    >
      {message ? (
        <div role="alert">
          <Notice tone="warning" title="Not saved">
            {message}
          </Notice>
        </div>
      ) : null}
      <TextField
        label="Company name"
        name="name"
        defaultValue={organization.name}
        required
        error={errors.name}
      />
      <TextField
        label="Time zone"
        name="timeZone"
        defaultValue={organization.timeZone}
        hint="An IANA zone name, for example Europe/London. Dates in reports will use it."
        required
        error={errors.timeZone}
      />
      <TextField
        label="Country"
        name="country"
        defaultValue={organization.country ?? ''}
        maxLength={2}
        hint="Two-letter ISO code, for example NG. Optional."
        error={errors.country}
      />
      <div>
        <Button type="submit" variant="primary" loading={pending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
