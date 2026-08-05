# RAN PDF Editor Pro — Cloud

React account/dashboard shell + the original vanilla-JS `RAN-PDF-Editor-Pro.html`
editor, backed by Supabase (Auth, Postgres, Storage). This pass builds:

1. **Sign up / Log in / Forgot password** (username + password login, email OTP reset)
2. **Dashboard** — upload PDFs, view your file library, open a file into the editor

The editor itself (`public/editor/pdf-editor.html`) is untouched except for two
`<script>` tags added to `<head>` that load Supabase and a small bridge file —
see "How the editor talks to Supabase" below.

---

## 1. Supabase setup

You already have the project (`uufksdiokauatykyrepr`). Two things to run from
here:

### a) Run the migration

Using the Supabase CLI from this folder:

```bash
npx supabase login
npx supabase link --project-ref uufksdiokauatykyrepr
npx supabase db push
```

This creates:
- `profiles` (name, username, linked to `auth.users`)
- `files` (metadata for every uploaded PDF)
- `get_email_by_username` / `is_username_available` — security-definer functions so login/signup can check usernames without exposing the whole `profiles` table
- The `user-files` Storage bucket, plus RLS policies scoping every row/object to its owner

### b) Switch the password-reset email to a code, not a link

By default Supabase's "Reset Password" email contains a magic link
(`{{ .ConfirmationURL }}`). Our flow expects a 6-digit code instead, so:

1. Supabase Dashboard → **Authentication → Email Templates → Reset Password**
2. Replace the button/link with `{{ .Token }}` somewhere visible in the body, e.g.:
   ```
   Your password reset code is: {{ .Token }}
   ```
3. Save.

Without this change, `verifyOtp` in `ForgotPassword.jsx` will fail because
there's no code in the email to enter.

### c) Grab your anon key

Dashboard → **Project Settings → API → anon public key**. You'll need it in two places (step 2 below).

---

## 2. Configure the app

**Frontend (`.env`):**

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://uufksdiokauatykyrepr.supabase.co
VITE_SUPABASE_ANON_KEY=<your anon key>
```

**Editor bridge (`public/editor/editor-bridge.js`):**

Your anon key is already baked into this file in this drop — nothing to
edit here this time. (If you ever regenerate/rotate your anon key in
Supabase, this is the one place besides `.env` that needs updating —
it's a plain static file, so it can't read `.env` itself.)

**⚠️ If you re-unzip a future drop of this project over your existing
folder:** it will overwrite this file and put a placeholder back if a
future version reintroduces one. Going forward, any project drop I send
you will have your real key already in place, same as this one — you
shouldn't need to touch this file again unless the key itself changes.

---

## 3. Run it locally

```bash
npm install
npm run dev
```

Open **http://localhost:5173** → you'll land on `/login`. Click "Create an
account" to sign up, then log in, then upload a PDF from the Dashboard and
click **Open** to launch it in the editor.

> Note: local dev over plain HTTP can hit the same `crypto.randomUUID`
> restriction mentioned before if you access it via a LAN IP instead of
> `localhost` — stick to `localhost:5173` and it's a non-issue.

---

## How the editor talks to Supabase

`RAN-PDF-Editor-Pro.html` already has a built-in seam for this — it checks
for `window.desktop` (normally injected by Electron's preload script) and
routes Open/Save through it when present:

```js
const DESK = (window.desktop && window.desktop.isDesktop) ? window.desktop : null;
```

`public/editor/editor-bridge.js` implements that same `window.desktop`
shape, backed by Supabase Storage instead of local disk:

- **On load** (`onOpenPath`) — reads `?fileId=` from the URL, checks the
  person is logged in, downloads that file's bytes from Storage, and hands
  them to the editor exactly like a native "open this file" event.
- **On save** (`writeFile`) — re-uploads the edited bytes to the same
  Storage path and bumps the `files` row's `size_bytes` / `updated_at`.
- **Manual Open button** — redirects back to the Dashboard for now (v1);
  there's no in-editor file picker yet.
- **Save As** — behaves like a regular Save in v1 (overwrites the same
  file rather than creating a new one).

Because the React app and the static editor page share the same origin and
the same Supabase project, the session set by logging in in React is
automatically picked up by the editor's own Supabase client — no token
passing needed.

---

## Project structure

```
ran-pdf-cloud/
├── public/
│   └── editor/
│       ├── pdf-editor.html      # = RAN-PDF-Editor-Pro.html + 2 <script> tags
│       └── editor-bridge.js     # window.desktop, backed by Supabase
├── src/
│   ├── pages/                   # Login, Signup, ForgotPassword, Dashboard
│   ├── components/               # Navbar, FileCard, ProtectedRoute, Logo
│   ├── lib/                      # supabaseClient.js, useAuth.js
│   └── styles/theme.css          # tokens copied from the editor's own :root
├── supabase/
│   └── migrations/0001_init.sql  # profiles, files, RLS, username lookups
└── vite.config.js
```

---

## What's new in this pass

### 90-day auto-purge
`supabase/functions/purge-expired-files/index.ts` is the corrected version
of what was already deployed (the old copy pointed at a bucket named
`user-pdfs` instead of `user-files`, so it was silently failing to delete
Storage objects every night — DB rows were still being removed, but the
actual PDF bytes were piling up as orphans). Redeploy the fix:

```bash
npx supabase functions deploy purge-expired-files
```

The pg_cron job you already have (`purge-expired-files-daily`, running at
03:00 GMT) doesn't need to change — it just calls whatever's currently
deployed. Also double check the `SUPABASE_SERVICE_ROLE_KEY` secret is set:

```bash
npx supabase secrets list
```

If it's missing:
```bash
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your service_role key>
```
(Dashboard → Project Settings → API → `service_role` `secret` key — **never**
put this one in frontend code, only as a function secret.)

You can trigger it manually to check the response instead of waiting for
the nightly run: Dashboard → Edge Functions → purge-expired-files →
**Invoke** — should return `{"deleted": N, "bucket": "user-files"}`.

### PWA
`public/manifest.json` + `public/service-worker.js`, registered in
`src/main.jsx`. Network-first for everything (falls back to cache only
when there's no network) — Supabase requests are never intercepted, so
auth/database/storage calls always hit the network live.

**If you're picking up an update to `service-worker.js` itself** (like
this one, which fixed a cache-name bug from an earlier draft): browsers
auto-update service workers on navigation, but during active development
it's more reliable to force it manually — DevTools → **Application →
Service Workers → Unregister**, then hard refresh (`Ctrl+Shift+R`). Once
this app is stable, this manual step won't be necessary for real users.

This is a hand-written strategy rather than `vite-plugin-pwa`'s build-time
precache manifest, to avoid adding another build dependency this early —
works fine, but if the app grows a lot of routes/assets, revisit with
`vite-plugin-pwa` for automatic precache-list generation.

**Testing installability:** PWA install prompts require HTTPS (`localhost`
is an exception and works for testing). After `npm run dev`, open Chrome/Edge
DevTools → **Application → Manifest** to confirm it's read correctly, and
look for the install icon in the address bar.

### Rename
Double-click a file's name on the Dashboard, or use the pencil icon.
Updates `files.file_name` only — the underlying Storage path/object is
untouched, so this is a metadata-only, instant operation.

### Search
Client-side filter over the already-loaded file list (matches on file
name, case-insensitive substring). Fine at the scale of "one person's
PDFs" — if this ever needs to search across huge libraries, swap to a
server-side `ilike` query instead.

### PDF → Word export, and plain PDF download
Text-extraction based (see the earlier discussion in this README's
history / conversation) — pulls each page's text via pdf.js and lays it
out as one paragraph per page in a generated `.docx`. A separate, simpler
**Download PDF** action sits next to it wherever Export to Word appears —
that one doesn't convert anything, it just saves the current PDF bytes
straight to your computer. Both are available in two places:
- **Dashboard** — two icons on each file card: a download icon (plain
  PDF) and an export icon (Word). Both download straight from Storage.
- **Editor** — two floating buttons, top-right: "Download PDF" and
  "Export to Word". Both act on whatever's currently open, including
  unsaved edits (they bake the live in-memory document, same as a real
  Save would) — so this doubles as a way to grab a local copy before or
  instead of saving back to the cloud.

Two separate implementations by necessity: `src/lib/pdfToDocx.js` for the
React Dashboard (npm-bundled `pdfjs-dist` + `docx`), and
`public/editor/pdf-to-docx.js` for the static editor page (same libraries,
vendored as browser bundles in `public/editor/vendor/` since that page
isn't processed by Vite). Both use the exact same extraction/layout logic.

**Known limitation:** complex layouts (multi-column text, tables, precise
positioning) won't reconstruct perfectly — this gets the *words* into an
editable Word doc, not a pixel-perfect clone. If that becomes a real
complaint, the fix is swapping the conversion function for a paid
layout-preserving API (CloudConvert, Adobe PDF Services, etc.) — contained
to `pdfToDocx.js` / `pdf-to-docx.js`, nothing else in the UI changes.

---

## What's still not in this pass

- In-editor file picker / true "Save As" as a new file (still redirects to
  Dashboard / overwrites in place, per the earlier pass)
- Deployment config for Vercel
- Account settings page (change password while logged in, delete account)
- Upload size limits / friendlier error messaging for huge files

Let me know what to build next.
