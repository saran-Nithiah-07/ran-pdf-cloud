-- Fixes infinite recursion in the admin RLS policies added in
-- 20250811000000_admin_panel.sql. Those policies checked "is the caller
-- an admin?" by querying profiles from within a policy ON profiles —
-- which re-triggers the same policy, which queries profiles again, and
-- so on, until Postgres detects the loop and errors out (visible as a
-- 500 on any query touching profiles, including a completely unrelated
-- user's own login).
--
-- Fix: move the admin check into a security-definer function. Because it
-- runs with the function owner's privileges, its internal query against
-- profiles bypasses RLS entirely, so it can't recurse into itself.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin());

drop policy if exists "Admins can view all files" on public.files;
create policy "Admins can view all files"
  on public.files for select
  using (public.is_admin());
