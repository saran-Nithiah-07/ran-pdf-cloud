import { useRef, useState } from "react";
import { convertFile, downloadBlob } from "../lib/converterClient";

// idle -> uploading -> converting -> done   (error can happen from any step)
export default function ConversionModal({ tool, onClose }) {
  const [stage, setStage] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { blob, filename }
  const [sourceFile, setSourceFile] = useState(null);
  const inputRef = useRef(null);
  const xhrRef = useRef(null);

  function reset() {
    setStage("idle");
    setProgress(0);
    setError("");
    setResult(null);
    setSourceFile(null);
  }

  function handleClose() {
    // Cancel the in-flight request rather than just abandoning it, so we
    // don't leave an orphaned upload/conversion running server-side after
    // the person has already closed the dialog.
    if (stage === "uploading" || stage === "converting") {
      xhrRef.current?.abort();
    }
    onClose();
  }

  async function startConversion(file) {
    if (!file) return;

    const suffix = "." + file.name.split(".").pop().toLowerCase();
    if (!tool.acceptList.includes(suffix)) {
      setError(`Please choose a ${tool.acceptList.join(" or ")} file.`);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("Files over 20MB aren't supported.");
      return;
    }

    setError("");
    setSourceFile(file);
    setStage("uploading");
    setProgress(0);

    try {
      const { blob, filename } = await convertFile(
        tool.slug,
        file,
        (pct) => {
          setProgress(pct);
          if (pct >= 100) setStage("converting");
        },
        (xhr) => {
          xhrRef.current = xhr;
        }
      );
      setResult({ blob, filename: filename || file.name.replace(/\.[^.]+$/, tool.outputExt) });
      setStage("done");
    } catch (err) {
      if (err.aborted) {
        // Person cancelled on purpose — just return to the upload step
        // quietly, no need to show this as an error.
        reset();
        return;
      }
      setError(err.message || "Something went wrong during conversion.");
      setStage("idle");
    } finally {
      xhrRef.current = null;
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    startConversion(file);
  }

  function handleFileInput(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    startConversion(file);
  }

  function handleDownload() {
    if (result) downloadBlob(result.blob, result.filename);
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card convert-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" title="Close" onClick={handleClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="convert-modal-head">
          <div className={`tool-tile-icon tool-color-${tool.color}`} style={{ width: 40, height: 40 }}>
            {tool.icon}
          </div>
          <div>
            <h2 style={{ margin: 0 }}>{tool.label}</h2>
            <p className="sub" style={{ margin: 0 }}>{tool.sub}</p>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        {stage === "idle" && (
          <div
            className={`dropzone ${dragOver ? "dropzone-active" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div className="dropzone-icon-box">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v12m0-12 4 4m-4-4-4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
            </div>
            <p className="dropzone-title">Click or drag a file here</p>
            <p className="dropzone-sub">Max 20MB &middot; {tool.acceptList.join(", ")}</p>
            <input
              ref={inputRef}
              type="file"
              accept={tool.acceptList.join(",")}
              onChange={handleFileInput}
              style={{ display: "none" }}
            />
          </div>
        )}

        {stage === "uploading" && (
          <div className="convert-progress">
            <p className="convert-progress-label">Uploading {sourceFile?.name}…</p>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="convert-progress-pct">{progress}%</p>
          </div>
        )}

        {stage === "converting" && (
          <div className="convert-progress">
            <p className="convert-progress-label">Converting…</p>
            <div className="progress-bar-track">
              <div className="progress-bar-fill progress-bar-indeterminate" />
            </div>
            <p className="convert-progress-pct" style={{ color: "var(--sub)" }}>
              This can take a few seconds
            </p>
          </div>
        )}

        {stage === "done" && result && (
          <div className="convert-done">
            <div className="convert-done-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p className="convert-done-title">Your file is ready</p>
            <p className="sub" style={{ margin: 0 }}>{result.filename}</p>
            <div className="convert-done-actions">
              <button className="btn btn-primary" style={{ width: "auto", padding: "10px 20px" }} onClick={handleDownload}>
                Download
              </button>
              <button className="btn-ghost" style={{ width: "auto", padding: "10px 16px" }} onClick={reset}>
                Convert another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
