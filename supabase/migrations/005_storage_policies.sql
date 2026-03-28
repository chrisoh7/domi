-- Allow authenticated users to upload to all path prefixes in the avatars bucket.
-- The original policy only covered paths starting with the user's UID (profile photos).
-- This adds policies for: tasks/, completion/, chat/ prefixes.

insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

-- Drop the restrictive per-uid policy if it exists, replace with a single open policy
-- for authenticated users (this is an internal campus app — all uploads are user-initiated).
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Avatar images are publicly accessible'
  ) then
    drop policy "Avatar images are publicly accessible" on storage.objects;
  end if;
end $$;

do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Users can upload their own avatar'
  ) then
    drop policy "Users can upload their own avatar" on storage.objects;
  end if;
end $$;

do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Users can update their own avatar'
  ) then
    drop policy "Users can update their own avatar" on storage.objects;
  end if;
end $$;

-- Public read on avatars bucket
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars bucket public read'
  ) then
    create policy "avatars bucket public read"
      on storage.objects for select
      using (bucket_id = 'avatars');
  end if;
end $$;

-- Authenticated users can upload anywhere in avatars bucket
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars bucket authenticated upload'
  ) then
    create policy "avatars bucket authenticated upload"
      on storage.objects for insert
      with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
  end if;
end $$;

-- Authenticated users can update/replace files in avatars bucket
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars bucket authenticated update'
  ) then
    create policy "avatars bucket authenticated update"
      on storage.objects for update
      using (bucket_id = 'avatars' and auth.role() = 'authenticated');
  end if;
end $$;
