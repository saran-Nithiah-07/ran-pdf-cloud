import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DocxEditor } from "@docx-editor.dev/react";
import { defaultFonts } from "@docx-editor.dev/fonts";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/useAuth";
import { convertFile, downloadBlob } from "../lib/converterClient";
import Logo from "../components/Logo";
import "@docx-editor.dev/core/styles/editor.css";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function download(bytes, name) {
  const blob = new Blob([bytes], { type: DOCX_MIME });
  downloadBlob(blob, `${name}.docx`);
}

/**
 * File menu, replaced entirely (preset={false}) with exactly the two rows
 * requested: Download as DOCX and Download as PDF. Everything else the
 * packaged menu bar ships by default (Format, Insert, the whole formatting
 * toolbar, rulers, navigation pane) is left completely untouched — this
 * only reaches into the File menu's own row list.
 *
 * IMPORTANT: this must be passed to `menu.children` DIRECTLY (see below in
 * the component), not wrapped in a custom React component. The bar only
 * recognizes "this replaces the File menu in place" by checking the
 * child's type against its known menu parts — wrap it in anything else
 * and it stops being recognized as a replacement and gets appended as a
 * second, generic "File" entry instead (which is exactly the duplicate
 * menu bug this fixes). Because it can't use a wrapping component, it
 * can't call the `useDocxEditor()` hook either — it reaches the editor
 * instance through the same ref the host already holds instead.
 *
 * PDF export reuses the same converter service every other conversion tool
 * in the app already goes through (Adobe primary across 2 accounts, local
 * LibreOffice fallback) rather than a separate client-side PDF path — the
 * in-editor bytes are saved, wrapped as a File, and sent to
 * /convert/word-to-pdf exactly like the Home page's Word→PDF tool does.
 */
function buildFileMenu({ editorRef, fileName, onPdfExport, pdfExporting }) {
  return (
    <DocxEditor.Menu.File preset={false}>
      <DocxEditor.Menu.Row
        onSelect={async () => {
          const bytes = await editorRef.current?.save();
          if (bytes) download(bytes, fileName);
        }}
      >
        Download as DOCX
      </DocxEditor.Menu.Row>
      <DocxEditor.Menu.Row disabled={pdfExporting} onSelect={onPdfExport}>
        {pdfExporting ? "Preparing PDF…" : "Download as PDF"}
      </DocxEditor.Menu.Row>
    </DocxEditor.Menu.File>
  );
}

export default function DocEditor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileId = searchParams.get("fileId");

  const editorRef = useRef(null);
  const [record, setRecord] = useState(null);
  const [docBytes, setDocBytes] = useState();
  const [fonts, setFonts] = useState();
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [status, setStatus] = useState("");

  const baseName = (record?.file_name || "document").replace(/\.docx$/i, "");
  const ready = fonts !== undefined;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!fileId || !user) return;
      setLoadError("");

      const [{ data: fileRecord, error: recordErr }, faces] = await Promise.all([
        supabase.from("files").select("*").eq("id", fileId).single(),
        defaultFonts()
      ]);

      if (cancelled) return;
      if (recordErr || !fileRecord) {
        setLoadError("That file couldn't be found.");
        return;
      }

      const { data: blob, error: downloadErr } = await supabase.storage
        .from("user-files")
        .download(fileRecord.storage_path);

      if (cancelled) return;
      if (downloadErr) {
        setLoadError("Couldn't load the file: " + downloadErr.message);
        return;
      }

      try {
        const arrayBuffer = await blob.arrayBuffer();
        if (cancelled) return;
        setRecord(fileRecord);
        setFonts(faces);
        setDocBytes(arrayBuffer);
      } catch (err) {
        if (!cancelled) setLoadError("Couldn't open this document: " + err.message);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, user?.id]);

  const handleSave = useCallback(async () => {
    if (!record) return;
    setSaving(true);
    setStatus("");
    try {
      const bytes = await editorRef.current?.save();
      if (!bytes) throw new Error("Nothing to save yet.");
      const blob = new Blob([bytes], { type: DOCX_MIME });

      const { error: uploadErr } = await supabase.storage
        .from("user-files")
        .upload(record.storage_path, blob, { contentType: DOCX_MIME, upsert: true });
      if (uploadErr) throw uploadErr;

      await supabase
        .from("files")
        .update({ size_bytes: blob.size, updated_at: new Date().toISOString() })
        .eq("id", record.id);

      setStatus("Saved");
      setTimeout(() => setStatus(""), 2000);
    } catch (err) {
      setStatus("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  }, [record]);

  const handleExportPdf = useCallback(async () => {
    if (!record) return;
    setExportingPdf(true);
    setStatus("");
    try {
      const bytes = await editorRef.current?.save();
      if (!bytes) throw new Error("Nothing to export yet.");
      const blob = new Blob([bytes], { type: DOCX_MIME });
      const file = new File([blob], `${baseName}.docx`, { type: DOCX_MIME });

      const { blob: pdfBlob, filename } = await convertFile("word-to-pdf", file);
      downloadBlob(pdfBlob, filename || `${baseName}.pdf`);
    } catch (err) {
      setStatus("PDF export failed: " + err.message);
    } finally {
      setExportingPdf(false);
    }
  }, [record, baseName]);

  if (loadError) {
    return (
      <div className="doc-editor-shell">
        <div className="doc-editor-error">
          <p>{loadError}</p>
          <button
            className="btn btn-primary"
            style={{ width: "auto" }}
            onClick={() => navigate("/dashboard")}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!ready || docBytes === undefined) {
    return (
      <div className="doc-editor-shell">
        <span className="spinner" style={{ borderTopColor: "#c81026" }} />
      </div>
    );
  }

  return (
    <div className="doc-editor-shell">
      <DocxEditor
        ref={editorRef}
        document={docBytes}
        fonts={fonts}
        title={record?.file_name}
        onSave={() => void handleSave()}
        menu={{
          fileName: baseName,
          reportIssue: false,
          children: buildFileMenu({
            editorRef,
            fileName: baseName,
            onPdfExport: handleExportPdf,
            pdfExporting: exportingPdf
          })
        }}
        renderTitleBarLeft={() => (
          <button
            type="button"
            className="doc-editor-back-btn"
            onClick={() => navigate("/dashboard")}
            title="Back to Dashboard"
          >
            <Logo withName={false} />
          </button>
        )}
        renderTitleBarRight={() => (
          <div className="doc-editor-actions">
            {status && <span className="doc-editor-status">{status}</span>}
            <button
              type="button"
              id="doc-editor-save-btn"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? <span className="spinner" /> : "Save"}
            </button>
          </div>
        )}
      />
    </div>
  );
}
