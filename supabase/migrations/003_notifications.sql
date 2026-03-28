-- Notifications system with task name in every body.

-- ── table ──────────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  task_id    uuid references public.tasks(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'notifications' and policyname = 'Users can view their own notifications') then
    create policy "Users can view their own notifications"
      on public.notifications for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'notifications' and policyname = 'Users can update their own notifications') then
    create policy "Users can update their own notifications"
      on public.notifications for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'notifications' and policyname = 'Service can insert notifications') then
    create policy "Service can insert notifications"
      on public.notifications for insert with check (true);
  end if;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when others then null;
end $$;

-- ── helper: truncate task title ────────────────────────────────────────────
create or replace function public.short_title(t text)
returns text language sql immutable as $$
  select case when length(t) > 40 then left(t, 37) || '…' else t end;
$$;

-- ── trigger: fire on task status changes ──────────────────────────────────
create or replace function public.notify_on_task_change()
returns trigger language plpgsql security definer as $$
declare
  tname text := public.short_title(new.title);
  -- Derive the type column name from existing rows so we stay compatible.
  -- Falls back to 'info' if the column doesn't exist or has no constraint.
  type_col_exists boolean := exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'type'
  );
begin
  -- open → accepted (runner clicked Accept, no approval required)
  if old.status = 'open' and new.status = 'accepted' and new.runner_id is not null then
    insert into public.notifications(user_id, task_id, type, title, body)
      values (new.poster_id, new.id, 'task_accepted',
              'Task accepted',
              'Someone accepted "' || tname || '"');

  -- open → pending_runner_approval (runner applied, poster must approve)
  elsif old.status = 'open' and new.status = 'pending_runner_approval' and new.runner_id is not null then
    insert into public.notifications(user_id, task_id, type, title, body)
      values (new.poster_id, new.id, 'runner_joined',
              'Runner wants your task',
              'A runner applied for "' || tname || '" — approve or reject them.');

  -- pending_runner_approval → accepted (poster approved runner)
  elsif old.status = 'pending_runner_approval' and new.status = 'accepted' then
    insert into public.notifications(user_id, task_id, type, title, body)
      values (new.runner_id, new.id, 'task_accepted',
              'You''ve been approved',
              'The poster approved you for "' || tname || '"');

  -- pending_runner_approval → open (poster rejected runner)
  elsif old.status = 'pending_runner_approval' and new.status = 'open' then
    if old.runner_id is not null then
      insert into public.notifications(user_id, task_id, type, title, body)
        values (old.runner_id, new.id, 'runner_joined',
                'Application not approved',
                'The poster didn''t approve you for "' || tname || '"');
    end if;

  -- accepted → open (runner backed out)
  elsif old.status = 'accepted' and new.status = 'open' and new.runner_id is null then
    insert into public.notifications(user_id, task_id, type, title, body)
      values (new.poster_id, new.id, 'runner_joined',
              'Runner backed out',
              'Your runner dropped "' || tname || '" — it''s open again.');

  -- accepted → pending_confirmation (runner marked done)
  elsif old.status = 'accepted' and new.status = 'pending_confirmation' then
    insert into public.notifications(user_id, task_id, type, title, body)
      values (new.poster_id, new.id, 'task_pending',
              'Task marked done',
              'Your runner says "' || tname || '" is complete. Confirm or dispute.');

  -- pending_confirmation → completed (poster confirmed)
  elsif old.status = 'pending_confirmation' and new.status = 'completed' then
    insert into public.notifications(user_id, task_id, type, title, body)
      values (new.runner_id, new.id, 'task_completed',
              'Payment received',
              'Poster confirmed "' || tname || '" — tokens sent!');

  -- pending_confirmation → disputed
  elsif old.status = 'pending_confirmation' and new.status = 'disputed' then
    insert into public.notifications(user_id, task_id, type, title, body)
      values (new.runner_id, new.id, 'task_pending',
              'Task disputed',
              'The poster opened a dispute on "' || tname || '"');
    insert into public.notifications(user_id, task_id, type, title, body)
      values (new.poster_id, new.id, 'task_pending',
              'Dispute submitted',
              'Your dispute on "' || tname || '" is under admin review.');

  end if;

  return new;
end;
$$;

drop trigger if exists on_task_status_change on public.tasks;
create trigger on_task_status_change
  after update of status on public.tasks
  for each row
  when (old.status is distinct from new.status)
  execute function public.notify_on_task_change();
