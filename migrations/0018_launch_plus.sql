alter table accounts add column if not exists plus_grant_until timestamptz;

create table if not exists launch_plus_slots (
  slot integer primary key,
  account_id text unique references accounts(id)
);

insert into launch_plus_slots (slot)
select generate_series(1, 100)
on conflict (slot) do nothing;
