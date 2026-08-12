// supabase/functions/admin-invite-user/index.ts
//
// Called from the admin panel to invite a new user by name/email/mobile.
// Two things only the service-role key can do, which is why this has to
// be an Edge Function rather than a client-side call:
//   1. Create the auth user + send the invite email
//      (supabase.auth.admin.inviteUserByEmail)
//   2. Bypass RLS to insert the new profiles row
//
// The caller's own identity is verified with their JWT (from the
// Authorization header) against a normal, RLS-scoped client first —
// only a real admin can invoke this successfully.
//
// Deploy with:  supabase functions deploy admin-invite-user
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey"
};

function usernameFromEmail(email: string) {
  const prefix = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix || "user"}${suffix}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Caller-scoped client (their own JWT, normal RLS) — just to confirm
    // who's calling and that they're really an admin.
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

    const { name, email, mobile, origin } = await req.json();
    if (!name || !email) {
      return new Response(JSON.stringify({ error: "Name and email are required." }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Service-role client for the actual privileged work.
    const admin = createClient(supabaseUrl, serviceKey);

    const username = usernameFromEmail(email);
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name: name, mobile_number: mobile || null, username },
        // Sent by the client as window.location.origin so this lands on
        // the right domain whether it's localhost during dev or the real
        // deployed site — Supabase falls back to its configured Site URL
        // if this is omitted, which would send people to "/" instead of
        // straight into the set-password flow.
        redirectTo: origin ? `${origin}/accept-invite` : undefined
      }
    );
    if (inviteErr) {
      return new Response(JSON.stringify({ error: inviteErr.message }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const { error: profileErr } = await admin.from("profiles").insert({
      id: invited.user.id,
      full_name: name,
      username,
      mobile_number: mobile || null,
      email,
      role: "user",
      status: "active"
    });
    if (profileErr) {
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 400,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ success: true, username }), {
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