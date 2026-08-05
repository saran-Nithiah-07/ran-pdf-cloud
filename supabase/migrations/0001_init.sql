-- ============================================================
-- profiles: one row per auth.users row, holds name + username
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text not null unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================================
-- Username helpers, exposed to anon so login/signup can use
-- them before a session exists. Both are security definer so
-- they can read auth.users / profiles without opening those
-- tables up directly.
-- ============================================================
create or replace function public.get_email_by_username(lookup_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.username = lookup_username
  limit 1;
$$;

revoke all on function public.get_email_by_username(text) from public;
grant execute on function public.get_email_by_username(text) to anon, authenticated;

create or replace function public.is_username_available(check_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where username = check_username
  );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- ============================================================
-- files: metadata for each uploaded PDF. Actual bytes live in
-- the "user-files" storage bucket at files.storage_path.
-- ============================================================
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  size_bytes bigint not null default 0,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists files_user_id_idx on public.files(user_id);
create index if not exists files_uploaded_at_idx on public.files(uploaded_at);

alter table public.files enable row level security;

create policy "Users can view own files"
  on public.files for select using (auth.uid() = user_id);

create policy "Users can insert own files"
  on public.files for insert with check (auth.uid() = user_id);

create policy "Users can update own files"
  on public.files for update using (auth.uid() = user_id);

create policy "Users can delete own files"
  on public.files for delete using (auth.uid() = user_id);

-- ============================================================
-- Storage bucket + policies. Files are stored under
-- user-files/{user_id}/{file_id}-{name}.pdf so folder-scoped
-- RLS maps directly onto ownership.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('user-files', 'user-files', false)
on conflict (id) do nothing;

create policy "Users can read own storage objects"
  on storage.objects for select
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload own storage objects"
  on storage.objects for insert
  with check (bucket_id = 'user-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update own storage objects"
  on storage.objects for update
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own storage objects"
  on storage.objects for delete
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = auth.uid()::text);
