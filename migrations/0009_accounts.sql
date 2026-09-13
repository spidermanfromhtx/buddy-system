create table if not exists account_codes (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists account_pending (
  email text primary key,
  session_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists accounts (
  id text primary key,
  email text not null unique,
  session_token text not null unique,
  name text not null,
  birthdate text not null,
  color text not null,
  photo text,
  break_every_min integer not null default 30,
  created_at timestamptz not null default now()
);
