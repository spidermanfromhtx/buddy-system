alter table listings add column if not exists photo text;
alter table call_sessions add column if not exists caller_photo text;
alter table call_sessions add column if not exists callee_photo text;
