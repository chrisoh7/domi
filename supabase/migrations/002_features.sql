-- Domi Feature Migration
-- Run this against your Supabase project via the SQL editor.

-- ── profiles additions ─────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists is_admin boolean not null default false;

-- ── tasks additions ────────────────────────────────────────────────────────
alter table public.tasks
  add column if not exists requires_approval boolean not null default false,
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('approved','flagged','removed')),
  add column if not exists flag_reason text,
  add column if not exists report_count integer not null default 0,
  add column if not exists location_lat numeric,
  add column if not exists location_lng numeric,
  add column if not exists location_stops jsonb,
  add column if not exists location_pickup text,   -- may already exist
  add column if not exists est_minutes integer,
  add column if not exists deadline_at timestamptz,
  -- new in this migration
  add column if not exists delivery_type text check (delivery_type in ('in_person','leave_at_door','pickup_only')),
  add column if not exists cash_offer numeric(8,2),
  add column if not exists marked_done_at timestamptz,
  add column if not exists completion_photo_url text;

-- status enum: add pending_runner_approval if missing
-- (safe: do nothing if check already allows it)
-- Note: if your check constraint is too strict, drop and recreate it:
-- alter table public.tasks drop constraint if exists tasks_status_check;
-- alter table public.tasks add constraint tasks_status_check
--   check (status in ('open','accepted','pending_runner_approval','pending_confirmation','completed','disputed','removed'));

-- ── tasks_with_poster view (recreate to pick up new columns) ────────────────
drop view if exists public.tasks_with_poster;
create view public.tasks_with_poster as
  select
    t.*,
    p.name          as poster_name,
    p.reputation_score as poster_rating,
    p.avatar_url    as poster_avatar_url,
    p.is_admin      as poster_is_admin
  from public.tasks t
  join public.profiles p on t.poster_id = p.id;

-- ── task reports (community flag) ──────────────────────────────────────────
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique(task_id, reporter_id)
);

alter table public.reports enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'reports' and policyname = 'Authenticated users can insert reports') then
    create policy "Authenticated users can insert reports"
      on public.reports for insert with check (auth.uid() = reporter_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'reports' and policyname = 'Admins can view reports') then
    create policy "Admins can view reports"
      on public.reports for select using (auth.role() = 'authenticated');
  end if;
end $$;

-- Trigger: increment report_count on tasks
create or replace function public.increment_report_count()
returns trigger language plpgsql security definer as $$
begin
  update public.tasks set report_count = report_count + 1 where id = new.task_id;
  return new;
end;
$$;

drop trigger if exists on_report_insert on public.reports;
create trigger on_report_insert
  after insert on public.reports
  for each row execute function public.increment_report_count();

-- ── user reports ───────────────────────────────────────────────────────────
create table if not exists public.user_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  reason      text not null,
  task_id     uuid references public.tasks(id) on delete set null,
  reviewed    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique(reporter_id, reported_id, task_id)
);

alter table public.user_reports enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'user_reports' and policyname = 'Authenticated users can insert user_reports') then
    create policy "Authenticated users can insert user_reports"
      on public.user_reports for insert with check (auth.uid() = reporter_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'user_reports' and policyname = 'Admins can view user_reports') then
    create policy "Admins can view user_reports"
      on public.user_reports for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'user_reports' and policyname = 'Admins can update user_reports') then
    create policy "Admins can update user_reports"
      on public.user_reports for update using (auth.role() = 'authenticated');
  end if;
end $$;

-- ── messages (task chat) ───────────────────────────────────────────────────
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'messages' and policyname = 'Authenticated users can view messages') then
    create policy "Authenticated users can view messages"
      on public.messages for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'messages' and policyname = 'Authenticated users can insert messages') then
    create policy "Authenticated users can insert messages"
      on public.messages for insert with check (auth.uid() = sender_id);
  end if;
end $$;

-- Enable realtime for messages
alter publication supabase_realtime add table public.messages;

-- ── gift card redemptions ──────────────────────────────────────────────────
create table if not exists public.gift_card_redemptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  brand          text not null,
  tokens_spent   integer not null,
  cash_value     numeric(8,2) not null,
  delivery_email text not null,
  status         text not null default 'pending'
    check (status in ('pending','fulfilled','cancelled')),
  created_at     timestamptz not null default now()
);

alter table public.gift_card_redemptions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'gift_card_redemptions' and policyname = 'Users can view their own redemptions') then
    create policy "Users can view their own redemptions"
      on public.gift_card_redemptions for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'gift_card_redemptions' and policyname = 'Authenticated users can insert redemptions') then
    create policy "Authenticated users can insert redemptions"
      on public.gift_card_redemptions for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'gift_card_redemptions' and policyname = 'Admins can update redemptions') then
    create policy "Admins can update redemptions"
      on public.gift_card_redemptions for update using (auth.role() = 'authenticated');
  end if;
end $$;

-- ── storage buckets ────────────────────────────────────────────────────────
-- Run in Supabase dashboard → Storage, or via the JS client on first deploy:
--   supabase.storage.createBucket('avatars', { public: true })
--   supabase.storage.createBucket('completion_photos', { public: true })
--
-- Storage RLS (add via dashboard → Storage → Policies):
--   avatars: allow authenticated INSERT/UPDATE for own files (path starts with uid)
--   completion_photos: allow authenticated INSERT; allow public SELECT
