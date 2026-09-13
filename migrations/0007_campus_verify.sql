create table if not exists campus_codes (
  email text primary key,
  peer_id text not null,
  code_hash text not null,
  school text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists campus_members (
  peer_id text primary key,
  email text not null unique,
  school text not null,
  verified_at timestamptz not null default now()
);

create index if not exists campus_members_school_idx on campus_members (school);
