import { useState } from "react";
import Navbar from "../components/Navbar";
import ConversionModal from "../components/ConversionModal";

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

// acceptList drives both the <input accept> attribute and client-side
// validation in ConversionModal — kept as an array of extensions so both
// can just join/check it directly.
const TOOLS = [
  {
    slug: "word-to-pdf",
    label: "Word to PDF",
    sub: ".docx → .pdf",
    color: "blue",
    icon: DOC_ICON,
    acceptList: [".doc", ".docx"],
    outputExt: ".pdf"
  },
  {
    slug: "pptx-to-pdf",
    label: "PowerPoint to PDF",
    sub: ".pptx → .pdf",
    color: "orange",
    icon: DOC_ICON,
    acceptList: [".ppt", ".pptx"],
    outputExt: ".pdf"
  },
  {
    slug: "excel-to-pdf",
    label: "Excel to PDF",
    sub: ".xlsx → .pdf",
    color: "green",
    icon: DOC_ICON,
    acceptList: [".xls", ".xlsx"],
    outputExt: ".pdf"
  },
  {
    slug: "pdf-to-word",
    label: "PDF to Word",
    sub: ".pdf → .docx",
    color: "red",
    icon: SWAP_ICON,
    acceptList: [".pdf"],
    outputExt: ".docx"
  },
  {
    slug: "pdf-to-pptx",
    label: "PDF to PowerPoint",
    sub: ".pdf → .pptx",
    color: "red",
    icon: SWAP_ICON,
    acceptList: [".pdf"],
    outputExt: ".pptx"
  }
];

export default function Convert() {
  const [activeTool, setActiveTool] = useState(null);

  return (
    <div className="app-shell">
      <Navbar />
      <div className="dash-body">
        <div className="dash-head">
          <div>
            <h1>Convert</h1>
            <p>Nothing here is saved — download your file before you leave the page.</p>
          </div>
        </div>

        <div className="convert-tools-grid">
          {TOOLS.map((tool) => (
            <button
              key={tool.slug}
              className="tool-tile"
              onClick={() => setActiveTool(tool)}
            >
              <div className={`tool-tile-icon tool-color-${tool.color}`}>{tool.icon}</div>
              <span className="tool-tile-label">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeTool && (
        <ConversionModal tool={activeTool} onClose={() => setActiveTool(null)} />
      )}
    </div>
  );
}
