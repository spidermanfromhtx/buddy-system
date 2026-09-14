CREATE TABLE IF NOT EXISTS app_meta (
  key text PRIMARY KEY,
  value text NOT NULL
);

INSERT INTO app_meta (key, value) VALUES ('rnd_limits', 'off')
  ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS admins (
  email text PRIMARY KEY,
  invited_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
