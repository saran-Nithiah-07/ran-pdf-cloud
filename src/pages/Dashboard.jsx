import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/useAuth";
import Navbar from "../components/Navbar";
import ConfirmModal from "../components/ConfirmModal";
import ConversionModal from "../components/ConversionModal";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PAGE_SIZE = 10;
const TABS = ["pdf", "docx"];
const TAB_LABELS = { pdf: "PDF", docx: "Docs" };

const DOC_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);
const SWAP_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 3l4 4-4 4M21 7H9M7 21l-4-4 4-4M3 17h12" />
  </svg>
);

const TOOLS = [
  { slug: "word-to-pdf", label: "Word to PDF", sub: ".docx → .pdf", color: "blue", icon: DOC_ICON, acceptList: [".doc", ".docx"], outputExt: ".pdf" },
  { slug: "pptx-to-pdf", label: "PowerPoint to PDF", sub: ".pptx → .pdf", color: "orange", icon: DOC_ICON, acceptList: [".ppt", ".pptx"], outputExt: ".pdf" },
  { slug: "excel-to-pdf", label: "Excel to PDF", sub: ".xlsx → .pdf", color: "green", icon: DOC_ICON, acceptList: [".xls", ".xlsx"], outputExt: ".pdf" },
  { slug: "pdf-to-word", label: "PDF to Word", sub: ".pdf → .docx", color: "red", icon: SWAP_ICON, acceptList: [".pdf"], outputExt: ".docx" },
  { slug: "pdf-to-pptx", label: "PDF to PowerPoint", sub: ".pdf → .pptx", color: "red", icon: SWAP_ICON, acceptList: [".pdf"], outputExt: ".pptx" }
];

function makeStoragePath(userId, fileId, fileName) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/${fileId}-${safeName}`;
}

function detectFileType(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  return null;
}

function formatSize(bytes) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Escapes characters that are special to PostgREST's `ilike` pattern so a
// search string can't break the query or match more broadly than intended.
function escapeForIlike(value) {
  return value.replace(/[%_,]/g, (c) => `\\${c}`);
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTool, setActiveTool] = useState(null);

  const [files, setFiles] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("pdf");
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");

  const [renamingFile, setRenamingFile] = useState(null);
  const [draftName, setDraftName] = useState("");
  const [confirmDeleteFile, setConfirmDeleteFile] = useState(null);

  // Debounce free-text search so we're not hitting Supabase on every
  // keystroke — the actual filtering happens server-side in loadFiles().
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // All filtering (file type tab, search) and pagination happens in the
  // query itself via .eq()/.ilike()/.range() — not by loading every file
  // and slicing/filtering in the browser.
  async function loadFiles(pageOverride) {
    const currentPage = pageOverride ?? page;
    setLoading(true);
    setError("");

    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("files")
      .select("*", { count: "exact" })
      .eq("file_type", tab);

    if (search) {
      const s = escapeForIlike(search);
      query = query.ilike("file_name", `%${s}%`);
    }

    query = query.order("uploaded_at", { ascending: false }).range(from, to);

    const { data, error: fetchErr, count } = await query;

    if (fetchErr) {
      setError(fetchErr.message);
      setLoading(false);
      return;
    }

    const rows = data || [];
    if (rows.length === 0 && currentPage > 0 && (count || 0) > 0) {
      const lastPage = Math.max(0, Math.ceil((count || 0) / PAGE_SIZE) - 1);
      setPage(lastPage);
      return;
    }

    setFiles(rows);
    setTotalCount(count || 0);
    setLoading(false);
    setHasLoadedOnce(true);
  }

  useEffect(() => {
    if (user) loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tab, search, page]);

  useEffect(() => {
    function handlePageShow(e) {
      if (e.persisted && user) loadFiles();
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function handleTabChange(nextTab) {
    setTab(nextTab);
    setPage(0);
  }

  async function uploadFile(file) {
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

      setTab(fileType);
      setPage(0);
      await loadFiles(0);
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function handleUploadInput(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    uploadFile(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    uploadFile(e.dataTransfer.files?.[0]);
  }

  function handleOpen(file) {
    if (file.file_type === "docx") {
      navigate(`/doc-editor?fileId=${file.id}`);
    } else {
      window.location.href = `/editor/pdf-editor.html?fileId=${file.id}`;
    }
  }

  function startRename(file) {
    setDraftName(file.file_name);
    setRenamingFile(file);
  }

  async function submitRename(e) {
    e.preventDefault();
    const trimmed = draftName.trim();
    const file = renamingFile;
    setRenamingFile(null);
    if (!trimmed || !file || trimmed === file.file_name) return;

    setError("");
    setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, file_name: trimmed } : f)));
    const { error: renameErr } = await supabase
      .from("files")
      .update({ file_name: trimmed })
      .eq("id", file.id);
    if (renameErr) {
      setError(renameErr.message || "Couldn't rename that file.");
      setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, file_name: file.file_name } : f)));
    }
  }

  async function confirmDelete() {
    const file = confirmDeleteFile;
    if (!file) return;
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

      setConfirmDeleteFile(null);
      await loadFiles();
    } catch (err) {
      setError(err.message || "Couldn't delete that file.");
      await loadFiles();
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(totalCount, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="app-shell">
      <Navbar />
      <div className="dash-body">
        <div className="dash-head">
          <div>
            <h1>Home</h1>
            <p>Convert files instantly, or manage what's saved for editing below.</p>
          </div>
        </div>

        <div className="convert-tools-grid">
          {TOOLS.map((tool) => (
            <button key={tool.slug} className="tool-tile" onClick={() => setActiveTool(tool)}>
              <div className={`tool-tile-icon tool-color-${tool.color}`}>{tool.icon}</div>
              <span className="tool-tile-label">{tool.label}</span>
            </button>
          ))}
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="admin-card">
          <div className="admin-card-head">
            <div className="admin-filters">
              {TABS.map((t) => (
                <button
                  key={t}
                  className={`admin-filter-btn ${tab === t ? "active" : ""}`}
                  onClick={() => handleTabChange(t)}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>
            <div className="admin-card-head-actions">
              <div className="search-bar" style={{ width: 220 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  placeholder="Search your files"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
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
                  onChange={handleUploadInput}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          {!hasLoadedOnce && loading ? (
            <p style={{ color: "var(--sub)", padding: "0 22px 22px" }}>Loading your files…</p>
          ) : files.length === 0 && !loading ? (
            <div className="empty-state" style={{ margin: "0 22px 22px", border: "1px dashed var(--line)" }}>
              <h3>No {TAB_LABELS[tab]} files here</h3>
              <p>
                {search
                  ? `No files match "${search}".`
                  : `Upload or drag a ${tab === "pdf" ? "PDF" : ".docx"} file to get started.`}
              </p>
            </div>
          ) : (
            <div className={`table-fade ${loading ? "table-fetching" : ""}`}>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Size</th>
                      <th>Uploaded</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => (
                      <tr key={file.id}>
                        <td>
                          <div className="admin-user-cell" style={{ cursor: "pointer" }} onClick={() => handleOpen(file)}>
                            <div className={`admin-avatar type-icon-${file.file_type}`}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <path d="M14 2v6h6" />
                              </svg>
                            </div>
                            {renamingFile?.id === file.id ? (
                              <form onSubmit={submitRename} onClick={(e) => e.stopPropagation()}>
                                <input
                                  autoFocus
                                  className="rename-input"
                                  value={draftName}
                                  onChange={(e) => setDraftName(e.target.value)}
                                  onKeyDown={(e) => e.key === "Escape" && setRenamingFile(null)}
                                  onBlur={() => setRenamingFile(null)}
                                />
                              </form>
                            ) : (
                              <span className="admin-user-name">{file.file_name}</span>
                            )}
                          </div>
                        </td>
                        <td>{formatSize(file.size_bytes)}</td>
                        <td>{formatDate(file.uploaded_at)}</td>
                        <td>
                          <div className="admin-actions">
                            <button className="admin-icon-btn" title="Rename" onClick={() => startRename(file)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
                              </svg>
                            </button>
                            <button
                              className="admin-icon-btn"
                              title="Delete"
                              disabled={deletingId === file.id}
                              onClick={() => setConfirmDeleteFile(file)}
                            >
                              {deletingId === file.id ? (
                                <span className="spinner" style={{ borderTopColor: "var(--sub)" }} />
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 6h18" />
                                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="admin-pagination">
                <span className="admin-pagination-info">
                  Showing {rangeStart}–{rangeEnd} of {totalCount}
                </span>
                <div className="admin-pagination-controls">
                  <button className="admin-page-btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                    Prev
                  </button>
                  <button
                    className="admin-page-btn"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          className={`dropzone dropzone-large ${dragOver ? "dropzone-active" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("dash-dropzone-input").click()}
        >
          <div className="dropzone-icon-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v12m0-12 4 4m-4-4-4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
          </div>
          <p className="dropzone-title">Click or drag file to this area to upload</p>
          <p className="dropzone-sub">Max 20MB &middot; Supported: pdf, docx</p>
          <input
            id="dash-dropzone-input"
            type="file"
            accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleUploadInput}
            style={{ display: "none" }}
          />
        </div>
      </div>

      {activeTool && <ConversionModal tool={activeTool} onClose={() => setActiveTool(null)} />}

      <ConfirmModal
        open={!!confirmDeleteFile}
        title="Delete this file?"
        message={
          confirmDeleteFile
            ? `Permanently delete "${confirmDeleteFile.file_name}"? This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        danger
        loading={!!deletingId}
        onConfirm={confirmDelete}
        onCancel={() => !deletingId && setConfirmDeleteFile(null)}
      />
    </div>
  );
}
