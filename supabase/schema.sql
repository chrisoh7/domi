-- Domi Supabase Schema

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  year text,
  major text,
  token_balance integer not null default 10,
  reputation_score numeric(3,2),
  strikes integer not null default 0,
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Public profiles are viewable by authenticated users"
  on public.profiles for select using (auth.role() = 'authenticated');
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references public.profiles(id),
  runner_id uuid references public.profiles(id),
  title text not null,
  description text,
  category text not null,
  location_pickup text,
  location_dropoff text,
  deadline date,
  token_offer integer not null,
  boosted boolean not null default false,
  photo_url text,
  status text not null default 'open'
    check (status in ('open','accepted','pending_confirmation','completed','disputed','removed')),
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
create policy "Authenticated users can view open tasks"
  on public.tasks for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert tasks"
  on public.tasks for insert with check (auth.uid() = poster_id);
create policy "Authenticated users can update tasks"
  on public.tasks for update using (auth.role() = 'authenticated');

-- View: tasks with poster info (for feed)
create or replace view public.tasks_with_poster as
  select
    t.*,
    p.name as poster_name,
    p.reputation_score as poster_rating
  from public.tasks t
  join public.profiles p on t.poster_id = p.id;

-- Token ledger
create table public.token_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  amount integer not null,
  reason text,
  task_id uuid references public.tasks(id),
  created_at timestamptz not null default now()
);

alter table public.token_ledger enable row level security;
create policy "Users can view their own ledger"
  on public.token_ledger for select using (auth.uid() = user_id);
create policy "Authenticated users can insert ledger entries"
  on public.token_ledger for insert with check (auth.role() = 'authenticated');

-- Ratings
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id),
  rater_id uuid not null references public.profiles(id),
  ratee_id uuid not null references public.profiles(id),
  stars integer not null check (stars between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  unique(task_id, rater_id)
);

alter table public.ratings enable row level security;
create policy "Authenticated users can view ratings"
  on public.ratings for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert ratings"
  on public.ratings for insert with check (auth.uid() = rater_id);

-- Seed demo data (optional — run manually)
-- insert into public.profiles (id, email, name, year, major, token_balance)
-- values
--   ('00000000-0000-0000-0000-000000000001', 'alex@andrew.cmu.edu', 'Alex Chen', 'Junior', 'CS', 50),
--   ('00000000-0000-0000-0000-000000000002', 'jamie@andrew.cmu.edu', 'Jamie Park', 'Sophomore', 'ECE', 30);
