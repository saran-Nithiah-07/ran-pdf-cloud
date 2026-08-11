import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/useAuth";
import { convertPdfBytesToDocx, downloadBlob as downloadPdfLibBlob } from "../lib/pdfToDocx";
import {
  docxBytesToPlateValue,
  plateValueToPdfBlob,
  downloadBlob as downloadDocBlob
} from "../lib/docConversion";
import Navbar from "../components/Navbar";
import FileCard from "../components/FileCard";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function makeStoragePath(userId, fileId, fileName) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/${fileId}-${safeName}`;
}

function detectFileType(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  return null; // .doc (legacy) and anything else — rejected at upload
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
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

    const fileType = detectFileType(file);
    if (!fileType) {
      setError(
        file.name.toLowerCase().endsWith(".doc")
          ? "Legacy .doc files aren't supported — please save it as .docx first."
          : "Only PDF and .docx files are supported."
      );
      return;
    }

    setError("");
    setUploading(true);
    try {
      const fileId = crypto.randomUUID();
      const storagePath = makeStoragePath(user.id, fileId, file.name);
      const contentType = fileType === "pdf" ? "application/pdf" : DOCX_MIME;

      const { error: uploadErr } = await supabase.storage
        .from("user-files")
        .upload(storagePath, file, { contentType, upsert: false });
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("files").insert({
        id: fileId,
        user_id: user.id,
        file_name: file.name,
        storage_path: storagePath,
        size_bytes: file.size,
        file_type: fileType
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
    if (file.file_type === "docx") {
      navigate(`/doc-editor?fileId=${file.id}`);
    } else {
      window.location.href = `/editor/pdf-editor.html?fileId=${file.id}`;
    }
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
      await loadFiles();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRename(file, newName) {
    setError("");
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

  // "Download original" — raw bytes, no conversion, for either file type.
  async function handleDownloadOriginal(file) {
    setError("");
    setDownloadingId(file.id);
    try {
      const { data: blobData, error: downloadErr } = await supabase.storage
        .from("user-files")
        .download(file.storage_path);
      if (downloadErr) throw downloadErr;
      downloadPdfLibBlob(blobData, file.file_name);
    } catch (err) {
      setError(err.message || "Couldn't download that file.");
    } finally {
      setDownloadingId(null);
    }
  }

  // "Convert & export" — PDF files export as Word, DOCX files export as PDF.
  async function handleConvertExport(file) {
    setError("");
    setExportingId(file.id);
    try {
      const { data: blobData, error: downloadErr } = await supabase.storage
        .from("user-files")
        .download(file.storage_path);
      if (downloadErr) throw downloadErr;

      const bytes = new Uint8Array(await blobData.arrayBuffer());
      const baseName = file.file_name.replace(/\.(pdf|docx)$/i, "");

      if (file.file_type === "pdf") {
        const docxBlob = await convertPdfBytesToDocx(bytes);
        downloadPdfLibBlob(docxBlob, `${baseName}.docx`);
      } else {
        const value = await docxBytesToPlateValue(bytes.buffer);
        const pdfBlob = await plateValueToPdfBlob(value, baseName);
        downloadDocBlob(pdfBlob, `${baseName}.pdf`);
      }
    } catch (err) {
      setError(err.message || "Couldn't convert that file.");
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
                  Upload file
                </>
              )}
              <input
                type="file"
                accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        {loading ? (
          <p style={{ color: "var(--sub)" }}>Loading your files…</p>
        ) : files.length === 0 ? (
          <div className="empty-state">
            <h3>No files yet</h3>
            <p>Upload a PDF or Word document to start editing.</p>
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
                onExportWord={handleConvertExport}
                onDownloadPdf={handleDownloadOriginal}
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
