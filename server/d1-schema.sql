-- Cloudflare D1 初始化：
-- wrangler d1 execute reflex-lab --file=d1-schema.sql --remote
create table if not exists scores (
  id           integer primary key autoincrement,
  name         text    not null,
  avatar       text    not null,
  average      real    not null,
  best         integer not null,
  worst        integer not null,
  early_starts integer not null default 0,
  trials       integer not null default 10,
  month_key    text    not null,
  refresh_hz   integer,
  device_id    text,
  raw          text,
  created_at   text    not null default (datetime('now'))
);
create index if not exists idx_scores_average on scores (average);
create index if not exists idx_scores_month   on scores (month_key, average);
create index if not exists idx_scores_name    on scores (lower(name));
create index if not exists idx_scores_device  on scores (device_id, created_at);
