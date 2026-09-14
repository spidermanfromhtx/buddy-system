alter table accounts add column if not exists plan text not null default 'free';
alter table accounts add column if not exists sessions_used integer not null default 0;
alter table accounts add column if not exists stripe_customer_id text;
alter table accounts add column if not exists stripe_subscription_id text;
