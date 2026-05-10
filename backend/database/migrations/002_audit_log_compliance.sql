-- 002_audit_log_compliance.sql
-- Adds 4 DPA 2019-compliance columns to audit_log and enforces append-only
-- access at the database role level (DPA 2019 ss.25, 30, 41).
--
-- Run with: psql $DATABASE_URL -f backend/database/migrations/002_audit_log_compliance.sql

ALTER TABLE audit_log
    ADD COLUMN IF NOT EXISTS legal_basis        TEXT,
    ADD COLUMN IF NOT EXISTS retention_category TEXT,
    ADD COLUMN IF NOT EXISTS destruction_hash   TEXT,
    ADD COLUMN IF NOT EXISTS data_subjects      JSONB;

-- Enforce append-only at the DB role level. Replace 'swiftlink_app' with the
-- actual application role name if different. The DO block is idempotent.
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'swiftlink_app') THEN
        REVOKE UPDATE, DELETE ON TABLE audit_log FROM swiftlink_app;
        GRANT INSERT, SELECT ON TABLE audit_log TO swiftlink_app;
    END IF;
END
$$;

COMMENT ON COLUMN audit_log.legal_basis        IS 'Statutory basis for processing, e.g. DPA 2019 s.25 — Data Minimization';
COMMENT ON COLUMN audit_log.retention_category IS 'ephemeral | conditional_persistence | investigation';
COMMENT ON COLUMN audit_log.destruction_hash   IS 'SHA-256 hex digest of Redis session keys before deletion (DPA 2019 s.41 proof)';
COMMENT ON COLUMN audit_log.data_subjects      IS 'JSONB identifiers of affected data subjects (driver_id, trip_id)';
