-- ─────────────────────────────────────────────────────────────
-- Privacy-Preserving Fleet Operations System – MVP Schema
-- ─────────────────────────────────────────────────────────────
-- Run with: psql $DATABASE_URL -f backend/database/schema.sql
-- ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. fleet_managers ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fleet_managers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  work_email    TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  full_name     TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. drivers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drivers (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_manager_id UUID    NOT NULL
                           REFERENCES fleet_managers(id) ON DELETE CASCADE,
  full_name        TEXT    NOT NULL,
  work_email       TEXT    NOT NULL UNIQUE,
  password_hash    TEXT    NOT NULL,
  employee_id      TEXT    NOT NULL UNIQUE,
  active_status    BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── 3. vehicles ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number TEXT    NOT NULL UNIQUE,
  type                TEXT    NOT NULL,
  capacity            INTEGER NOT NULL CHECK (capacity > 0)
);

-- ── 4. trips ─────────────────────────────────────────────────
-- PRIVACY CONSTRAINT: client_first_name only.
-- No last_name, no phone_number — data minimisation enforced at schema level.
CREATE TABLE IF NOT EXISTS trips (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_corporate_email TEXT        NOT NULL,
  client_first_name      TEXT        NOT NULL,
  pickup_location        TEXT        NOT NULL,
  destination            TEXT        NOT NULL,
  pickup_time            TIMESTAMPTZ NOT NULL,
  status                 TEXT        NOT NULL DEFAULT 'pending'
                                     CHECK (status IN (
                                       'pending',
                                       'accepted',
                                       'in_progress',
                                       'completed'
                                     )),
  assigned_driver_id     UUID        REFERENCES drivers(id)  ON DELETE SET NULL,
  vehicle_id             UUID        REFERENCES vehicles(id) ON DELETE SET NULL,
  flight_number          TEXT
);

-- ── 5. complaints ────────────────────────────────────────────
-- encrypted_message_archive: nullable TEXT — populated only when a complaint
-- is filed against an ephemeral Redis chat session (conditionally archived).
CREATE TABLE IF NOT EXISTS complaints (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id                   UUID        NOT NULL
                                        REFERENCES trips(id) ON DELETE CASCADE,
  category                  TEXT        NOT NULL,
  description               TEXT        NOT NULL,
  status                    TEXT        NOT NULL DEFAULT 'open',
  encrypted_message_archive TEXT,
  investigation_notes      TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 6. audit_log (append-only) ───────────────────────────────
-- Revoke UPDATE and DELETE on this table from the app role during provisioning.
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT        NOT NULL,
  actor_id    UUID        NOT NULL,
  actor_role  TEXT        NOT NULL,
  target_id   UUID,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address  INET,
  details     JSONB
);

-- ── 7. push_subscriptions ─────────────────────────────────────
-- Stores Web Push subscription objects registered by drivers via the PWA.
-- endpoint, p256dh, and auth together form the subscription object generated
-- by the browser's PushManager. endpoint is unique per browser/device
-- combination — the same browser always produces the same endpoint.
-- ON DELETE CASCADE removes subscriptions automatically when a driver account
-- is deleted, preventing push attempts to stale or orphaned endpoints.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id  UUID        NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL UNIQUE,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
