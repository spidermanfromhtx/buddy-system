alter table accounts add column if not exists categories text not null default '';
alter table listings add column if not exists category text;
