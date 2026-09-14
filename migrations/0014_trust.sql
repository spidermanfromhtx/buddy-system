alter table accounts add column if not exists banned boolean not null default false;
alter table accounts add column if not exists warn_count integer not null default 0;
alter table accounts add column if not exists tos_accepted_at timestamptz;

create table if not exists reviews (
  id text primary key,
  call_id text,
  reviewer_id text not null,
  subject_id text not null,
  rating integer not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists reviews_one_per_call on reviews (reviewer_id, call_id) where call_id is not null;

create table if not exists reports (
  id text primary key,
  reporter_id text not null,
  subject_id text not null,
  call_id text,
  body text not null,
  severity text not null,
  action text not null,
  created_at timestamptz not null default now()
);
