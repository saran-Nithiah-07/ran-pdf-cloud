import { createPlateEditor } from "platejs/react";
import { importDocx, exportToDocx, downloadDocx } from "@platejs/docx-io";
import { serializeHtml } from "platejs/static";
import html2pdf from "html2pdf.js";
import { docEditorPlugins } from "./docKit.jsx";

const EMPTY_VALUE = [{ type: "p", children: [{ text: "" }] }];

function makeTempEditor(value) {
  // A non-mounted editor instance, used purely for schema-aware
  // import/export/serialization — same plugin set as the real editor so
  // DOCX round-trips and HTML serialization stay accurate. See Plate's
  // own docs pattern for this ("Accessing the Editor" / temporary editor).
  return createPlateEditor({ plugins: docEditorPlugins, value: value || EMPTY_VALUE });
}

/** Import DOCX bytes into a Plate value (array of nodes). */
export async function docxBytesToPlateValue(arrayBuffer) {
  const editor = makeTempEditor();
  const result = await importDocx(editor, arrayBuffer);
  return result.nodes && result.nodes.length ? result.nodes : EMPTY_VALUE;
}

/** Export a Plate value back to a DOCX Blob. */
export async function plateValueToDocxBlob(value) {
  return exportToDocx(value, { editorPlugins: docEditorPlugins });
}

export { downloadDocx };

/** Export a Plate value to a PDF Blob via HTML serialization + html2pdf. */
export async function plateValueToPdfBlob(value, title) {
  const editor = makeTempEditor(value);
  const html = await serializeHtml(editor, { plugins: docEditorPlugins });

  const container = document.createElement("div");
  container.innerHTML = `<h1 style="font-size:20px;margin-bottom:12px">${
    title ? escapeHtml(title) : ""
  }</h1>${html}`;
  container.style.padding = "24px";
  container.style.fontFamily = "Arial, Helvetica, sans-serif";
  container.style.color = "#1c2333";

  const blob = await html2pdf()
    .from(container)
    .set({
      margin: 10,
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    })
    .outputPdf("blob");

  return blob;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
