// Hardcoded admin login — deliberately independent of the `profiles`
// table's role/status columns, so a deleted or mis-edited profile row
// (as happened once) can never lock the admin out of /admin again.
//
// SECURITY NOTE: this file ships inside the browser's JS bundle. Anyone
// who opens DevTools -> Sources, or just views the deployed site's built
// JS, can read these values in plain text. This is appropriate ONLY
// because this is a small internal tool with a single trusted admin —
// it is NOT a real secret the way a database password is. Don't reuse
// this password anywhere else.
//
// ADMIN_BACKING_EMAIL must match a real Supabase auth user (create one
// in Supabase Dashboard -> Authentication -> Users if it doesn't exist
// yet), and that account's actual Supabase password must be set to the
// same value as ADMIN_PASSWORD below. Login.jsx signs into that real
// account behind the scenes when these two values match what's typed.
export const ADMIN_USERNAME = "Admin";
export const ADMIN_PASSWORD = "CHANGE-ME-Str0ng-Password!";
export const ADMIN_BACKING_EMAIL = "admin@pdfinity.internal";
