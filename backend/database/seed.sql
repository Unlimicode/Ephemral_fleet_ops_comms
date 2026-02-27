-- ─────────────────────────────────────────────────────────────
-- Privacy-Preserving Fleet Operations System – Role Provisioning
-- ─────────────────────────────────────────────────────────────
-- IMPORTANT: This script must be run by a PostgreSQL superuser
-- AFTER schema.sql has been applied to the fleet_ops_db database.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Create the application role ───────────────────────────
-- Replace the placeholder password before deploying to any environment.
CREATE ROLE fleet_ops_app WITH LOGIN PASSWORD 'change_me_before_deploy';

-- ── 2. Database-level access ──────────────────────────────────
GRANT CONNECT ON DATABASE fleet_ops_db TO fleet_ops_app;

-- ── 3. Schema-level access ────────────────────────────────────
GRANT USAGE ON SCHEMA public TO fleet_ops_app;

-- ── 4. Table-level access (all tables in public schema) ───────
GRANT SELECT, INSERT, UPDATE, DELETE
    ON ALL TABLES IN SCHEMA public
    TO fleet_ops_app;

-- ── 5. Enforce append-only guarantee on the audit trail ───────
-- Revoking UPDATE and DELETE here enforces the append-only guarantee
-- on the audit_log table at the DATABASE level — not merely by
-- application convention. Even if application code is compromised
-- or misconfigured, no credential using this role can silently
-- alter or erase audit records.
REVOKE UPDATE, DELETE
    ON TABLE audit_log
    FROM fleet_ops_app;
