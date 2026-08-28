-- Adds provider tracking to conversion_logs so the admin panel can report
-- credit usage per Adobe account separately from the local-converter
-- fallback, broken down by month and conversion type.
--
-- Background: all 5 conversions now try Adobe first (across two Adobe
-- accounts, alternated for an even credit split), only falling back to
-- the local LibreOffice/PyMuPDF converter if both Adobe accounts fail or
-- are exhausted. The converter service now passes which engine actually
-- served each conversion ('adobe-1' / 'adobe-2' / 'local') alongside the
-- conversion type it already sent.

alter table public.conversion_logs
  add column if not exists provider text
    check (provider in ('adobe-1', 'adobe-2', 'local'))
    not null default 'local';

-- Existing rows predate provider tracking and were, in fact, all served
-- either by the single original Adobe account or locally depending on
-- conversion_type — we can't reconstruct that retroactively with
-- certainty, so they're left at the 'local' default rather than guessed.
-- This only affects historical rows logged before this migration.

create index if not exists conversion_logs_provider_created_at_idx
  on public.conversion_logs (provider, created_at);

-- log_conversion() now accepts a provider too. The old single-argument
-- version is kept alongside (Postgres allows function overloading by
-- argument count) so an in-flight deploy of the converter service that
-- hasn't picked up the new code yet doesn't start failing calls.
create or replace function public.log_conversion(p_conversion_type text, p_provider text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.conversion_logs (conversion_type, provider)
  values (p_conversion_type, coalesce(p_provider, 'local'));
end;
$$;

revoke all on function public.log_conversion(text, text) from public;
grant execute on function public.log_conversion(text, text) to anon, authenticated;

-- Monthly credit-usage summary for the admin panel's "View credit details"
-- modal: one row per (month, provider) with total count, so the top-level
-- table can show Month | Adobe 1 | Adobe 2 | Custom converter directly.
create or replace function public.get_conversion_stats_by_month()
returns table (
  month date,
  provider text,
  total bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  return query
    select
      date_trunc('month', cl.created_at)::date as month,
      cl.provider,
      count(*)::bigint as total
    from public.conversion_logs cl
    group by 1, 2
    order by 1 desc;
end;
$$;

revoke all on function public.get_conversion_stats_by_month() from public;
grant execute on function public.get_conversion_stats_by_month() to authenticated;

-- Per-conversion-type breakdown for the accordion under each provider's
-- cell — one row per (month, provider, conversion_type).
create or replace function public.get_conversion_stats_by_month_detailed()
returns table (
  month date,
  provider text,
  conversion_type text,
  total bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  return query
    select
      date_trunc('month', cl.created_at)::date as month,
      cl.provider,
      cl.conversion_type,
      count(*)::bigint as total
    from public.conversion_logs cl
    group by 1, 2, 3
    order by 1 desc;
end;
$$;

revoke all on function public.get_conversion_stats_by_month_detailed() from public;
grant execute on function public.get_conversion_stats_by_month_detailed() to authenticated;
