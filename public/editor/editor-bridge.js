/*
 * editor-bridge.js
 *
 * Stands in for Electron's preload script. RAN-PDF-Editor-Pro.html checks
 * `window.desktop` on load and, if present, routes Open/Save through it
 * instead of the browser-download fallback:
 *
 *   const DESK = (window.desktop && window.desktop.isDesktop) ? window.desktop : null;
 *
 * This file must run BEFORE that check, so it's loaded as a normal
 * (non-deferred) <script> in <head>, ahead of the editor's own inline
 * <script> at the bottom of the body.
 *
 * v1 scope / known limitations:
 *   - Manual "Open" from inside the editor sends you back to the
 *     Dashboard to pick a file, rather than opening an in-editor picker.
 *   - "Save As" behaves like "Save" (overwrites the same Storage object)
 *     rather than creating a new file record. Fine for now since editing
 *     always starts from a Dashboard-owned file.
 */
(function () {
  const SUPABASE_URL = "https://uufksdiokauatykyrepr.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1ZmtzZGlva2F1YXR5a3lyZXByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MTI3NTYsImV4cCI6MjEwMTA4ODc1Nn0.9Lhbi-OMDJehwXMxM4U8RqjGbSVBY4wHQxdfwlJgT-o";

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  const params = new URLSearchParams(window.location.search);
  const fileId = params.get("fileId");

  let currentRecord = null; // { id, file_name, storage_path }

  function goToDashboard() {
    window.location.href = "/dashboard";
  }

  window.desktop = {
    isDesktop: true,

    // Manual "Open" click inside the editor — v1 sends people back to the
    // Dashboard's file library rather than opening an in-editor picker.
    async openDialog() {
      goToDashboard();
      return null;
    },

    // "Save As" — v1 just reuses the current record's own storage path,
    // so it behaves like a regular Save.
    async saveDialog(suggestedName) {
      return currentRecord ? currentRecord.storage_path : suggestedName;
    },

    async writeFile(target, bytes) {
      const path = target || (currentRecord && currentRecord.storage_path);
      if (!path) return;

      const blob = new Blob([bytes], { type: "application/pdf" });
      const { error: uploadErr } = await sb.storage
        .from("user-files")
        .upload(path, blob, { contentType: "application/pdf", upsert: true });

      if (uploadErr) {
        alert("Save failed: " + uploadErr.message);
        return;
      }

      if (currentRecord && currentRecord.storage_path === path) {
        await sb
          .from("files")
          .update({ size_bytes: bytes.length, updated_at: new Date().toISOString() })
          .eq("id", currentRecord.id);
      }
    },

    setTitle(label) {
      document.title = (label ? label + " — " : "") + "RAN PDF Editor Pro";
    },

    // No native app menu in the browser — no-op.
    onMenu() {},

    // Called once on load; this is where we pull the requested file's
    // bytes down from Supabase Storage and hand them to the editor.
    onOpenPath(callback) {
      (async () => {
        if (!fileId) {
          goToDashboard();
          return;
        }

        const { data: sessionData } = await sb.auth.getSession();
        if (!sessionData.session) {
          window.location.href = "/login";
          return;
        }

        const { data: record, error: recordErr } = await sb
          .from("files")
          .select("*")
          .eq("id", fileId)
          .single();

        if (recordErr || !record) {
          alert("That file couldn't be found.");
          goToDashboard();
          return;
        }

        currentRecord = record;

        const { data: blob, error: downloadErr } = await sb.storage
          .from("user-files")
          .download(record.storage_path);

        if (downloadErr) {
          alert("Couldn't load the file: " + downloadErr.message);
          return;
        }

        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        // The editor's own catch block around adoptBytes() swallows the
        // real error and just shows a generic toast — so we validate here
        // first and log/alert something actually diagnosable.
        const header = new TextDecoder().decode(bytes.slice(0, 5));
        console.log(
          `[editor-bridge] downloaded ${bytes.length} bytes for "${record.file_name}", header: "${header}"`
        );
        if (bytes.length === 0) {
          alert("The downloaded file was empty (0 bytes). Check the file in Supabase Storage.");
          return;
        }
        if (header !== "%PDF-") {
          alert(
            `The downloaded file doesn't look like a valid PDF (expected header "%PDF-", got "${header}"). ` +
              "It may have been uploaded or stored incorrectly."
          );
          return;
        }

        // The editor's own DESK.onOpenPath handler wraps adoptBytes() in a
        // try/catch that swallows the real error and shows a generic
        // toast ("Couldn't open that file.") with no logging. adoptBytes
        // is exposed globally (window.PDFStudio.adoptBytes), so we
        // temporarily wrap the global reference the vendor code calls by
        // bare identifier — this makes the real underlying error visible
        // without modifying the editor's own file.
        if (window.PDFStudio && window.PDFStudio.adoptBytes && !window.__adoptBytesWrapped) {
          const originalAdoptBytes = window.adoptBytes;
          window.adoptBytes = async function (...args) {
            try {
              return await originalAdoptBytes.apply(this, args);
            } catch (err) {
              console.error("[editor-bridge] adoptBytes threw:", err);
              throw err;
            }
          };
          window.__adoptBytesWrapped = true;
        }

        callback({
          path: record.storage_path,
          name: record.file_name,
          data: bytes
        });
      })();
    }
  };
})();
