alter table listings add column if not exists school text;
alter table listings add column if not exists match_id text;
alter table listings add column if not exists match_peer_id text;
alter table listings add column if not exists match_peer_name text;
alter table listings add column if not exists match_room text;
alter table listings add column if not exists match_call_id text;

alter table call_sessions add column if not exists both_ring boolean not null default false;
