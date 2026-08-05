/*
 * pdf-to-docx.js
 *
 * Adds two buttons into the editor's own "Convert" ribbon tab — a natural
 * fit alongside its existing "Images → PDF" / "Text → PDF" conversions —
 * rather than floating anything on top of the client's UI. Reuses the
 * editor's own `.tb` / `.needdoc` classes verbatim, so these look and
 * behave exactly like buttons the client already built (same font,
 * spacing, disabled state while no document is open).
 *
 * Not to be confused with the existing, separate "Export to Word" button
 * under the Comment tab (#b-expcomments) — that one exports annotations/
 * comments only and is untouched here.
 *
 * Loaded as a module so it can `import` the vendored pdf.js build. See
 * pdf-editor.html for why window.pdfjsLib / window.pdfjsWorker get
 * snapshotted and restored around this import.
 */
import * as pdfjsLib from "./vendor/pdf.min.mjs";

if (window.__editorPdfjsLib) window.pdfjsLib = window.__editorPdfjsLib;
if (window.__editorPdfjsWorker) window.pdfjsWorker = window.__editorPdfjsWorker;

pdfjsLib.GlobalWorkerOptions.workerSrc = "/editor/vendor/pdf.worker.min.mjs";

async function extractTextByPage(bytes) {
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ");
    pages.push(text);
  }
  return pages;
}

async function buildDocxBlob(pages) {
  const { Document, Packer, Paragraph } = window.docx;
  const children = pages.map(
    (text, idx) => new Paragraph({ text: text || " ", pageBreakBefore: idx > 0 })
  );
  const doc = new Document({
    sections: [{ children: children.length ? children : [new Paragraph("")] }]
  });
  return Packer.toBlob(doc);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function makeRibbonButton({ id, label, title }) {
  const btn = document.createElement("button");
  btn.className = "tb needdoc";
  btn.id = id;
  btn.title = title;
  btn.textContent = label;
  btn.disabled = !(window.PDFStudio && window.PDFStudio.state && window.PDFStudio.state.doc);
  return btn;
}

function injectConvertButtons() {
  const convertGroup = document.querySelector('.rgroup[data-tab="convert"]');
  if (!convertGroup) {
    console.error("[pdf-to-docx] Couldn't find the Convert tab to attach to.");
    return;
  }

  const wordBtn = makeRibbonButton({
    id: "b-pdf2word",
    label: "PDF → Word",
    title: "Convert this PDF to an editable Word document"
  });
  const downloadBtn = makeRibbonButton({
    id: "b-download-copy",
    label: "Download PDF",
    title: "Download a copy of this PDF to your computer"
  });

  convertGroup.append(wordBtn, downloadBtn);

  wordBtn.addEventListener("click", async () => {
    const studio = window.PDFStudio;
    if (!studio || !studio.state || !studio.state.doc) return;

    const original = wordBtn.textContent;
    wordBtn.textContent = "Converting…";
    wordBtn.disabled = true;
    try {
      const bytes = await studio.bakeAll();
      const pages = await extractTextByPage(bytes);
      const blob = await buildDocxBlob(pages);
      const base = (studio.baseName && studio.baseName()) || "document";
      downloadBlob(blob, `${base}.docx`);
    } catch (err) {
      console.error(err);
      alert("Couldn't convert this PDF to Word: " + err.message);
    } finally {
      wordBtn.textContent = original;
      wordBtn.disabled = false;
    }
  });

  downloadBtn.addEventListener("click", async () => {
    const studio = window.PDFStudio;
    if (!studio || !studio.state || !studio.state.doc) return;

    const original = downloadBtn.textContent;
    downloadBtn.textContent = "Preparing…";
    downloadBtn.disabled = true;
    try {
      // Bakes in whatever's currently on screen, including unsaved edits —
      // a local download, separate from Save (which persists to
      // Supabase Storage).
      const bytes = await studio.bakeAll();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const base = (studio.baseName && studio.baseName()) || "document";
      downloadBlob(blob, `${base}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Couldn't download this PDF: " + err.message);
    } finally {
      downloadBtn.textContent = original;
      downloadBtn.disabled = false;
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectConvertButtons);
} else {
  injectConvertButtons();
}
