-- Admin panel now searches users by name/email server-side (ilike) instead
-- of fetching everyone and filtering in the browser. These trigram indexes
-- keep that search fast as the user list grows.
create extension if not exists pg_trgm;

create index if not exists profiles_full_name_trgm_idx
  on public.profiles using gin (full_name gin_trgm_ops);

create index if not exists profiles_email_trgm_idx
  on public.profiles using gin (email gin_trgm_ops);
