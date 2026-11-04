-- Reference data for access control, and write-protection for the audit log.
--
-- Permissions and built-in roles are seeded here so the API can read them from the database. The
-- same definitions live in packages/shared/src/permissions.ts; an integration test fails if the
-- two ever differ. Later phases add their permissions and role grants in their own migrations.
-- This is configuration, not sample data: no users, companies or business records are created.

INSERT INTO "permissions" ("key", "category", "description") VALUES
  ('organization.view', 'organization', 'View the company profile.'),
  ('organization.manage', 'organization', 'Change company settings.'),
  ('organization.transfer_ownership', 'organization', 'Grant or remove the Owner role. Held by owners only.'),
  ('users.invite', 'users', 'Invite people to the company.'),
  ('users.view', 'users', 'View company members and invitations.'),
  ('users.update', 'users', 'Edit a member''s profile details.'),
  ('users.suspend', 'users', 'Suspend, reactivate and remove members'' access.'),
  ('roles.manage', 'users', 'Assign roles to members.'),
  ('assets.view', 'assets', 'View SmartPack asset records.'),
  ('assets.create', 'assets', 'Register SmartPack assets.'),
  ('assets.update', 'assets', 'Edit SmartPack asset records.'),
  ('workers.view', 'workers', 'View worker records.'),
  ('workers.manage', 'workers', 'Manage worker records.'),
  ('verifications.view', 'verification', 'View verification records.'),
  ('verifications.manage', 'verification', 'Create and manage verification records.'),
  ('tracking.view', 'tracking', 'View location tracking data.'),
  ('custody.view', 'custody', 'View custody records.'),
  ('custody.manage', 'custody', 'Assign assets and record handovers.'),
  ('inspections.view', 'inspections', 'View inspections.'),
  ('inspections.manage', 'inspections', 'Record and manage inspections.'),
  ('alerts.view', 'alerts', 'View alerts.'),
  ('incidents.manage', 'alerts', 'Manage security incidents.'),
  ('reports.view', 'reports', 'View reports.'),
  ('reports.export', 'reports', 'Export reports.'),
  ('audit.view', 'audit', 'View the audit log.');
--> statement-breakpoint
INSERT INTO "roles" ("key", "name", "description", "rank") VALUES
  ('owner', 'Company Owner', 'Primary administrator. Full control of the company, including who else may be an owner.', 10),
  ('admin', 'Company Administrator', 'Administers members, roles and settings. Cannot grant or remove the Owner role.', 20),
  ('operations_manager', 'Operations Manager', 'Runs day-to-day operations across assets, workers, custody and reports.', 30),
  ('asset_manager', 'Asset Manager', 'Maintains SmartPack asset records and their inspection history.', 40),
  ('supervisor', 'Supervisor', 'Oversees workers and their handovers, verifications and inspections.', 50),
  ('worker', 'Worker', 'Field user. Holds no company-wide data permissions; worker-facing access is added with the modules that need it.', 60),
  ('auditor', 'Auditor (read-only)', 'Can review company records and the audit log but cannot change anything.', 70);
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT r."id", g."permission_key"
FROM "roles" r
JOIN (VALUES
  ('owner', 'organization.view'),
  ('owner', 'organization.manage'),
  ('owner', 'organization.transfer_ownership'),
  ('owner', 'users.invite'),
  ('owner', 'users.view'),
  ('owner', 'users.update'),
  ('owner', 'users.suspend'),
  ('owner', 'roles.manage'),
  ('owner', 'assets.view'),
  ('owner', 'assets.create'),
  ('owner', 'assets.update'),
  ('owner', 'workers.view'),
  ('owner', 'workers.manage'),
  ('owner', 'verifications.view'),
  ('owner', 'verifications.manage'),
  ('owner', 'tracking.view'),
  ('owner', 'custody.view'),
  ('owner', 'custody.manage'),
  ('owner', 'inspections.view'),
  ('owner', 'inspections.manage'),
  ('owner', 'alerts.view'),
  ('owner', 'incidents.manage'),
  ('owner', 'reports.view'),
  ('owner', 'reports.export'),
  ('owner', 'audit.view'),
  ('admin', 'organization.view'),
  ('admin', 'organization.manage'),
  ('admin', 'users.invite'),
  ('admin', 'users.view'),
  ('admin', 'users.update'),
  ('admin', 'users.suspend'),
  ('admin', 'roles.manage'),
  ('admin', 'assets.view'),
  ('admin', 'assets.create'),
  ('admin', 'assets.update'),
  ('admin', 'workers.view'),
  ('admin', 'workers.manage'),
  ('admin', 'verifications.view'),
  ('admin', 'verifications.manage'),
  ('admin', 'tracking.view'),
  ('admin', 'custody.view'),
  ('admin', 'custody.manage'),
  ('admin', 'inspections.view'),
  ('admin', 'inspections.manage'),
  ('admin', 'alerts.view'),
  ('admin', 'incidents.manage'),
  ('admin', 'reports.view'),
  ('admin', 'reports.export'),
  ('admin', 'audit.view'),
  ('operations_manager', 'organization.view'),
  ('operations_manager', 'users.view'),
  ('operations_manager', 'assets.view'),
  ('operations_manager', 'assets.create'),
  ('operations_manager', 'assets.update'),
  ('operations_manager', 'workers.view'),
  ('operations_manager', 'workers.manage'),
  ('operations_manager', 'verifications.view'),
  ('operations_manager', 'verifications.manage'),
  ('operations_manager', 'tracking.view'),
  ('operations_manager', 'custody.view'),
  ('operations_manager', 'custody.manage'),
  ('operations_manager', 'inspections.view'),
  ('operations_manager', 'inspections.manage'),
  ('operations_manager', 'alerts.view'),
  ('operations_manager', 'incidents.manage'),
  ('operations_manager', 'reports.view'),
  ('operations_manager', 'reports.export'),
  ('asset_manager', 'organization.view'),
  ('asset_manager', 'assets.view'),
  ('asset_manager', 'assets.create'),
  ('asset_manager', 'assets.update'),
  ('asset_manager', 'verifications.view'),
  ('asset_manager', 'tracking.view'),
  ('asset_manager', 'custody.view'),
  ('asset_manager', 'inspections.view'),
  ('asset_manager', 'inspections.manage'),
  ('asset_manager', 'reports.view'),
  ('supervisor', 'organization.view'),
  ('supervisor', 'assets.view'),
  ('supervisor', 'workers.view'),
  ('supervisor', 'verifications.view'),
  ('supervisor', 'verifications.manage'),
  ('supervisor', 'tracking.view'),
  ('supervisor', 'custody.view'),
  ('supervisor', 'custody.manage'),
  ('supervisor', 'inspections.view'),
  ('supervisor', 'inspections.manage'),
  ('supervisor', 'alerts.view'),
  ('worker', 'organization.view'),
  ('auditor', 'organization.view'),
  ('auditor', 'users.view'),
  ('auditor', 'assets.view'),
  ('auditor', 'workers.view'),
  ('auditor', 'verifications.view'),
  ('auditor', 'tracking.view'),
  ('auditor', 'custody.view'),
  ('auditor', 'inspections.view'),
  ('auditor', 'alerts.view'),
  ('auditor', 'reports.view'),
  ('auditor', 'audit.view')
) AS g ("role_key", "permission_key") ON g."role_key" = r."key";
--> statement-breakpoint
-- The audit log is append-only. These triggers make UPDATE, DELETE and TRUNCATE fail for every
-- role that has not deliberately disabled them, so a bug or a compromised endpoint cannot rewrite
-- history. Retention (purging old rows) is an explicit, reviewed operator task; see
-- docs/AUDIT_LOGGING.md.
CREATE FUNCTION "audit_logs_reject_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (% not permitted)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "audit_logs_no_update_delete"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_reject_change"();
--> statement-breakpoint
CREATE TRIGGER "audit_logs_no_truncate"
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_logs_reject_change"();
