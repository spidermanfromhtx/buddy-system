create table if not exists app_reviews (
  id text primary key,
  reviewer_id text not null unique,
  rating integer not null,
  body text not null default '',
  created_at timestamptz not null default now()
);
