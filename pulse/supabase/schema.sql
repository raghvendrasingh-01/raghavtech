-- ============================================================================
-- Pulse — PostgreSQL schema (Supabase)
-- ============================================================================
-- All tables are prefixed `pulse_` so they can live safely alongside other
-- projects in the same Supabase database. Row-Level Security is enabled and
-- scoped to the owning user (Clerk user id stored as text in `user_id`).
--
-- Apply with: psql "$SUPABASE_DB_URL" -f schema.sql
--        or:  Supabase SQL editor / MCP apply_migration.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type pulse_priority   as enum ('critical','high','medium','low');
  create type pulse_status     as enum ('todo','in_progress','done','missed');
  create type pulse_difficulty as enum ('easy','medium','hard');
  create type pulse_category   as enum ('study','work','personal','health','interview','project','finance','other');
  create type pulse_habit_cadence as enum ('daily','weekdays','weekly');
  create type pulse_event_kind as enum ('meeting','class','event','personal');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Users  (mirrors the Clerk user; app data hangs off user_id)
-- ---------------------------------------------------------------------------
create table if not exists pulse_users (
  id          uuid primary key default gen_random_uuid(),
  clerk_id    text unique not null,
  email       text,
  full_name   text,
  avatar_url  text,
  -- preferences
  day_start_hour int  not null default 8,
  day_end_hour   int  not null default 22,
  planning_style text not null default 'balanced',   -- relaxed | balanced | aggressive
  timezone       text not null default 'UTC',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tasks + Subtasks
-- ---------------------------------------------------------------------------
create table if not exists pulse_tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  title         text not null,
  description   text,
  category      pulse_category   not null default 'other',
  difficulty    pulse_difficulty not null default 'medium',
  estimate_min  int  not null default 60,
  deadline      timestamptz not null,
  status        pulse_status not null default 'todo',
  progress      real not null default 0,            -- 0..1
  importance    int,                                 -- optional 1..5
  preferred_window text,                             -- morning | afternoon | evening
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_pulse_tasks_user     on pulse_tasks(user_id);
create index if not exists idx_pulse_tasks_deadline on pulse_tasks(user_id, deadline);

create table if not exists pulse_subtasks (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references pulse_tasks(id) on delete cascade,
  title        text not null,
  done         boolean not null default false,
  estimate_min int not null default 30,
  position     int not null default 0
);
create index if not exists idx_pulse_subtasks_task on pulse_subtasks(task_id);

-- ---------------------------------------------------------------------------
-- Calendar events (synced from Google Calendar or created in-app)
-- ---------------------------------------------------------------------------
create table if not exists pulse_calendar_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  title       text not null,
  kind        pulse_event_kind not null default 'event',
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  location    text,
  external_id text,                                  -- google event id
  created_at  timestamptz not null default now()
);
create index if not exists idx_pulse_events_user on pulse_calendar_events(user_id, starts_at);

-- ---------------------------------------------------------------------------
-- Schedules  (AI-generated day plans: a set of blocks)
-- ---------------------------------------------------------------------------
create table if not exists pulse_schedule_blocks (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  task_id    uuid references pulse_tasks(id) on delete set null,
  title      text not null,
  kind       text not null,                          -- focus | event | break | buffer
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  rescue     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_pulse_blocks_user on pulse_schedule_blocks(user_id, starts_at);

-- ---------------------------------------------------------------------------
-- Habits
-- ---------------------------------------------------------------------------
create table if not exists pulse_habits (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  name           text not null,
  icon           text not null default 'Flame',
  cadence        pulse_habit_cadence not null default 'daily',
  color          text not null default 'brand',
  target_per_week int not null default 7,
  created_at     timestamptz not null default now()
);
create index if not exists idx_pulse_habits_user on pulse_habits(user_id);

create table if not exists pulse_habit_logs (
  id        uuid primary key default gen_random_uuid(),
  habit_id  uuid not null references pulse_habits(id) on delete cascade,
  day       date not null,
  unique (habit_id, day)
);

-- ---------------------------------------------------------------------------
-- Goals + Milestones
-- ---------------------------------------------------------------------------
create table if not exists pulse_goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  title       text not null,
  description text,
  category    pulse_category not null default 'project',
  target_date timestamptz,
  progress    real not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_pulse_goals_user on pulse_goals(user_id);

create table if not exists pulse_goal_milestones (
  id        uuid primary key default gen_random_uuid(),
  goal_id   uuid not null references pulse_goals(id) on delete cascade,
  title     text not null,
  done      boolean not null default false,
  eta_weeks int not null default 2,
  position  int not null default 0
);

-- ---------------------------------------------------------------------------
-- Notifications / smart reminders
-- ---------------------------------------------------------------------------
create table if not exists pulse_notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  kind       text not null,                          -- reminder | risk | briefing | review
  title      text not null,
  body       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_pulse_notifs_user on pulse_notifications(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- AI suggestions feed
-- ---------------------------------------------------------------------------
create table if not exists pulse_ai_suggestions (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  kind       text not null,                          -- reschedule | focus | break | risk | insight | burnout
  title      text not null,
  body       text,
  cta        text,
  created_at timestamptz not null default now()
);
create index if not exists idx_pulse_suggestions_user on pulse_ai_suggestions(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Chat history
-- ---------------------------------------------------------------------------
create table if not exists pulse_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  role       text not null,                          -- user | assistant
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_pulse_chat_user on pulse_chat_messages(user_id, created_at);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
-- The API uses the service-role key (bypasses RLS) and scopes every query by
-- user_id. If you expose these tables to the anon key + Clerk JWT instead,
-- enable RLS and add policies like the example below.
alter table pulse_tasks             enable row level security;
alter table pulse_calendar_events   enable row level security;
alter table pulse_habits            enable row level security;
alter table pulse_goals             enable row level security;
alter table pulse_notifications     enable row level security;
alter table pulse_ai_suggestions    enable row level security;
alter table pulse_chat_messages     enable row level security;

do $$ begin
  create policy pulse_tasks_owner on pulse_tasks
    using (user_id = coalesce(auth.jwt() ->> 'sub', user_id))
    with check (user_id = coalesce(auth.jwt() ->> 'sub', user_id));
exception when duplicate_object then null; end $$;

-- updated_at trigger for tasks
create or replace function pulse_touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists trg_pulse_tasks_touch on pulse_tasks;
create trigger trg_pulse_tasks_touch before update on pulse_tasks
  for each row execute function pulse_touch_updated_at();
