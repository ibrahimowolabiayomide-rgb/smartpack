import type { Route } from 'next';
import { invitationSchema, memberSchema, pageSchema, roleSchema } from '@smartpack/shared';
import type { Metadata } from 'next';
import { z } from 'zod';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Panel } from '@/components/ui/panel';
import { holds, LoadFailure, NoAccess } from '@/features/settings/access';
import { InvitationsManager } from '@/features/settings/invitations-manager';
import { MembersManager } from '@/features/settings/members-manager';
import { MemberFilters } from '@/features/settings/member-filters';
import { authedGet, getSession } from '@/lib/auth/server';

export const metadata: Metadata = { title: 'Members' };

const PAGE_SIZE = 20;
const STATUSES = ['active', 'suspended', 'removed'] as const;

type SearchParams = Promise<{ page?: string; status?: string; search?: string }>;

export default async function MembersPage({ searchParams }: { searchParams: SearchParams }) {
  if (!(await holds('users.view'))) return <NoAccess what="Member management" />;
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const status = STATUSES.find((value) => value === params.status);
  const search = params.search?.trim().slice(0, 100) || undefined;

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (status) query.set('status', status);
  if (search) query.set('search', search);

  const [session, members, invitations, roles] = await Promise.all([
    getSession(),
    authedGet(`/organizations/current/members?${query}`, pageSchema(memberSchema)),
    authedGet('/organizations/current/invitations?pageSize=50', pageSchema(invitationSchema)),
    authedGet('/organizations/current/roles', z.object({ items: z.array(roleSchema) })),
  ]);
  const timeZone = session.status === 'authenticated' ? session.user.organization.timeZone : 'UTC';

  const hrefForPage = (target: number): Route => {
    const next = new URLSearchParams();
    if (status) next.set('status', status);
    if (search) next.set('search', search);
    next.set('page', String(target));
    return `/dashboard/settings/members?${next}` as Route;
  };

  return (
    <>
      <Panel
        title="Members"
        headingId="members-heading"
        meta={members.kind === 'ok' ? `${members.data.total} in total` : undefined}
        flush
      >
        <div className="flex flex-col gap-0">
          <div className="border-b border-line p-4">
            <MemberFilters status={status} search={search} />
          </div>
          {members.kind !== 'ok' || roles.kind !== 'ok' ? (
            <div className="p-5">
              <LoadFailure
                failure={
                  members.kind !== 'ok' ? members : (roles as Exclude<typeof roles, { kind: 'ok' }>)
                }
                what="The member list"
              />
            </div>
          ) : members.data.items.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title={search || status ? 'No members match these filters' : 'No members'}
                description={
                  search || status
                    ? 'Clear the filters to see everyone.'
                    : 'Invite people below to give them access.'
                }
              />
            </div>
          ) : (
            <>
              <MembersManager
                members={members.data.items}
                roles={roles.data.items}
                timeZone={timeZone}
              />
              <div className="border-t border-line p-4">
                <Pagination
                  page={members.data.page}
                  pageSize={members.data.pageSize}
                  total={members.data.total}
                  hrefForPage={hrefForPage}
                />
              </div>
            </>
          )}
        </div>
      </Panel>

      <Panel title="Invitations" headingId="invitations-heading" flush>
        {invitations.kind === 'ok' && roles.kind === 'ok' ? (
          <InvitationsManager
            invitations={invitations.data.items}
            roles={roles.data.items}
            timeZone={timeZone}
          />
        ) : (
          <div className="p-5">
            <LoadFailure
              failure={
                invitations.kind !== 'ok'
                  ? invitations
                  : (roles as Exclude<typeof roles, { kind: 'ok' }>)
              }
              what="Invitations"
            />
          </div>
        )}
      </Panel>
    </>
  );
}
