import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";
import { useIndentButton, useOutdentButton } from "@platejs/indent/react";
import { toggleList } from "@platejs/list";
import { insertTable } from "@platejs/table";
import { upsertLink } from "@platejs/link";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/useAuth";
import { makeDocEditorPlugins, ListStyleType } from "../lib/docKit.jsx";
import {
  docxBytesToPlateValue,
  plateValueToDocxBlob,
  plateValueToPdfBlob,
  downloadDocx,
  downloadBlob
} from "../lib/docConversion";
import Logo from "../components/Logo";

const EMPTY_VALUE = [{ type: "p", children: [{ text: "" }] }];

const TEXT_COLORS = ["#1c2333", "#c81026", "#1d7a4c", "#2952cc", "#a8650d", "#7b3ee0"];
const HIGHLIGHT_COLORS = ["#fff3b0", "#ffd6d6", "#d4f4dd", "#d6e4ff", "#f0d6ff"];
const EMOJIS = [
  "😀", "😂", "😊", "😍", "🤔", "😅", "🙌", "👍", "👎", "🙏",
  "🔥", "🎉", "✅", "❌", "⭐", "❤️", "💡", "📌", "📎", "⚠️"
];

// Small components so useIndentButton/useOutdentButton (real React hooks)
// can be called at the top level, not inside a plain click handler.
function IndentButton() {
  const { props } = useIndentButton();
  return (
    <button className="tb" title="Indent" {...props}>
      →|
    </button>
  );
}
function OutdentButton() {
  const { props } = useOutdentButton();
  return (
    <button className="tb" title="Outdent" {...props}>
      |←
    </button>
  );
}

export default function DocEditor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileId = searchParams.get("fileId");

  const [record, setRecord] = useState(null);
  const [initialValue, setInitialValue] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [status, setStatus] = useState("");
  const [openPopover, setOpenPopover] = useState(null);
  const imageInputRef = useRef(null);

  const uploadImage = useCallback(
    async (data) => {
      let blob;
      if (typeof data === "string") {
        const res = await fetch(data);
        blob = await res.blob();
      } else {
        blob = new Blob([data]);
      }
      const ext = (blob.type.split("/")[1] || "png").split("+")[0];
      const path = `${user.id}/doc-images/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("user-files")
        .upload(path, blob, { contentType: blob.type || "image/png", upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: signed, error: signErr } = await supabase.storage
        .from("user-files")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signErr) throw signErr;
      return signed.signedUrl;
    },
    [user?.id]
  );

  const editorPlugins = useMemo(() => makeDocEditorPlugins({ uploadImage }), [uploadImage]);

  const editor = usePlateEditor(
    { plugins: editorPlugins, value: initialValue || EMPTY_VALUE },
    [initialValue]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!fileId || !user) return;
      setLoadError("");

      const { data: fileRecord, error: recordErr } = await supabase
        .from("files")
        .select("*")
        .eq("id", fileId)
        .single();

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
        const value = await docxBytesToPlateValue(arrayBuffer);
        if (cancelled) return;
        setRecord(fileRecord);
        setInitialValue(value);
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
      const blob = await plateValueToDocxBlob(editor.children);
      const { error: uploadErr } = await supabase.storage
        .from("user-files")
        .upload(record.storage_path, blob, {
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: true
        });
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
  }, [editor, record]);

  const handleDownloadDocx = useCallback(async () => {
    if (!record) return;
    const blob = await plateValueToDocxBlob(editor.children);
    downloadDocx(blob, (record.file_name || "document").replace(/\.docx$/i, ""));
  }, [editor, record]);

  const handleExportPdf = useCallback(async () => {
    if (!record) return;
    setExportingPdf(true);
    try {
      const blob = await plateValueToPdfBlob(
        editor.children,
        record.file_name.replace(/\.docx$/i, "")
      );
      downloadBlob(blob, record.file_name.replace(/\.docx$/i, "") + ".pdf");
    } catch (err) {
      setStatus("PDF export failed: " + err.message);
    } finally {
      setExportingPdf(false);
    }
  }, [editor, record]);

  function openPopoverAt(type, e) {
    if (openPopover?.type === type) {
      setOpenPopover(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenPopover({ type, top: rect.bottom + 6, left: rect.left });
  }

  function handleInsertLink() {    const url = window.prompt("Link URL:");
    if (!url) return;
    upsertLink(editor, { url });
  }

  function handleImageChange(e) {
    const files = e.target.files;
    if (files && files.length) {
      editor.tf.insert.imageFromFiles(files);
    }
    e.target.value = "";
  }

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

  if (!initialValue) {
    return (
      <div className="doc-editor-shell">
        <span className="spinner" style={{ borderTopColor: "#c81026" }} />
      </div>
    );
  }

  return (
    <div className="doc-editor-shell" onClick={() => setOpenPopover(null)}>
      <Plate editor={editor}>
        <header className="doc-topbar">
          <div className="doc-topbar-left">
            <Logo withName={false} />
            <span className="doc-filename">{record?.file_name}</span>
          </div>

          <div className="doc-toolbar">
          <button className="tb" onClick={() => editor.tf.h1.toggle()} title="Heading 1">H1</button>
          <button className="tb" onClick={() => editor.tf.h2.toggle()} title="Heading 2">H2</button>
          <button className="tb" onClick={() => editor.tf.h3.toggle()} title="Heading 3">H3</button>
          <button className="tb" onClick={() => editor.tf.blockquote.toggle()} title="Blockquote">&ldquo;&rdquo;</button>
          <span className="doc-toolbar-sep" />

          <button className="tb" style={{ fontWeight: 700 }} onClick={() => editor.tf.toggleMark("bold")} title="Bold">B</button>
          <button className="tb" style={{ fontStyle: "italic" }} onClick={() => editor.tf.toggleMark("italic")} title="Italic">I</button>
          <button className="tb" style={{ textDecoration: "underline" }} onClick={() => editor.tf.toggleMark("underline")} title="Underline">U</button>
          <button className="tb" style={{ textDecoration: "line-through" }} onClick={() => editor.tf.toggleMark("strikethrough")} title="Strikethrough">S</button>
          <button className="tb" style={{ fontFamily: "monospace" }} onClick={() => editor.tf.toggleMark("code")} title="Code">{"</>"}</button>
          <span className="doc-toolbar-sep" />

          <button className="tb" onClick={() => editor.tf.textAlign.setNodes("left")} title="Align left">⯇</button>
          <button className="tb" onClick={() => editor.tf.textAlign.setNodes("center")} title="Align center">☰</button>
          <button className="tb" onClick={() => editor.tf.textAlign.setNodes("right")} title="Align right">⯈</button>
          <button className="tb" onClick={() => editor.tf.textAlign.setNodes("justify")} title="Justify">▤</button>
          <OutdentButton />
          <IndentButton />
          <span className="doc-toolbar-sep" />

          <button className="tb" onClick={() => toggleList(editor, { listStyleType: ListStyleType.Disc })} title="Bulleted list">•—</button>
          <button className="tb" onClick={() => toggleList(editor, { listStyleType: ListStyleType.Decimal })} title="Numbered list">1.—</button>
          <span className="doc-toolbar-sep" />

          <div className="doc-popover-wrap" onClick={(e) => e.stopPropagation()}>
            <button className="tb" title="Text color" onClick={(e) => openPopoverAt("color", e)}>
              A
            </button>
            {openPopover?.type === "color" && (
              <div className="doc-popover" style={{ position: "fixed", top: openPopover.top, left: openPopover.left }}>
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    className="doc-swatch"
                    style={{ background: c }}
                    onClick={() => {
                      editor.tf.color.addMark(c);
                      setOpenPopover(null);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="doc-popover-wrap" onClick={(e) => e.stopPropagation()}>
            <button className="tb" title="Highlight" onClick={(e) => openPopoverAt("highlight", e)}>
              ▧
            </button>
            {openPopover?.type === "highlight" && (
              <div className="doc-popover" style={{ position: "fixed", top: openPopover.top, left: openPopover.left }}>
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c}
                    className="doc-swatch"
                    style={{ background: c }}
                    onClick={() => {
                      editor.tf.backgroundColor.addMark(c);
                      setOpenPopover(null);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <button className="tb" onClick={handleInsertLink} title="Insert link">🔗</button>
          <button className="tb" onClick={() => insertTable(editor, { rowCount: 3, colCount: 3 })} title="Insert table">▦</button>
          <button className="tb" onClick={() => imageInputRef.current?.click()} title="Insert image">🖼</button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleImageChange}
          />

          <div className="doc-popover-wrap" onClick={(e) => e.stopPropagation()}>
            <button className="tb" title="Emoji" onClick={(e) => openPopoverAt("emoji", e)}>
              🙂
            </button>
            {openPopover?.type === "emoji" && (
              <div
                className="doc-popover doc-emoji-grid"
                style={{ position: "fixed", top: openPopover.top, left: openPopover.left }}
              >
                {EMOJIS.map((em) => (
                  <button
                    key={em}
                    className="doc-emoji-btn"
                    onClick={() => {
                      editor.tf.insertText(em);
                      setOpenPopover(null);
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="doc-topbar-right">
          {status && <span className="doc-status">{status}</span>}
          <button className="tb" onClick={handleDownloadDocx}>Download DOCX</button>
          <button className="tb" onClick={handleExportPdf} disabled={exportingPdf}>
            {exportingPdf ? "Exporting…" : "Export to PDF"}
          </button>
          <button className="tb primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button className="tb" onClick={() => navigate("/dashboard")}>Close</button>
        </div>
        </header>

        <div className="doc-page-wrap">
          <PlateContent className="doc-page" placeholder="Start typing…" />
        </div>
      </Plate>
    </div>
  );
}
