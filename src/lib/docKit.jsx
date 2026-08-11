// Shared Plate.js configuration — the same plugin set is used both by the
// live editor (DocEditor.jsx) and by the standalone import/export helpers
// (docConversion.js), since DOCX import/export accuracy depends on the
// editor knowing about the same node types either way.
//
// Deliberately built by hand rather than via Plate's shadcn/Tailwind CLI
// kits — this project uses plain CSS (theme.css), not Tailwind.
import { PlateElement, PlateLeaf } from "platejs/react";
import {
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
  CodePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  BlockquotePlugin
} from "@platejs/basic-nodes/react";
import {
  TextAlignPlugin,
  FontColorPlugin,
  FontBackgroundColorPlugin
} from "@platejs/basic-styles/react";
import { IndentPlugin } from "@platejs/indent/react";
import { LinkPlugin } from "@platejs/link/react";
import { ListPlugin } from "@platejs/list/react";
import { ListStyleType } from "@platejs/list";
import {
  TablePlugin,
  TableRowPlugin,
  TableCellPlugin,
  TableCellHeaderPlugin
} from "@platejs/table/react";
import { ImagePlugin } from "@platejs/media/react";

// Align/indent apply to any block element, so every block component reads
// these two shared props the same way rather than duplicating the logic.
function blockStyle(element) {
  return {
    textAlign: element.align || undefined,
    marginLeft: element.indent ? `${element.indent * 24}px` : undefined
  };
}

const H1Element = (props) => (
  <PlateElement {...props} as="h1" className="doc-h1" style={blockStyle(props.element)} />
);
const H2Element = (props) => (
  <PlateElement {...props} as="h2" className="doc-h2" style={blockStyle(props.element)} />
);
const H3Element = (props) => (
  <PlateElement {...props} as="h3" className="doc-h3" style={blockStyle(props.element)} />
);
const BlockquoteElement = (props) => (
  <PlateElement
    {...props}
    as="blockquote"
    className="doc-blockquote"
    style={blockStyle(props.element)}
  />
);

const BoldLeaf = (props) => <PlateLeaf {...props} as="strong" />;
const ItalicLeaf = (props) => <PlateLeaf {...props} as="em" />;
const UnderlineLeaf = (props) => <PlateLeaf {...props} as="u" />;
const StrikethroughLeaf = (props) => <PlateLeaf {...props} as="s" />;
const CodeLeaf = (props) => <PlateLeaf {...props} as="code" className="doc-code" />;
const ColorLeaf = (props) => (
  <PlateLeaf {...props} as="span" style={{ color: props.leaf.color }} />
);
const BgColorLeaf = (props) => (
  <PlateLeaf {...props} as="span" style={{ backgroundColor: props.leaf.backgroundColor }} />
);

const LinkElement = (props) => (
  <PlateElement
    {...props}
    as="a"
    className="doc-link"
    href={props.element.url}
    target="_blank"
    rel="noopener noreferrer"
  />
);

// Indent-list model: bulleted/numbered items are regular blocks carrying
// listStyleType + indent props, not real nested <ul>/<ol>/<li> — the
// marker itself is CSS-driven (see .doc-list-item::before in theme.css).
const ListItemElement = (props) => {
  const { element } = props;
  const isOrdered = element.listStyleType === ListStyleType.Decimal;
  return (
    <PlateElement
      {...props}
      as="div"
      className={`doc-list-item ${isOrdered ? "doc-list-ordered" : "doc-list-bulleted"}`}
      style={blockStyle(element)}
    />
  );
};

const TableElement = (props) => (
  <table {...props.attributes} className="doc-table">
    <tbody>{props.children}</tbody>
  </table>
);
const TableRowElement = (props) => <PlateElement {...props} as="tr" />;
const TableCellElement = (props) => (
  <PlateElement {...props} as="td" className="doc-td" />
);
const TableCellHeaderElement = (props) => (
  <PlateElement {...props} as="th" className="doc-th" />
);

const ImageElement = (props) => (
  <PlateElement {...props} as="figure" className="doc-image-wrap">
    <img src={props.element.url} alt={props.element.alt || ""} className="doc-image" />
    {props.children}
  </PlateElement>
);

export function makeDocEditorPlugins({ uploadImage } = {}) {
  return [
    H1Plugin.withComponent(H1Element),
    H2Plugin.withComponent(H2Element),
    H3Plugin.withComponent(H3Element),
    BlockquotePlugin.withComponent(BlockquoteElement),
    BoldPlugin.withComponent(BoldLeaf),
    ItalicPlugin.withComponent(ItalicLeaf),
    UnderlinePlugin.withComponent(UnderlineLeaf),
    StrikethroughPlugin.withComponent(StrikethroughLeaf),
    CodePlugin.withComponent(CodeLeaf),
    TextAlignPlugin.configure({
      inject: { targetPlugins: ["p", "h1", "h2", "h3", "blockquote", "list"] }
    }),
    IndentPlugin.configure({
      inject: { targetPlugins: ["p", "h1", "h2", "h3", "blockquote"] }
    }),
    FontColorPlugin.withComponent(ColorLeaf),
    FontBackgroundColorPlugin.withComponent(BgColorLeaf),
    LinkPlugin.withComponent(LinkElement),
    ListPlugin.withComponent(ListItemElement),
    TablePlugin.withComponent(TableElement),
    TableRowPlugin.withComponent(TableRowElement),
    TableCellPlugin.withComponent(TableCellElement),
    TableCellHeaderPlugin.withComponent(TableCellHeaderElement),
    ImagePlugin.configure({
      options: uploadImage ? { uploadImage } : {}
    }).withComponent(ImageElement)
  ];
}

// Default instance (no real upload capability) — used by docConversion.js's
// temporary, non-interactive editors for import/export/serialization,
// where nothing ever actually triggers an image upload.
export const docEditorPlugins = makeDocEditorPlugins();

export { ListStyleType };
