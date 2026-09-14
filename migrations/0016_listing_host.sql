alter table listings add column if not exists host_peer_id text;
alter table listings add column if not exists host_name text;
alter table listings add column if not exists host_color text;
alter table listings add column if not exists host_photo text;

update listings
set
  host_peer_id = coalesce(host_peer_id, peer_id),
  host_name = coalesce(host_name, name),
  host_color = coalesce(host_color, color),
  host_photo = coalesce(host_photo, photo)
where host_peer_id is null;
