-- Migration 010: Manager-issued driver password reset links
-- Replaces the temp-password copy/paste flow with a one-time emailed link.
-- Tokens are single-use, expire after 1 hour, and are invalidated once a new
-- password is set.

CREATE TABLE IF NOT EXISTS driver_password_resets (
    token       TEXT        PRIMARY KEY,
    driver_id   UUID        NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    issued_by   UUID        REFERENCES fleet_managers(id) ON DELETE SET NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_password_resets_driver_id
    ON driver_password_resets (driver_id);

-- Idempotent: investigation_notes already lives in schema.sql, but ensure it
-- exists on test databases that bootstrap from migrations only.
ALTER TABLE complaints
    ADD COLUMN IF NOT EXISTS investigation_notes TEXT;
