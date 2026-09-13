alter table listings add column if not exists window_start timestamptz;
alter table listings add column if not exists window_end timestamptz;
