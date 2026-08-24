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

const EMOJIS = [
  "😀", "😂", "😊", "😍", "🤔", "😅", "🙌", "👍", "👎", "🙏",
  "🔥", "🎉", "✅", "❌", "⭐", "❤️", "💡", "📌", "📎", "⚠️"
];
const TEXT_COLORS = ["#1c2333", "#c81026", "#1d7a4c", "#2952cc", "#a8650d", "#7b3ee0"];
const HIGHLIGHT_COLORS = ["#fff3b0", "#ffd6d6", "#d4f4dd", "#d6e4ff", "#f0d6ff"];

const TEXT_STYLES = [
  { key: "h1", label: "Heading 1", icon: "H1" },
  { key: "h2", label: "Heading 2", icon: "H2" },
  { key: "h3", label: "Heading 3", icon: "H3" },
  { key: "blockquote", label: "Quote", icon: "❝" }
];

const ALIGN_OPTIONS = [
  { key: "left", label: "Align left" },
  { key: "center", label: "Align center" },
  { key: "right", label: "Align right" },
  { key: "justify", label: "Justify" }
];

const ICONS = {
  undo: <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />,
  redo: <path d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />,
  download: <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />,
  pdf: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
  bold: <path d="M6 4h6a3.5 3.5 0 0 1 0 7H6zM6 11h7a3.5 3.5 0 0 1 0 7H6z" />,
  italic: <path d="M10 4h6M6 20h6M13 4 9 20" />,
  underline: <><path d="M6 4v6a5 5 0 0 0 10 0V4" /><path d="M5 20h12" /></>,
  strike: <><path d="M6 12h11" /><path d="M8 6.5c1-1.2 2.6-2 4.2-2 2.4 0 4 1.2 4 3S15 10 12 10" /><path d="M8 17.5c1 1.2 2.6 2 4.2 2 2.4 0 4-1.2 4-3" /></>,
  code: <path d="m8 6-5 6 5 6M16 6l5 6-5 6" />,
  alignLeft: <><path d="M4 6h16M4 12h10M4 18h13" /></>,
  alignCenter: <><path d="M4 6h16M7 12h10M5 18h14" /></>,
  alignRight: <><path d="M4 6h16M10 12h10M7 18h13" /></>,
  alignJustify: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  bulletList: <><circle cx="5" cy="6" r="1.3" /><circle cx="5" cy="12" r="1.3" /><circle cx="5" cy="18" r="1.3" /><path d="M10 6h10M10 12h10M10 18h10" /></>,
  numberList: <><path d="M4 6h1.5M4 12h1.5M4 18h1.5" /><path d="M10 6h10M10 12h10M10 18h10" /></>,
  indent: <><path d="M4 6h16M10 12h10M4 18h16" /><path d="m4 10 3 2-3 2" /></>,
  outdent: <><path d="M4 6h16M10 12h10M4 18h16" /><path d="m7 10-3 2 3 2" /></>,
  link: <path d="M9 15 15 9M11 6l1-1a4 4 0 0 1 6 6l-1 1M13 18l-1 1a4 4 0 0 1-6-6l1-1" />,
  table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M9 4v16M15 4v16" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m21 16-5-5-4 4-3-3-6 6" /></>,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  close: <path d="M18 6 6 18M6 6l12 12" />
};

function Icon({ name, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}


// Small components so useIndentButton/useOutdentButton (real React hooks)
// can be called at the top level, not inside a plain click handler.
function IndentButton() {
  const { props } = useIndentButton();
  return (
    <button className="tb" title="Indent" {...props}>
      <Icon name="indent" />
    </button>
  );
}
function OutdentButton() {
  const { props } = useOutdentButton();
  return (
    <button className="tb" title="Outdent" {...props}>
      <Icon name="outdent" />
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

  function handleTextStyle(key) {
    if (key === "h1") editor.tf.h1.toggle();
    else if (key === "h2") editor.tf.h2.toggle();
    else if (key === "h3") editor.tf.h3.toggle();
    else if (key === "blockquote") editor.tf.blockquote.toggle();
    setOpenPopover(null);
  }

  function handleAlign(key) {
    editor.tf.textAlign.setNodes(key);
    setOpenPopover(null);
  }

  function handleInsertLink() {
    const url = window.prompt("Link URL:");
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
            <button className="tb" onClick={() => editor.undo()} title="Undo">
              <Icon name="undo" />
            </button>
            <button className="tb" onClick={() => editor.redo()} title="Redo">
              <Icon name="redo" />
            </button>
            <span className="doc-toolbar-sep" />

            <div className="doc-popover-wrap" onClick={(e) => e.stopPropagation()}>
              <button className="tb tb-wide" title="Text style" onClick={(e) => openPopoverAt("textstyle", e)}>
                Text <Icon name="chevronDown" size={13} />
              </button>
              {openPopover?.type === "textstyle" && (
                <div className="doc-popover doc-menu" style={{ position: "fixed", top: openPopover.top, left: openPopover.left }}>
                  {TEXT_STYLES.map((s) => (
                    <button key={s.key} className="doc-menu-item" onClick={() => handleTextStyle(s.key)}>
                      <span className="doc-menu-item-icon">{s.icon}</span> {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="doc-toolbar-sep" />

            <button className="tb" style={{ fontWeight: 700 }} onClick={() => editor.tf.toggleMark("bold")} title="Bold">
              <Icon name="bold" />
            </button>
            <button className="tb" onClick={() => editor.tf.toggleMark("italic")} title="Italic">
              <Icon name="italic" />
            </button>
            <button className="tb" onClick={() => editor.tf.toggleMark("underline")} title="Underline">
              <Icon name="underline" />
            </button>
            <button className="tb" onClick={() => editor.tf.toggleMark("strikethrough")} title="Strikethrough">
              <Icon name="strike" />
            </button>
            <button className="tb" onClick={() => editor.tf.toggleMark("code")} title="Code">
              <Icon name="code" />
            </button>
            <span className="doc-toolbar-sep" />

            <div className="doc-popover-wrap" onClick={(e) => e.stopPropagation()}>
              <button className="tb" title="Text color" onClick={(e) => openPopoverAt("color", e)}>
                <span style={{ fontWeight: 700 }}>A</span>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 11 6-6 4 4-6 6-4-4Z" /><path d="m5 21 3-3M13 15l-2 2 4 4 2-2" />
                </svg>
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
            <span className="doc-toolbar-sep" />

            <div className="doc-popover-wrap" onClick={(e) => e.stopPropagation()}>
              <button className="tb" title="Alignment" onClick={(e) => openPopoverAt("align", e)}>
                <Icon name="alignLeft" />
                <Icon name="chevronDown" size={13} />
              </button>
              {openPopover?.type === "align" && (
                <div className="doc-popover doc-menu-row" style={{ position: "fixed", top: openPopover.top, left: openPopover.left }}>
                  <button className="tb" title="Align left" onClick={() => handleAlign("left")}><Icon name="alignLeft" /></button>
                  <button className="tb" title="Align center" onClick={() => handleAlign("center")}><Icon name="alignCenter" /></button>
                  <button className="tb" title="Align right" onClick={() => handleAlign("right")}><Icon name="alignRight" /></button>
                  <button className="tb" title="Justify" onClick={() => handleAlign("justify")}><Icon name="alignJustify" /></button>
                </div>
              )}
            </div>

            <button className="tb" onClick={() => toggleList(editor, { listStyleType: ListStyleType.Disc })} title="Bulleted list">
              <Icon name="bulletList" />
            </button>
            <button className="tb" onClick={() => toggleList(editor, { listStyleType: ListStyleType.Decimal })} title="Numbered list">
              <Icon name="numberList" />
            </button>
            <OutdentButton />
            <IndentButton />
            <span className="doc-toolbar-sep" />

            <button className="tb" onClick={handleInsertLink} title="Insert link">
              <Icon name="link" />
            </button>
            <button className="tb" onClick={() => insertTable(editor, { rowCount: 3, colCount: 3 })} title="Insert table">
              <Icon name="table" />
            </button>
            <button className="tb" onClick={() => imageInputRef.current?.click()} title="Insert image">
              <Icon name="image" />
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleImageChange}
            />

            <div className="doc-popover-wrap" onClick={(e) => e.stopPropagation()}>
              <button className="tb" title="Emoji" onClick={(e) => openPopoverAt("emoji", e)}>
                <Icon name="smile" />
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
          <button className="tb tb-icon-label" onClick={handleDownloadDocx} title="Download as Word">
            <Icon name="download" /> .docx
          </button>
          <button className="tb tb-icon-label" onClick={handleExportPdf} disabled={exportingPdf} title="Export as PDF">
            <Icon name="pdf" /> {exportingPdf ? "Exporting…" : "PDF"}
          </button>
          <button className="tb primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button className="doc-close-btn" onClick={() => navigate("/dashboard")} title="Close">
            <Icon name="close" />
          </button>
        </div>
        </header>

        <div className="doc-page-wrap">
          <PlateContent className="doc-page" placeholder="Start typing…" />
        </div>
      </Plate>
    </div>
  );
}
