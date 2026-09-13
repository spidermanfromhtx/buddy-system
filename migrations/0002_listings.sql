create table if not exists listings (
  id text primary key,
  peer_id text not null,
  name text not null,
  color text not null,
  task text not null,
  urgent boolean not null default false,
  mode text not null,
  length_min integer not null default 25,
  camera boolean not null default false,
  similar_pref text not null default 'either',
  window_label text,
  due_date text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists listings_mode_expires_idx
  on listings (mode, expires_at);

create table if not exists call_sessions (
  id text primary key,
  room text not null,
  caller_id text not null,
  callee_id text not null,
  caller_name text not null,
  callee_name text not null,
  caller_color text not null default '#C45C3E',
  callee_color text not null default '#2F6F5E',
  task text not null,
  length_min integer not null default 25,
  status text not null default 'ringing',
  created_at timestamptz not null default now()
);

create index if not exists call_sessions_callee_idx
  on call_sessions (callee_id, status);
