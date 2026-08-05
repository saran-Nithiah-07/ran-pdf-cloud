import { useState } from "react";

function formatSize(bytes) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export default function FileCard({ file, onOpen, onDelete, onRename, onExportWord, onDownloadPdf, deleting, exporting, downloading }) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(file.file_name);

  function startRename() {
    setDraftName(file.file_name);
    setRenaming(true);
  }

  function cancelRename() {
    setRenaming(false);
    setDraftName(file.file_name);
  }

  function submitRename(e) {
    e.preventDefault();
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === file.file_name) {
      setRenaming(false);
      return;
    }
    onRename(file, trimmed);
    setRenaming(false);
  }

  return (
    <div className="file-card">
      <div className="icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      </div>

      {renaming ? (
        <form onSubmit={submitRename} className="rename-form">
          <input
            autoFocus
            className="rename-input"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && cancelRename()}
            onBlur={cancelRename}
          />
        </form>
      ) : (
        <div className="name" title={file.file_name} onDoubleClick={startRename}>
          {file.file_name}
        </div>
      )}

      <div className="meta">
        {formatSize(file.size_bytes)} &middot; uploaded {formatDate(file.uploaded_at)}
      </div>

      <div className="actions">
        <button className="open-btn" onClick={() => onOpen(file)}>
          Open
        </button>
        <button className="icon-btn" title="Rename" onClick={startRename}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
          </svg>
        </button>
        <button
          className="icon-btn"
          title="Download PDF"
          onClick={() => onDownloadPdf(file)}
          disabled={downloading}
        >
          {downloading ? (
            <span className="spinner" style={{ borderTopColor: "var(--accent)" }} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="M7 10l5 5 5-5M12 15V3" />
            </svg>
          )}
        </button>
        <button
          className="icon-btn"
          title="Export to Word"
          onClick={() => onExportWord(file)}
          disabled={exporting}
        >
          {exporting ? (
            <span className="spinner" style={{ borderTopColor: "var(--accent)" }} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v12m0-12 4 4m-4-4-4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
          )}
        </button>
        <button className="delete-btn" onClick={() => onDelete(file)} disabled={deleting}>
          {deleting ? "…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
