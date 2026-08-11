-- Admin panel support: role/status/mobile on profiles, plus RLS so an
-- admin can see (and update status on) every profile, not just their own.
alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin')),
  add column if not exists status text not null default 'active'
  check (status in ('active', 'inactive')),
  add column if not exists mobile_number text,
  add column if not exists email text;

-- Admin-only read of every profile (the existing "Users can view own
-- profile" policy still covers everyone reading their own row; Postgres
-- RLS OR's all matching permissive policies together, so this only ever
-- adds visibility, never removes it).
create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admin-only update of any profile — used for activating/deactivating
-- users from the admin panel. Deleting a user (and their files/auth
-- account) goes through the admin-delete-user Edge Function instead,
-- since that needs the service-role key regardless.
create policy "Admins can update any profile"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Same admin-visibility pattern for files, so the admin panel could show
-- per-user file counts if useful later; not required for the current
-- admin screens but harmless and consistent with the profiles policy.
create policy "Admins can view all files"
  on public.files for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
