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
  make                TEXT,
  model               TEXT,
  type                TEXT    NOT NULL,
  capacity            INTEGER NOT NULL CHECK (capacity > 0)
);

-- ── 4. trips ─────────────────────────────────────────────────
-- [FR1] Trip Lifecycle — central entity. All FRs are bound to an active trip record.
-- [FR3] Server-Mediated Communication — data minimisation enforced at schema level.
-- PRIVACY CONSTRAINT: client_first_name only.
-- No last_name column, no phone_number column — these fields do not exist in the schema.
-- Even if application code tried to store a surname or phone number, there is no column
-- to receive it. Data minimisation is enforced architecturally, not through policy.
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
                                       'completed',
                                       'cancelled'
                                     )),
  assigned_driver_id     UUID        REFERENCES drivers(id)  ON DELETE SET NULL,
  vehicle_id             UUID        REFERENCES vehicles(id) ON DELETE SET NULL,
  flight_number          TEXT,
  notes                  TEXT,
  additional_info        TEXT,
  eta                    TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 5. complaints ────────────────────────────────────────────
-- [FR5] Conditional Persistence — encrypted_message_archive is nullable TEXT.
--       NULL means no complaint was filed, or no messages were exchanged.
--       Only populated when a complaint is filed within the 24h window and
--       Redis buffer messages exist. The schema itself reflects the data lifecycle.
-- [FR6] Complaint Investigation — status column drives the investigation gate.
--       Transitions: open -> under_investigation -> resolved (terminal, no re-open).
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
-- [FR6] Complaint Investigation — every MESSAGE_ARCHIVE_ACCESSED event is logged here.
-- [FR7] Privacy Dashboard — dashboard reads this table for compliance metrics.
-- Append-only by convention enforced at DB role level (see migrations/002).
-- UPDATE and DELETE are revoked from the application role — records are permanent.
-- Compliance columns satisfy Kenya Data Protection Act 2019:
--   legal_basis        → DPA 2019 s.25 (lawful basis for processing)
--   retention_category → DPA 2019 s.30 (retention periods)
--   destruction_hash   → DPA 2019 s.41 (proof of deletion without retaining content)
--   data_subjects      → tracks which data subjects are affected by this operation
CREATE TABLE IF NOT EXISTS audit_log (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type        TEXT        NOT NULL,
  actor_id           UUID        NOT NULL,
  actor_role         TEXT        NOT NULL,
  target_id          UUID,
  timestamp          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address         INET,
  details            JSONB,
  legal_basis        TEXT,
  retention_category TEXT,
  destruction_hash   TEXT,
  data_subjects      JSONB
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

-- ── 8. client_push_subscriptions ─────────────────────────────
-- Stores Web Push subscriptions registered by clients via the PWA.
-- Keyed by client_corporate_email (no persistent UUID for clients).
-- endpoint is unique per browser/device. Subscriptions are removed
-- automatically when the push service returns 404/410 (stale endpoint),
-- or when the client unsubscribes via DELETE /bookings/push-subscribe.
CREATE TABLE IF NOT EXISTS client_push_subscriptions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT        NOT NULL,
  endpoint     TEXT        NOT NULL UNIQUE,
  p256dh       TEXT        NOT NULL,
  auth         TEXT        NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_push_subscriptions_email
  ON client_push_subscriptions (client_email);

-- ── 9. driver_notifications ───────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   UUID        NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  type        TEXT        NOT NULL,
  trip_id     UUID        REFERENCES trips(id) ON DELETE SET NULL,
  read        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
