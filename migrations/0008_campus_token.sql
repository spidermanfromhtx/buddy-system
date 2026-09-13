alter table campus_members add column if not exists token text;
create index if not exists campus_members_token_idx on campus_members (peer_id, token);
