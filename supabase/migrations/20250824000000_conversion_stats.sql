-- Tracks how many documents have been converted, broken down by
-- conversion type, so the admin panel can show usage counts.
--
-- The converter service (a separate Node/Python service, not this app's
-- own backend) calls log_conversion() with only the anon key after each
-- successful conversion — it never touches the table directly, and the
-- function only accepts a conversion_type, nothing else, so there's
-- nothing meaningful to abuse even from an unauthenticated caller.
--
-- Reading the counts back is admin-only, enforced inside
-- get_conversion_counts() itself via the existing is_admin() helper —
-- not via a table RLS policy, since there is no direct table access at
-- all here on purpose.

create table if not exists public.conversion_logs (
  id uuid primary key default gen_random_uuid(),
  conversion_type text not null check (
    conversion_type in (
      'word-to-pdf',
      'pptx-to-pdf',
      'excel-to-pdf',
      'pdf-to-word',
      'pdf-to-pptx'
    )
  ),
  created_at timestamptz not null default now()
);

-- RLS is enabled with no policies attached — this deliberately blocks all
-- direct table access (select/insert/update/delete) for every role. The
-- two functions below are the only way in or out, each security definer
-- so they can do their one narrow job regardless of the caller's own
-- table-level permissions.
alter table public.conversion_logs enable row level security;

create or replace function public.log_conversion(p_conversion_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.conversion_logs (conversion_type)
  values (p_conversion_type);
end;
$$;

revoke all on function public.log_conversion(text) from public;
grant execute on function public.log_conversion(text) to anon, authenticated;

create or replace function public.get_conversion_counts()
returns table (conversion_type text, total bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  return query
    select cl.conversion_type, count(*)::bigint as total
    from public.conversion_logs cl
    group by cl.conversion_type;
end;
$$;

revoke all on function public.get_conversion_counts() from public;
grant execute on function public.get_conversion_counts() to authenticated;
