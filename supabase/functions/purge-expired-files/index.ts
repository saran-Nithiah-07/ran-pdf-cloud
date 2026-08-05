// supabase/functions/purge-expired-files/index.ts
//
// Deletes files whose uploaded_at is older than 90 days: removes the
// Storage object first, then the database row. Invoked on a daily
// schedule via a pg_cron job (Dashboard → Integrations → Cron), already
// set up as "purge-expired-files-daily" running at 03:00 GMT.
//
// Uses the service_role key, which is why this runs server-side as an
// Edge Function instead of client code: it must bypass RLS to sweep
// every user's expired files, not just one signed-in user's own rows.
//
// Deploy with:  supabase functions deploy purge-expired-files
// Set the service role key as a function secret (never commit it):
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Must match the bucket created in supabase/migrations/0001_init.sql.
const BUCKET = "user-files";

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: expired, error: selectErr } = await supabase
    .from("files")
    .select("id, storage_path")
    .lt("uploaded_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

  if (selectErr) {
    return new Response(JSON.stringify({ error: selectErr.message }), { status: 500 });
  }
  if (!expired || expired.length === 0) {
    return new Response(JSON.stringify({ deleted: 0 }), { status: 200 });
  }

  const paths = expired.map((f) => f.storage_path);
  const { error: storageErr } = await supabase.storage.from(BUCKET).remove(paths);
  if (storageErr) {
    // Log and continue — an orphaned Storage object is recoverable manually;
    // leaving stale DB rows around because Storage hiccuped is worse.
    console.error("Storage cleanup error:", storageErr.message);
  }

  const ids = expired.map((f) => f.id);
  const { error: deleteErr } = await supabase.from("files").delete().in("id", ids);
  if (deleteErr) {
    return new Response(JSON.stringify({ error: deleteErr.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ deleted: ids.length, bucket: BUCKET }), { status: 200 });
});
