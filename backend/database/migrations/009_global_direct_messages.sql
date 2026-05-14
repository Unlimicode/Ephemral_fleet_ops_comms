-- Migration 009: Always-on driver↔manager and client↔manager DMs
-- Removes the trip-scoped constraint from direct_messages so drivers and
-- clients can message the fleet manager outside of an active trip.
-- A message belongs to either a driver thread (driver_id), a client thread
-- (client_email), or a trip-scoped legacy thread (trip_id) — exactly one.

ALTER TABLE direct_messages
    ALTER COLUMN trip_id DROP NOT NULL;

ALTER TABLE direct_messages
    ADD COLUMN IF NOT EXISTS driver_id    UUID REFERENCES drivers(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS client_email TEXT;

ALTER TABLE direct_messages
    DROP CONSTRAINT IF EXISTS direct_messages_sender_role_check;

ALTER TABLE direct_messages
    ADD CONSTRAINT direct_messages_sender_role_check
    CHECK (sender_role IN ('driver', 'fleet_manager', 'client'));

ALTER TABLE direct_messages
    DROP CONSTRAINT IF EXISTS direct_messages_thread_target_check;

ALTER TABLE direct_messages
    ADD CONSTRAINT direct_messages_thread_target_check
    CHECK (
        (driver_id IS NOT NULL AND client_email IS NULL)
        OR (client_email IS NOT NULL AND driver_id IS NULL)
        OR (trip_id IS NOT NULL AND driver_id IS NULL AND client_email IS NULL)
    );

CREATE INDEX IF NOT EXISTS dm_driver_idx  ON direct_messages (driver_id, created_at);
CREATE INDEX IF NOT EXISTS dm_client_idx  ON direct_messages (client_email, created_at);

-- Per-recipient read state. NULL means unread for the recipient that has
-- not yet opened the thread. We track read state per side of the thread
-- so the unread badge in /manager/messages is accurate.
ALTER TABLE direct_messages
    ADD COLUMN IF NOT EXISTS read_by_manager_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS read_by_recipient_at TIMESTAMPTZ;
