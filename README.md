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

## DOCX editing (Plate.js)

Upload `.docx` files alongside PDFs — the Dashboard shows a type badge on
each card and routes "Open" to the right editor automatically.

**Stack**: [Plate.js](https://platejs.org) (MIT licensed, no server
required) + `@platejs/docx-io` for DOCX import/export + `html2pdf.js` for
the DOCX → PDF export path. Built by hand (not via Plate's shadcn/Tailwind
CLI kits) since this project uses plain CSS — see `src/lib/docKit.jsx` for
the plugin/component setup.

- **New page**: `src/pages/DocEditor.jsx` — a real React route
  (`/doc-editor?fileId=...`), unlike the PDF editor which is a static
  file. Loads the `.docx` from Storage, imports it into Plate, and saves
  back to the same Storage path on Save.
- **Toolbar**: full-featured as of this pass — see "Full editor toolbar"
  below for the complete list and what was actually verified working.
- **Both export directions work either way**: PDF files get a "Export to
  Word" action, DOCX files get a mirrored "Export to PDF" action — same
  icon slot on the Dashboard card, same floating buttons inside whichever
  editor is open.
- **Known limitation**: only modern `.docx` is supported, not the legacy
  binary `.doc` format — uploading a `.doc` shows a clear error asking
  for `.docx` instead.

**Before running locally**, apply the new migrations (adds
`files.file_type`, no new migration needed for the toolbar expansion —
tables/images/links/colors are stored as part of the same DOCX blob):
```bash
npx supabase db push
```

**This was verified working**, not just written and hoped for — a
headless-browser test round-tripped a real `.docx` (heading, bold,
italic, subheading, paragraph) through import → render → toolbar
toggling → DOCX export → PDF export, and confirmed the structure and
formatting survived intact at every step, with zero console errors. What
that test *couldn't* cover (no real Supabase session available in that
environment) is the live Dashboard → Storage → editor → Save round trip —
worth running through deliberately on your first local test: upload a
`.docx`, open it, make an edit, hit Save, close it, reopen it, and confirm
your edit persisted.

### Full editor toolbar (Tier 1–3)
Expanded from the original minimal 4-button toolbar to a genuinely
full-featured one, all hand-built with plain CSS (no Tailwind/shadcn) to
match Pdfinity's own look:

- **Marks**: bold, italic, underline, strikethrough, code
- **Blocks**: H1–H3, blockquote, bulleted/numbered lists
- **Layout**: text align (left/center/right/justify), indent/outdent
- **Rich content**: text color, highlight, links, tables (insert +
  editable cells), images (uploaded to Supabase Storage, 5-year signed
  URL), a small emoji picker

**Not included**: checklists (Plate's list model doesn't map cleanly onto
a simple toggle), comments (needs a whole backend data model), AI
(explicitly out of scope).

A second, more thorough headless-browser pass exercised every one of the
above on a real document — including nested/composed marks across a
heading, a link, table cells, and body text that already had bold/italic
applied — then round-tripped it through both DOCX and PDF export, with
zero console errors. One real bug was caught and fixed this way: the
table renderer produced invalid HTML (`<tr>` with no `<tbody>`), which
React was correctly warning about; fixed by rendering the table's outer
tag manually instead of through the usual component wrapper.

**The one thing that testing couldn't cover**: real image uploads through
an actual Supabase session (no live login available in that test
environment). The upload code path itself (`uploadImage` → Storage →
signed URL) was verified using a mock that skips the real network call —
worth specifically testing image insertion on your first local pass.

## Admin panel

Replaces public self-signup entirely — new users are invited by an admin
(name, email, mobile) rather than signing themselves up. Logging in as an
admin redirects straight to `/admin` instead of `/dashboard`; everyone
else is redirected to `/dashboard` and can't reach `/admin` even by typing
the URL directly (`AdminRoute` checks this server-side via their actual
role, not just by hiding the link).

### Setup — required before this works at all

**1. Apply the new migration** (adds `role`/`status`/`mobile_number`/
`email` to `profiles`, plus RLS so an admin can see/update every profile,
not just their own):
```bash
npx supabase db push
```

**2. Deploy the two new Edge Functions:**
```bash
npx supabase functions deploy admin-invite-user
npx supabase functions deploy admin-delete-user
```
Both need the same `SUPABASE_SERVICE_ROLE_KEY` secret the purge function
already uses.

**3. Create your first admin.** There's no signup flow left to create one
through, so promote an existing account directly in Supabase's SQL
Editor:
```sql
update public.profiles set role = 'admin' where username = 'your_existing_username';
```
Log in with that account afterward — you'll land on `/admin` instead of
`/dashboard`.

### How invites actually work

Admin fills in Name/Email/Mobile in the panel → `admin-invite-user` runs
server-side (needs the service-role key to create an auth user and bypass
RLS to insert their profile) → Supabase sends an invite email → the
person clicks it, lands on `/accept-invite` already signed into a
temporary session (same mechanism as password reset), sets a real
password, and from then on logs in normally with the username the invite
flow auto-generated for them from their email (e.g. `jane.doe@...` →
`janedoe4821`).

**One thing to check**: Supabase's default "Invite user" email template
should already route through the custom SMTP (Resend) set up earlier for
password reset — same account, same sender restriction applies (only
delivers to your Resend account's own email until you verify a real
domain there).

### Deactivate → delete lifecycle

Deleting a user is only allowed once they're deactivated — enforced both
in the UI (Delete is disabled otherwise) and again inside
`admin-delete-user` itself, so it can't be bypassed by calling the
function directly. Deleting cascades: every file the user uploaded is
removed from Storage, their `files` rows are deleted, their `profiles`
row is deleted, and finally their actual Supabase Auth account is
deleted.

### What wasn't tested here

Everything in this section depends on a live Supabase project — sending a
real invite email, the temporary invite session, and the full
invite→accept→login round trip need your real environment. What I did
verify: the pages render cleanly with zero console errors (Login with the
signup link genuinely gone, `/accept-invite` renders correctly, `/signup`
now redirects straight to `/login`). Worth testing end to end on your
first pass: invite yourself with a second email address, accept the
invite, log in, then from the admin account deactivate and delete that
test user.

## Still outstanding

- In-editor file picker / true "Save As" as a new file in the PDF editor
  (still redirects to Dashboard / overwrites in place)
- Account settings page (change password while logged in)
- Upload size limits / friendlier error messaging for huge files
- Checklists in the DOCX editor (skipped — see the DOCX editing section)

Let me know what to build next.
