import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/useAuth";
import { convertPdfBytesToDocx, downloadBlob } from "../lib/pdfToDocx";
import Navbar from "../components/Navbar";
import FileCard from "../components/FileCard";

function makeStoragePath(userId, fileId, fileName) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/${fileId}-${safeName}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [exportingId, setExportingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  async function loadFiles() {
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from("files")
      .select("*")
      .order("uploaded_at", { ascending: false });
    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      setFiles(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (user) loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    // Returning to this page via the browser's back/forward cache (e.g.
    // after navigating to the editor and back) restores the exact prior
    // in-memory state instead of re-running effects — including a file
    // list from before a delete. Force a fresh fetch whenever that happens.
    function handlePageShow(e) {
      if (e.persisted && user) loadFiles();
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const visibleFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.file_name.toLowerCase().includes(q));
  }, [files, search]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      return;
    }

    setError("");
    setUploading(true);
    try {
      const fileId = crypto.randomUUID();
      const storagePath = makeStoragePath(user.id, fileId, file.name);

      const { error: uploadErr } = await supabase.storage
        .from("user-files")
        .upload(storagePath, file, { contentType: "application/pdf", upsert: false });
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("files").insert({
        id: fileId,
        user_id: user.id,
        file_name: file.name,
        storage_path: storagePath,
        size_bytes: file.size
      });
      if (insertErr) throw insertErr;

      await loadFiles();
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function handleOpen(file) {
    window.location.href = `/editor/pdf-editor.html?fileId=${file.id}`;
  }

  async function handleDelete(file) {
    if (!window.confirm(`Delete "${file.file_name}"? This can't be undone.`)) return;
    setDeletingId(file.id);
    setError("");
    try {
      const { error: storageErr } = await supabase.storage
        .from("user-files")
        .remove([file.storage_path]);
      if (storageErr) throw storageErr;

      // .select() after delete returns the deleted row(s) — if that comes
      // back empty, the delete matched nothing (e.g. an RLS mismatch)
      // without Supabase treating it as an error. Surfacing that here
      // instead of silently doing nothing is what would otherwise look
      // exactly like "the deleted file keeps coming back."
      const { data: deletedRows, error: deleteErr } = await supabase
        .from("files")
        .delete()
        .eq("id", file.id)
        .select();
      if (deleteErr) throw deleteErr;
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error("Nothing was deleted — the file record may already be gone. Refreshing your file list.");
      }

      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (err) {
      setError(err.message || "Couldn't delete that file.");
      await loadFiles(); // resync with the server so stale rows don't linger either way
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRename(file, newName) {
    setError("");
    // Optimistic update — rename is low-risk and users expect it to feel instant.
    setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, file_name: newName } : f)));
    const { error: renameErr } = await supabase
      .from("files")
      .update({ file_name: newName })
      .eq("id", file.id);
    if (renameErr) {
      setError(renameErr.message || "Couldn't rename that file.");
      setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, file_name: file.file_name } : f)));
    }
  }

  async function handleDownloadPdf(file) {
    setError("");
    setDownloadingId(file.id);
    try {
      const { data: blobData, error: downloadErr } = await supabase.storage
        .from("user-files")
        .download(file.storage_path);
      if (downloadErr) throw downloadErr;
      downloadBlob(blobData, file.file_name);
    } catch (err) {
      setError(err.message || "Couldn't download that file.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleExportWord(file) {
    setError("");
    setExportingId(file.id);
    try {
      const { data: blobData, error: downloadErr } = await supabase.storage
        .from("user-files")
        .download(file.storage_path);
      if (downloadErr) throw downloadErr;

      const bytes = new Uint8Array(await blobData.arrayBuffer());
      const docxBlob = await convertPdfBytesToDocx(bytes);
      const baseName = file.file_name.replace(/\.pdf$/i, "");
      downloadBlob(docxBlob, `${baseName}.docx`);
    } catch (err) {
      setError(err.message || "Couldn't convert that file to Word.");
    } finally {
      setExportingId(null);
    }
  }

  return (
    <div className="app-shell">
      <Navbar />
      <div className="dash-body">
        <div className="dash-head">
          <div>
            <h1>Your files</h1>
            <p>Files are automatically removed 90 days after upload.</p>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div className="search-bar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Search your files"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <label className="upload-btn">
              {uploading ? (
                <>
                  <span className="spinner" /> Uploading…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3v12m0-12 4 4m-4-4-4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                  </svg>
                  Upload PDF
                </>
              )}
              <input type="file" accept="application/pdf,.pdf" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        {loading ? (
          <p style={{ color: "var(--sub)" }}>Loading your files…</p>
        ) : files.length === 0 ? (
          <div className="empty-state">
            <h3>No files yet</h3>
            <p>Upload a PDF to start editing.</p>
          </div>
        ) : visibleFiles.length === 0 ? (
          <div className="empty-state">
            <h3>No matches</h3>
            <p>No files match "{search}".</p>
          </div>
        ) : (
          <div className="file-grid">
            {visibleFiles.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                onOpen={handleOpen}
                onDelete={handleDelete}
                onRename={handleRename}
                onExportWord={handleExportWord}
                onDownloadPdf={handleDownloadPdf}
                deleting={deletingId === file.id}
                exporting={exportingId === file.id}
                downloading={downloadingId === file.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
