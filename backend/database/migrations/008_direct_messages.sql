-- Migration 008: Direct messages between drivers and managers
-- Separate from the client-driver relay (trip: room).
-- Only drivers and managers can send/receive. Trip lifecycle gates access.

CREATE TABLE IF NOT EXISTS direct_messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id     UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    sender_role TEXT        NOT NULL CHECK (sender_role IN ('driver', 'fleet_manager')),
    body        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dm_trip_created_idx ON direct_messages(trip_id, created_at);
