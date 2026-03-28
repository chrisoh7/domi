-- Rollback for 002_features.sql

-- ── gift card redemptions ──────────────────────────────────────────────────
drop table if exists public.gift_card_redemptions;

-- ── messages ──────────────────────────────────────────────────────────────
alter publication supabase_realtime drop table if exists public.messages;
drop table if exists public.messages;

-- ── user reports ───────────────────────────────────────────────────────────
drop table if exists public.user_reports;

-- ── task reports ───────────────────────────────────────────────────────────
drop trigger if exists on_report_insert on public.reports;
drop function if exists public.increment_report_count();
drop table if exists public.reports;

-- ── tasks_with_poster view (restore to original) ──────────────────────────
drop view if exists public.tasks_with_poster;
create view public.tasks_with_poster as
  select
    t.*,
    p.name             as poster_name,
    p.reputation_score as poster_rating
  from public.tasks t
  join public.profiles p on t.poster_id = p.id;

-- ── tasks column removals ──────────────────────────────────────────────────
alter table public.tasks
  drop column if exists completion_photo_url,
  drop column if exists marked_done_at,
  drop column if exists cash_offer,
  drop column if exists delivery_type,
  drop column if exists deadline_at,
  drop column if exists est_minutes,
  drop column if exists location_stops,
  drop column if exists location_lng,
  drop column if exists location_lat,
  drop column if exists report_count,
  drop column if exists flag_reason,
  drop column if exists moderation_status,
  drop column if exists requires_approval;

-- ── profiles column removals ───────────────────────────────────────────────
alter table public.profiles
  drop column if exists is_admin,
  drop column if exists avatar_url;
