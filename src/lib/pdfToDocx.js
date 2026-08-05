import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Document, Packer, Paragraph } from "docx";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// v1: text-extraction based conversion. Pulls each page's text out of the
// PDF and lays it out as one paragraph per page in the resulting .docx.
// This preserves the words and page breaks, not exact visual layout
// (columns, precise positioning, tables) — see README for the tradeoff
// against a paid layout-preserving conversion API.
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
  const children = [];
  pages.forEach((text, idx) => {
    children.push(
      new Paragraph({
        text: text || " ",
        pageBreakBefore: idx > 0
      })
    );
  });

  const doc = new Document({
    sections: [{ children: children.length ? children : [new Paragraph("")] }]
  });

  return Packer.toBlob(doc);
}

export async function convertPdfBytesToDocx(bytes) {
  const pages = await extractTextByPage(bytes);
  return buildDocxBlob(pages);
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
