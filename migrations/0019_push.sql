CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  peer_id TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subs_peer ON push_subs (peer_id);

ALTER TABLE listings ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;
