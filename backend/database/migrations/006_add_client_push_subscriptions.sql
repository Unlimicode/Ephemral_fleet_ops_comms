-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006 — Client push subscriptions
-- ─────────────────────────────────────────────────────────────────────────────
-- Clients have no persistent account UUID — their identity anchor is their
-- corporate email address. Push subscriptions are therefore keyed by email so
-- that any active browser subscription for a given client can be reached when
-- an event (e.g. driver acceptance) fires.
--
-- Lifecycle: subscriptions are removed on 404/410 from the push service (stale
-- browser), or when the client explicitly unsubscribes via DELETE /push-subscribe.
-- No FK to trips — one email maps to many trips over time.
-- ─────────────────────────────────────────────────────────────────────────────

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
