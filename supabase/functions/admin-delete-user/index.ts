// supabase/functions/admin-delete-user/index.ts
//
// Deletes a user completely: their Storage files, their files DB rows,
// their profile, and their auth account. Only allowed when the target
// user's status is 'inactive' — enforced here server-side, not just as a
// disabled button in the UI, since the UI check alone could be bypassed
// by calling this function directly.
//
// Deploy with:  supabase functions deploy admin-delete-user
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey"
};

const BUCKET = "user-files";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const {
      data: { user: caller }
    } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Not signed in." }), {
        status: 401,
        headers: corsHeaders
      });
    }

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();
    if (callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admins only." }), {
        status: 403,
        headers: corsHeaders
      });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required." }), {
        status: 400,
        headers: corsHeaders
      });
    }
    if (userId === caller.id) {
      return new Response(
        JSON.stringify({ error: "You can't delete your own admin account." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: target, error: targetErr } = await admin
      .from("profiles")
      .select("status")
      .eq("id", userId)
      .single();
    if (targetErr || !target) {
      return new Response(JSON.stringify({ error: "User not found." }), {
        status: 404,
        headers: corsHeaders
      });
    }
    if (target.status !== "inactive") {
      return new Response(
        JSON.stringify({ error: "Deactivate this user before deleting them." }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Delete the actual auth account FIRST. If this fails, stop here —
    // nothing else has been touched yet, so it's safe to just retry.
    // Doing this step last (as an earlier version of this function did)
    // could leave a "zombie" auth account behind if it failed after the
    // profile/files were already gone, with no easy way to notice.
    const { error: deleteAuthErr } = await admin.auth.admin.deleteUser(userId);
    if (deleteAuthErr) {
      return new Response(JSON.stringify({ error: deleteAuthErr.message }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // 1. Storage: remove every file under this user's folder.
    const { data: files } = await admin
      .from("files")
      .select("storage_path")
      .eq("user_id", userId);
    if (files && files.length > 0) {
      const paths = files.map((f) => f.storage_path);
      const { error: storageErr } = await admin.storage.from(BUCKET).remove(paths);
      if (storageErr) {
        // Log and continue — the auth account is already gone at this
        // point, so there's no user left to retry the whole operation
        // for. A leftover Storage object is recoverable manually.
        console.error("Storage cleanup error:", storageErr.message);
      }
    }

    // 2. DB rows for those files.
    await admin.from("files").delete().eq("user_id", userId);

    // 3. Profile row.
    await admin.from("profiles").delete().eq("id", userId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
