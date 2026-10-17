"use strict";
var BloomEngine = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/bloom-entry.ts
  var bloom_entry_exports = {};
  __export(bloom_entry_exports, {
    PDFNumber: () => PDFNumber,
    applyTextEdits: () => applyTextEdits,
    findAndReplace: () => findAndReplace,
    findTextInPage: () => findTextInPage,
    getPageContentBytes: () => getPageContentBytes,
    parsePDF: () => parsePDF,
    resolveRef: () => resolveRef,
    serializeDocument: () => serializeDocument
  });

  // src/engine/parser/lexer.ts
  var SPACE = 32;
  var TAB = 9;
  var LF = 10;
  var CR = 13;
  var FF = 12;
  var NULL_BYTE = 0;
  var LPAREN = 40;
  var RPAREN = 41;
  var LANGLE = 60;
  var RANGLE = 62;
  var LBRACKET = 91;
  var RBRACKET = 93;
  var LBRACE = 123;
  var RBRACE = 125;
  var SLASH = 47;
  var PERCENT = 37;
  var BACKSLASH = 92;
  var HASH = 35;
  var PLUS = 43;
  var MINUS = 45;
  var DOT = 46;
  function isWhitespace(ch) {
    return ch === SPACE || ch === TAB || ch === LF || ch === CR || ch === FF || ch === NULL_BYTE;
  }
  function isDelimiter(ch) {
    return ch === LPAREN || ch === RPAREN || ch === LANGLE || ch === RANGLE || ch === LBRACKET || ch === RBRACKET || ch === LBRACE || ch === RBRACE || ch === SLASH || ch === PERCENT;
  }
  function isDigit(ch) {
    return ch >= 48 && ch <= 57;
  }
  function isHexDigit(ch) {
    return ch >= 48 && ch <= 57 || // '0'-'9'
    ch >= 65 && ch <= 70 || // 'A'-'F'
    ch >= 97 && ch <= 102;
  }
  function isEOL(ch) {
    return ch === LF || ch === CR;
  }
  var PDFLexer = class {
    constructor(data, startOffset = 0) {
      this.data = data;
      this.pos = startOffset;
      this.length = data.length;
    }
    /** Current byte position */
    get position() {
      return this.pos;
    }
    set position(p) {
      this.pos = p;
    }
    /** Whether we've reached the end of the data */
    get isEOF() {
      return this.pos >= this.length;
    }
    /** Peek at current byte without advancing */
    peek() {
      return this.pos < this.length ? this.data[this.pos] : -1;
    }
    /** Peek at byte at an offset from current position */
    peekAt(offset) {
      const idx = this.pos + offset;
      return idx < this.length ? this.data[idx] : -1;
    }
    /** Read current byte and advance */
    read() {
      return this.pos < this.length ? this.data[this.pos++] : -1;
    }
    /** Skip all whitespace and comments */
    skipWhitespaceAndComments() {
      while (this.pos < this.length) {
        const ch = this.data[this.pos];
        if (isWhitespace(ch)) {
          this.pos++;
          continue;
        }
        if (ch === PERCENT) {
          this.pos++;
          while (this.pos < this.length && !isEOL(this.data[this.pos])) {
            this.pos++;
          }
          continue;
        }
        break;
      }
    }
    /** Skip only whitespace (not comments) */
    skipWhitespace() {
      while (this.pos < this.length && isWhitespace(this.data[this.pos])) {
        this.pos++;
      }
    }
    /**
     * Read the next token from the byte stream.
     * Returns null at EOF.
     */
    nextToken() {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.length) {
        return { type: "EOF" /* EOF */, value: null, offset: this.pos };
      }
      const offset = this.pos;
      const ch = this.data[this.pos];
      if (ch === LPAREN) return this.readLiteralString(offset);
      if (ch === LANGLE) {
        if (this.peekAt(1) === LANGLE) {
          this.pos += 2;
          return { type: "Keyword" /* Keyword */, value: "<<", offset };
        }
        return this.readHexString(offset);
      }
      if (ch === RANGLE) {
        if (this.peekAt(1) === RANGLE) {
          this.pos += 2;
          return { type: "Keyword" /* Keyword */, value: ">>", offset };
        }
        this.pos++;
        return { type: "Keyword" /* Keyword */, value: ">", offset };
      }
      if (ch === LBRACKET) {
        this.pos++;
        return { type: "Keyword" /* Keyword */, value: "[", offset };
      }
      if (ch === RBRACKET) {
        this.pos++;
        return { type: "Keyword" /* Keyword */, value: "]", offset };
      }
      if (ch === SLASH) return this.readName(offset);
      if (isDigit(ch) || ch === PLUS || ch === MINUS || ch === DOT) {
        return this.readNumber(offset);
      }
      return this.readKeyword(offset);
    }
    // ─── Literal string: (...)  ───────────────────────────────────────────────
    readLiteralString(offset) {
      this.pos++;
      let depth = 1;
      let result = "";
      while (this.pos < this.length && depth > 0) {
        const ch = this.data[this.pos];
        if (ch === BACKSLASH) {
          this.pos++;
          if (this.pos >= this.length) break;
          const esc = this.data[this.pos];
          switch (esc) {
            case 110:
              result += "\n";
              this.pos++;
              break;
            // \n
            case 114:
              result += "\r";
              this.pos++;
              break;
            // \r
            case 116:
              result += "	";
              this.pos++;
              break;
            // \t
            case 98:
              result += "\b";
              this.pos++;
              break;
            // \b
            case 102:
              result += "\f";
              this.pos++;
              break;
            // \f
            case LPAREN:
              result += "(";
              this.pos++;
              break;
            // \(
            case RPAREN:
              result += ")";
              this.pos++;
              break;
            // \)
            case BACKSLASH:
              result += "\\";
              this.pos++;
              break;
            // \\
            case CR:
              this.pos++;
              if (this.pos < this.length && this.data[this.pos] === LF) this.pos++;
              break;
            case LF:
              this.pos++;
              break;
            default:
              if (esc >= 48 && esc <= 55) {
                let octal = esc - 48;
                this.pos++;
                if (this.pos < this.length && this.data[this.pos] >= 48 && this.data[this.pos] <= 55) {
                  octal = octal * 8 + (this.data[this.pos] - 48);
                  this.pos++;
                  if (this.pos < this.length && this.data[this.pos] >= 48 && this.data[this.pos] <= 55) {
                    octal = octal * 8 + (this.data[this.pos] - 48);
                    this.pos++;
                  }
                }
                result += String.fromCharCode(octal & 255);
              } else {
                result += String.fromCharCode(esc);
                this.pos++;
              }
              break;
          }
          continue;
        }
        if (ch === LPAREN) {
          depth++;
          result += "(";
          this.pos++;
          continue;
        }
        if (ch === RPAREN) {
          depth--;
          if (depth > 0) {
            result += ")";
          }
          this.pos++;
          continue;
        }
        if (ch === CR) {
          result += "\n";
          this.pos++;
          if (this.pos < this.length && this.data[this.pos] === LF) this.pos++;
          continue;
        }
        result += String.fromCharCode(ch);
        this.pos++;
      }
      return { type: "String" /* String */, value: result, offset };
    }
    // ─── Hex string: <...> ───────────────────────────────────────────────────
    readHexString(offset) {
      this.pos++;
      let hex = "";
      while (this.pos < this.length) {
        const ch = this.data[this.pos];
        if (ch === RANGLE) {
          this.pos++;
          break;
        }
        if (isWhitespace(ch)) {
          this.pos++;
          continue;
        }
        if (isHexDigit(ch)) {
          hex += String.fromCharCode(ch);
          this.pos++;
        } else {
          this.pos++;
        }
      }
      return { type: "HexString" /* HexString */, value: hex, offset };
    }
    // ─── Name object: /Name ──────────────────────────────────────────────────
    readName(offset) {
      this.pos++;
      let name = "";
      while (this.pos < this.length) {
        const ch = this.data[this.pos];
        if (isWhitespace(ch) || isDelimiter(ch)) break;
        if (ch === HASH && this.pos + 2 < this.length) {
          const h1 = this.data[this.pos + 1];
          const h2 = this.data[this.pos + 2];
          if (isHexDigit(h1) && isHexDigit(h2)) {
            const hex = String.fromCharCode(h1) + String.fromCharCode(h2);
            name += String.fromCharCode(parseInt(hex, 16));
            this.pos += 3;
            continue;
          }
        }
        name += String.fromCharCode(ch);
        this.pos++;
      }
      return { type: "Name" /* Name */, value: name, offset };
    }
    // ─── Number (integer or real) ─────────────────────────────────────────────
    readNumber(offset) {
      let numStr = "";
      let isReal = false;
      const startPos = this.pos;
      if (this.data[this.pos] === PLUS || this.data[this.pos] === MINUS) {
        numStr += String.fromCharCode(this.data[this.pos]);
        this.pos++;
      }
      if (this.pos < this.length && !isDigit(this.data[this.pos]) && this.data[this.pos] !== DOT) {
        this.pos = startPos;
        return this.readKeyword(offset);
      }
      while (this.pos < this.length && isDigit(this.data[this.pos])) {
        numStr += String.fromCharCode(this.data[this.pos]);
        this.pos++;
      }
      if (this.pos < this.length && this.data[this.pos] === DOT) {
        isReal = true;
        numStr += ".";
        this.pos++;
        while (this.pos < this.length && isDigit(this.data[this.pos])) {
          numStr += String.fromCharCode(this.data[this.pos]);
          this.pos++;
        }
      }
      if (numStr === "." || numStr === "+." || numStr === "-.") {
        this.pos = startPos;
        return this.readKeyword(offset);
      }
      const num = isReal ? parseFloat(numStr) : parseInt(numStr, 10);
      return {
        type: isReal ? "Real" /* Real */ : "Integer" /* Integer */,
        value: num,
        offset
      };
    }
    // ─── Keyword / boolean / null ─────────────────────────────────────────────
    readKeyword(offset) {
      let word = "";
      while (this.pos < this.length) {
        const ch = this.data[this.pos];
        if (isWhitespace(ch) || isDelimiter(ch)) break;
        word += String.fromCharCode(ch);
        this.pos++;
      }
      if (word === "true") return { type: "Boolean" /* Boolean */, value: true, offset };
      if (word === "false") return { type: "Boolean" /* Boolean */, value: false, offset };
      if (word === "null") return { type: "Null" /* Null */, value: null, offset };
      return { type: "Keyword" /* Keyword */, value: word, offset };
    }
    // ─── Utility methods for the parser ───────────────────────────────────────
    /**
     * Read raw bytes from the current position.
     * Used for reading stream data after the 'stream' keyword.
     */
    readBytes(count) {
      const end = Math.min(this.pos + count, this.length);
      const bytes = this.data.slice(this.pos, end);
      this.pos = end;
      return bytes;
    }
    /**
     * Skip past the EOL after the 'stream' keyword.
     * Per PDF spec: "stream" keyword is followed by a single EOL (CR, LF, or CRLF).
     */
    skipStreamEOL() {
      if (this.pos < this.length && this.data[this.pos] === CR) {
        this.pos++;
        if (this.pos < this.length && this.data[this.pos] === LF) {
          this.pos++;
        }
      } else if (this.pos < this.length && this.data[this.pos] === LF) {
        this.pos++;
      }
    }
    /**
     * Search backwards from `startPos` for a string pattern.
     * Returns the byte offset where the pattern starts, or -1.
     */
    searchBackward(pattern, startPos) {
      const start = startPos ?? this.length - 1;
      const patternBytes = new Uint8Array(pattern.length);
      for (let i = 0; i < pattern.length; i++) {
        patternBytes[i] = pattern.charCodeAt(i);
      }
      outer:
        for (let i = start; i >= 0; i--) {
          for (let j = 0; j < patternBytes.length; j++) {
            if (i + j >= this.length || this.data[i + j] !== patternBytes[j]) {
              continue outer;
            }
          }
          return i;
        }
      return -1;
    }
    /**
     * Search forward from current position for a string pattern.
     * Returns the byte offset where the pattern starts, or -1.
     */
    searchForward(pattern, startPos) {
      const start = startPos ?? this.pos;
      const patternBytes = new Uint8Array(pattern.length);
      for (let i = 0; i < pattern.length; i++) {
        patternBytes[i] = pattern.charCodeAt(i);
      }
      const limit = this.length - patternBytes.length;
      outer:
        for (let i = start; i <= limit; i++) {
          for (let j = 0; j < patternBytes.length; j++) {
            if (this.data[i + j] !== patternBytes[j]) continue outer;
          }
          return i;
        }
      return -1;
    }
    /**
     * Read a line of text (up to EOL) from current position.
     * Useful for reading the PDF header line.
     */
    readLine() {
      let line = "";
      while (this.pos < this.length) {
        const ch = this.data[this.pos];
        if (ch === CR) {
          this.pos++;
          if (this.pos < this.length && this.data[this.pos] === LF) this.pos++;
          break;
        }
        if (ch === LF) {
          this.pos++;
          break;
        }
        line += String.fromCharCode(ch);
        this.pos++;
      }
      return line;
    }
    /**
     * Read a chunk of ASCII text for debug/inspection purposes.
     */
    peekString(maxLen = 40) {
      let s = "";
      const end = Math.min(this.pos + maxLen, this.length);
      for (let i = this.pos; i < end; i++) {
        const ch = this.data[i];
        s += ch >= 32 && ch <= 126 ? String.fromCharCode(ch) : ".";
      }
      return s;
    }
  };

  // src/engine/types.ts
  var PDFName = class {
    constructor(name) {
      this.name = name;
      this._tag = "PDFName";
    }
    toString() {
      return `/${this.name}`;
    }
    equals(other) {
      return this.name === other.name;
    }
  };
  var PDFString = class {
    constructor(value) {
      this.value = value;
      this._tag = "PDFString";
    }
    /** Raw bytes (for binary strings). Stores decoded bytes. */
    toBytes() {
      const bytes = new Uint8Array(this.value.length);
      for (let i = 0; i < this.value.length; i++) {
        bytes[i] = this.value.charCodeAt(i) & 255;
      }
      return bytes;
    }
    toString() {
      return `(${this.value})`;
    }
  };
  var PDFHexString = class {
    constructor(hex) {
      this.hex = hex;
      this._tag = "PDFHexString";
    }
    /** Decode hex string to raw bytes */
    toBytes() {
      const clean = this.hex.replace(/\s/g, "");
      const padded = clean.length % 2 === 1 ? clean + "0" : clean;
      const bytes = new Uint8Array(padded.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(padded.substring(i * 2, i * 2 + 2), 16);
      }
      return bytes;
    }
    /** Decode hex pairs to a string (latin-1) */
    toText() {
      const bytes = this.toBytes();
      let s = "";
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return s;
    }
    toString() {
      return `<${this.hex}>`;
    }
  };
  var PDFNumber = class {
    constructor(value) {
      this.value = value;
      this._tag = "PDFNumber";
    }
    toString() {
      return String(this.value);
    }
  };
  var PDFBoolean = class {
    constructor(value) {
      this.value = value;
      this._tag = "PDFBoolean";
    }
    toString() {
      return this.value ? "true" : "false";
    }
  };
  var PDFNull = class _PDFNull {
    constructor() {
      this._tag = "PDFNull";
    }
    static {
      this._instance = null;
    }
    static get instance() {
      if (!_PDFNull._instance) _PDFNull._instance = new _PDFNull();
      return _PDFNull._instance;
    }
    toString() {
      return "null";
    }
  };
  var PDFRef = class {
    constructor(objNum, genNum) {
      this.objNum = objNum;
      this.genNum = genNum;
      this._tag = "PDFRef";
    }
    toKey() {
      return `${this.objNum}_${this.genNum}`;
    }
    toString() {
      return `${this.objNum} ${this.genNum} R`;
    }
    equals(other) {
      return this.objNum === other.objNum && this.genNum === other.genNum;
    }
  };
  var PDFArray = class {
    constructor(items = []) {
      this.items = items;
      this._tag = "PDFArray";
    }
    get length() {
      return this.items.length;
    }
    get(index) {
      return this.items[index];
    }
    push(item) {
      this.items.push(item);
    }
    /** Helper: get all items as numbers (returns NaN for non-numbers) */
    asNumbers() {
      return this.items.map(
        (it) => it instanceof PDFNumber ? it.value : NaN
      );
    }
    toString() {
      return `[${this.items.map(String).join(" ")}]`;
    }
  };
  var PDFDict = class _PDFDict {
    constructor(entries) {
      this._tag = "PDFDict";
      this.map = new Map(entries);
    }
    get(key) {
      return this.map.get(key);
    }
    set(key, value) {
      this.map.set(key, value);
    }
    has(key) {
      return this.map.has(key);
    }
    delete(key) {
      return this.map.delete(key);
    }
    entries() {
      return this.map.entries();
    }
    keys() {
      return this.map.keys();
    }
    values() {
      return this.map.values();
    }
    get size() {
      return this.map.size;
    }
    // ── Typed accessors for common patterns ──
    /** Resolve a key expecting a PDFName, return the name string or undefined */
    getName(key) {
      const v = this.map.get(key);
      return v instanceof PDFName ? v.name : void 0;
    }
    /** Resolve a key expecting a PDFNumber, return the number or undefined */
    getNumber(key) {
      const v = this.map.get(key);
      return v instanceof PDFNumber ? v.value : void 0;
    }
    /** Resolve a key expecting a PDFBoolean */
    getBool(key) {
      const v = this.map.get(key);
      return v instanceof PDFBoolean ? v.value : void 0;
    }
    /** Resolve a key expecting a PDFArray */
    getArray(key) {
      const v = this.map.get(key);
      return v instanceof PDFArray ? v : void 0;
    }
    /** Resolve a key expecting a PDFDict */
    getDict(key) {
      const v = this.map.get(key);
      return v instanceof _PDFDict ? v : void 0;
    }
    /** Resolve a key that should be a PDFString or PDFHexString, return text */
    getString(key) {
      const v = this.map.get(key);
      if (v instanceof PDFString) return v.value;
      if (v instanceof PDFHexString) return v.toText();
      return void 0;
    }
    /** Resolve a key that may be a PDFRef */
    getRef(key) {
      const v = this.map.get(key);
      return v instanceof PDFRef ? v : void 0;
    }
    toString() {
      const entries = [];
      Array.from(this.map.entries()).forEach(([k, v]) => entries.push(`/${k} ${v}`));
      return `<< ${entries.join(" ")} >>`;
    }
  };
  var PDFStream = class {
    constructor(dict, rawBytes, decodedBytes = null) {
      this.dict = dict;
      this.rawBytes = rawBytes;
      this.decodedBytes = decodedBytes;
      this._tag = "PDFStream";
    }
    /** Get the effective bytes (decoded if available, raw otherwise) */
    getBytes() {
      return this.decodedBytes ?? this.rawBytes;
    }
    /** Length from the dictionary (pre-decode) */
    get length() {
      return this.dict.getNumber("Length") ?? this.rawBytes.length;
    }
    /** Filter names */
    getFilters() {
      const f = this.dict.get("Filter");
      if (f instanceof PDFName) return [f.name];
      if (f instanceof PDFArray) {
        return f.items.filter((it) => it instanceof PDFName).map((n) => n.name);
      }
      return [];
    }
    /** Decode parameters (array of dicts, one per filter) */
    getDecodeParams() {
      const dp = this.dict.get("DecodeParms");
      if (dp instanceof PDFDict) return [dp];
      if (dp instanceof PDFArray) {
        return dp.items.map((it) => it instanceof PDFDict ? it : null);
      }
      if (dp instanceof PDFNull) return [null];
      return [];
    }
  };

  // src/engine/parser/filters.ts
  async function applyFilters(data, filterNames, decodeParams) {
    let result = data;
    for (let i = 0; i < filterNames.length; i++) {
      const filterName = filterNames[i];
      const params = decodeParams[i] ?? null;
      switch (filterName) {
        case "FlateDecode":
        case "Fl":
          result = await flateDecode(result);
          result = applyPredictor(result, params);
          break;
        case "ASCIIHexDecode":
        case "AHx":
          result = asciiHexDecode(result);
          break;
        case "ASCII85Decode":
        case "A85":
          result = ascii85Decode(result);
          break;
        case "LZWDecode":
        case "LZW":
          result = lzwDecode(result, params);
          result = applyPredictor(result, params);
          break;
        case "RunLengthDecode":
        case "RL":
          result = runLengthDecode(result);
          break;
        case "DCTDecode":
        case "DCT":
          break;
        case "JPXDecode":
          break;
        case "CCITTFaxDecode":
        case "CCF":
          break;
        case "Crypt":
          break;
        default:
          console.warn(`[PDF Filter] Unknown filter: ${filterName}, passing through`);
      }
    }
    return result;
  }
  async function flateDecode(data) {
    if (typeof DecompressionStream !== "undefined") {
      try {
        return await nativeInflate(data, "deflate");
      } catch {
        try {
          return await nativeInflate(data, "raw");
        } catch {
        }
      }
    }
    return manualInflate(data);
  }
  async function nativeInflate(data, format) {
    const ds = new DecompressionStream(format);
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
    writer.write(data).catch(() => {
    });
    writer.close().catch(() => {
    });
    const chunks = [];
    let totalLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalLength += value.length;
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
  function manualInflate(data) {
    let pos = 0;
    let bitBuf = 0;
    let bitCount = 0;
    if (data.length >= 2) {
      const cmf = data[0];
      const flg = data[1];
      const cm = cmf & 15;
      if (cm === 8 && (cmf * 256 + flg) % 31 === 0) {
        pos = 2;
        if (flg & 32) pos += 4;
      }
    }
    const output = [];
    function readBits(n) {
      while (bitCount < n) {
        if (pos >= data.length) throw new Error("Unexpected end of deflate data");
        bitBuf |= data[pos++] << bitCount;
        bitCount += 8;
      }
      const val = bitBuf & (1 << n) - 1;
      bitBuf >>= n;
      bitCount -= n;
      return val;
    }
    function readByte() {
      bitBuf = 0;
      bitCount = 0;
      if (pos >= data.length) throw new Error("Unexpected end of deflate data");
      return data[pos++];
    }
    function buildFixedLitLenTree() {
      const lengths = new Uint8Array(288);
      for (let i = 0; i <= 143; i++) lengths[i] = 8;
      for (let i = 144; i <= 255; i++) lengths[i] = 9;
      for (let i = 256; i <= 279; i++) lengths[i] = 7;
      for (let i = 280; i <= 287; i++) lengths[i] = 8;
      return buildHuffmanTree(lengths);
    }
    function buildFixedDistTree() {
      const lengths = new Uint8Array(30);
      lengths.fill(5);
      return buildHuffmanTree(lengths);
    }
    const lengthBase = [
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      13,
      15,
      17,
      19,
      23,
      27,
      31,
      35,
      43,
      51,
      59,
      67,
      83,
      99,
      115,
      131,
      163,
      195,
      227,
      258
    ];
    const lengthExtra = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      1,
      1,
      1,
      2,
      2,
      2,
      2,
      3,
      3,
      3,
      3,
      4,
      4,
      4,
      4,
      5,
      5,
      5,
      5,
      0
    ];
    const distBase = [
      1,
      2,
      3,
      4,
      5,
      7,
      9,
      13,
      17,
      25,
      33,
      49,
      65,
      97,
      129,
      193,
      257,
      385,
      513,
      769,
      1025,
      1537,
      2049,
      3073,
      4097,
      6145,
      8193,
      12289,
      16385,
      24577
    ];
    const distExtra = [
      0,
      0,
      0,
      0,
      1,
      1,
      2,
      2,
      3,
      3,
      4,
      4,
      5,
      5,
      6,
      6,
      7,
      7,
      8,
      8,
      9,
      9,
      10,
      10,
      11,
      11,
      12,
      12,
      13,
      13
    ];
    function decodeSymbol(tree) {
      let node = tree.root;
      while (node.left || node.right) {
        const bit = readBits(1);
        node = bit ? node.right : node.left;
        if (!node) throw new Error("Invalid Huffman code");
      }
      return node.symbol;
    }
    let finalBlock = false;
    while (!finalBlock) {
      finalBlock = readBits(1) === 1;
      const blockType = readBits(2);
      if (blockType === 0) {
        bitBuf = 0;
        bitCount = 0;
        const len = data[pos] | data[pos + 1] << 8;
        pos += 2;
        pos += 2;
        for (let i = 0; i < len; i++) {
          output.push(data[pos++]);
        }
      } else if (blockType === 1) {
        const litLenTree = buildFixedLitLenTree();
        const distTree = buildFixedDistTree();
        inflateBlock(litLenTree, distTree);
      } else if (blockType === 2) {
        const hlit = readBits(5) + 257;
        const hdist = readBits(5) + 1;
        const hclen = readBits(4) + 4;
        const codeLenOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
        const codeLenLengths = new Uint8Array(19);
        for (let i = 0; i < hclen; i++) {
          codeLenLengths[codeLenOrder[i]] = readBits(3);
        }
        const codeLenTree = buildHuffmanTree(codeLenLengths);
        const lengths = new Uint8Array(hlit + hdist);
        let idx = 0;
        while (idx < hlit + hdist) {
          const sym = decodeSymbol(codeLenTree);
          if (sym < 16) {
            lengths[idx++] = sym;
          } else if (sym === 16) {
            const repeat = readBits(2) + 3;
            const prev = idx > 0 ? lengths[idx - 1] : 0;
            for (let i = 0; i < repeat; i++) lengths[idx++] = prev;
          } else if (sym === 17) {
            const repeat = readBits(3) + 3;
            for (let i = 0; i < repeat; i++) lengths[idx++] = 0;
          } else if (sym === 18) {
            const repeat = readBits(7) + 11;
            for (let i = 0; i < repeat; i++) lengths[idx++] = 0;
          }
        }
        const litLenLengths = lengths.slice(0, hlit);
        const distLengths = lengths.slice(hlit, hlit + hdist);
        const litLenTree = buildHuffmanTree(litLenLengths);
        const distTree = buildHuffmanTree(distLengths);
        inflateBlock(litLenTree, distTree);
      } else {
        throw new Error(`Invalid deflate block type: ${blockType}`);
      }
    }
    function inflateBlock(litLenTree, distTree) {
      while (true) {
        const sym = decodeSymbol(litLenTree);
        if (sym < 256) {
          output.push(sym);
        } else if (sym === 256) {
          break;
        } else {
          const lenIdx = sym - 257;
          const length = lengthBase[lenIdx] + readBits(lengthExtra[lenIdx]);
          const distSym = decodeSymbol(distTree);
          const distance = distBase[distSym] + readBits(distExtra[distSym]);
          const srcStart = output.length - distance;
          for (let i = 0; i < length; i++) {
            output.push(output[srcStart + i]);
          }
        }
      }
    }
    return new Uint8Array(output);
  }
  function buildHuffmanTree(codeLengths) {
    let maxBits = 1;
    for (let i = 0; i < codeLengths.length; i++) {
      if (codeLengths[i] > maxBits) maxBits = codeLengths[i];
    }
    const blCount = new Uint16Array(maxBits + 1);
    for (let i = 0; i < codeLengths.length; i++) {
      const len = codeLengths[i];
      if (len > 0) blCount[len]++;
    }
    const nextCode = new Uint16Array(maxBits + 1);
    let code = 0;
    for (let bits = 1; bits <= maxBits; bits++) {
      code = code + blCount[bits - 1] << 1;
      nextCode[bits] = code;
    }
    const root = {};
    for (let i = 0; i < codeLengths.length; i++) {
      const len = codeLengths[i];
      if (len === 0) continue;
      const c = nextCode[len]++;
      let node = root;
      for (let bit = len - 1; bit >= 0; bit--) {
        const b = c >> bit & 1;
        if (b === 0) {
          if (!node.left) node.left = {};
          node = node.left;
        } else {
          if (!node.right) node.right = {};
          node = node.right;
        }
      }
      node.symbol = i;
    }
    return { root };
  }
  function applyPredictor(data, params) {
    if (!params) return data;
    const predictor = params.getNumber("Predictor") ?? 1;
    if (predictor === 1) return data;
    const columns = params.getNumber("Columns") ?? 1;
    const colors = params.getNumber("Colors") ?? 1;
    const bitsPerComponent = params.getNumber("BitsPerComponent") ?? 8;
    if (predictor === 2) {
      return tiffPredictor2(data, columns, colors, bitsPerComponent);
    }
    if (predictor >= 10 && predictor <= 15) {
      return pngPredictor(data, columns, colors, bitsPerComponent);
    }
    return data;
  }
  function tiffPredictor2(data, columns, colors, bpc) {
    if (bpc !== 8) return data;
    const bytesPerRow = columns * colors;
    const rows = Math.floor(data.length / bytesPerRow);
    const result = new Uint8Array(data.length);
    for (let row = 0; row < rows; row++) {
      const offset = row * bytesPerRow;
      for (let col = 0; col < bytesPerRow; col++) {
        if (col < colors) {
          result[offset + col] = data[offset + col];
        } else {
          result[offset + col] = data[offset + col] + result[offset + col - colors] & 255;
        }
      }
    }
    return result;
  }
  function pngPredictor(data, columns, colors, bpc) {
    const bytesPerPixel = Math.max(1, Math.ceil(colors * bpc / 8));
    const rowBytes = Math.ceil(columns * colors * bpc / 8);
    const srcRowBytes = rowBytes + 1;
    const rows = Math.floor(data.length / srcRowBytes);
    const result = new Uint8Array(rows * rowBytes);
    const prevRow = new Uint8Array(rowBytes);
    for (let row = 0; row < rows; row++) {
      const srcOffset = row * srcRowBytes;
      const dstOffset = row * rowBytes;
      const filterType = data[srcOffset];
      for (let col = 0; col < rowBytes; col++) {
        const raw = data[srcOffset + 1 + col];
        const a = col >= bytesPerPixel ? result[dstOffset + col - bytesPerPixel] : 0;
        const b = prevRow[col];
        const c = col >= bytesPerPixel ? prevRow[col - bytesPerPixel] : 0;
        let decoded;
        switch (filterType) {
          case 0:
            decoded = raw;
            break;
          case 1:
            decoded = raw + a & 255;
            break;
          case 2:
            decoded = raw + b & 255;
            break;
          case 3:
            decoded = raw + Math.floor((a + b) / 2) & 255;
            break;
          case 4:
            decoded = raw + paethPredictor(a, b, c) & 255;
            break;
          default:
            decoded = raw;
        }
        result[dstOffset + col] = decoded;
      }
      prevRow.set(result.subarray(dstOffset, dstOffset + rowBytes));
    }
    return result;
  }
  function paethPredictor(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }
  function asciiHexDecode(data) {
    const output = [];
    let hex = "";
    for (let i = 0; i < data.length; i++) {
      const ch = data[i];
      if (ch === 62) break;
      if (ch === 32 || ch === 9 || ch === 10 || ch === 13 || ch === 12 || ch === 0) {
        continue;
      }
      hex += String.fromCharCode(ch);
      if (hex.length === 2) {
        output.push(parseInt(hex, 16));
        hex = "";
      }
    }
    if (hex.length === 1) {
      output.push(parseInt(hex + "0", 16));
    }
    return new Uint8Array(output);
  }
  function ascii85Decode(data) {
    const output = [];
    let i = 0;
    if (data[0] === 60 && data[1] === 126) i = 2;
    while (i < data.length) {
      const ch = data[i];
      if (ch === 126 && i + 1 < data.length && data[i + 1] === 62) break;
      if (ch === 32 || ch === 9 || ch === 10 || ch === 13 || ch === 12) {
        i++;
        continue;
      }
      if (ch === 122) {
        output.push(0, 0, 0, 0);
        i++;
        continue;
      }
      const group = [];
      while (group.length < 5 && i < data.length) {
        const c = data[i];
        if (c === 126) break;
        if (c === 32 || c === 9 || c === 10 || c === 13 || c === 12) {
          i++;
          continue;
        }
        group.push(c - 33);
        i++;
      }
      if (group.length === 0) break;
      const padded = [...group];
      while (padded.length < 5) padded.push(84);
      let value = 0;
      for (let j = 0; j < 5; j++) {
        value = value * 85 + padded[j];
      }
      const numBytes = group.length - 1;
      if (numBytes >= 1) output.push(value >> 24 & 255);
      if (numBytes >= 2) output.push(value >> 16 & 255);
      if (numBytes >= 3) output.push(value >> 8 & 255);
      if (numBytes >= 4) output.push(value & 255);
    }
    return new Uint8Array(output);
  }
  function lzwDecode(data, params) {
    const earlyChange = params?.getNumber("EarlyChange") ?? 1;
    const output = [];
    let bitPos = 0;
    let codeSize = 9;
    const clearCode = 256;
    const eodCode = 257;
    function readCode() {
      let code = 0;
      for (let i = 0; i < codeSize; i++) {
        const byteIdx = Math.floor(bitPos / 8);
        const bitIdx = 7 - bitPos % 8;
        if (byteIdx < data.length) {
          code |= (data[byteIdx] >> bitIdx & 1) << codeSize - 1 - i;
        }
        bitPos++;
      }
      return code;
    }
    let table = [];
    function resetTable() {
      table = [];
      for (let i = 0; i < 256; i++) table.push(new Uint8Array([i]));
      table.push(new Uint8Array(0));
      table.push(new Uint8Array(0));
      codeSize = 9;
    }
    resetTable();
    let prevEntry = null;
    while (bitPos < data.length * 8) {
      const code = readCode();
      if (code === eodCode) break;
      if (code === clearCode) {
        resetTable();
        prevEntry = null;
        continue;
      }
      let entry;
      if (code < table.length) {
        entry = table[code];
      } else if (code === table.length && prevEntry) {
        entry = new Uint8Array(prevEntry.length + 1);
        entry.set(prevEntry);
        entry[prevEntry.length] = prevEntry[0];
      } else {
        break;
      }
      for (let i = 0; i < entry.length; i++) output.push(entry[i]);
      if (prevEntry) {
        const newEntry = new Uint8Array(prevEntry.length + 1);
        newEntry.set(prevEntry);
        newEntry[prevEntry.length] = entry[0];
        table.push(newEntry);
        const threshold = (1 << codeSize) - earlyChange;
        if (table.length > threshold && codeSize < 12) {
          codeSize++;
        }
      }
      prevEntry = entry;
    }
    return new Uint8Array(output);
  }
  function runLengthDecode(data) {
    const output = [];
    let i = 0;
    while (i < data.length) {
      const length = data[i++];
      if (length === 128) break;
      if (length < 128) {
        const count = length + 1;
        for (let j = 0; j < count && i < data.length; j++) {
          output.push(data[i++]);
        }
      } else {
        const count = 257 - length;
        if (i < data.length) {
          const byte = data[i++];
          for (let j = 0; j < count; j++) {
            output.push(byte);
          }
        }
      }
    }
    return new Uint8Array(output);
  }

  // src/engine/parser/xref.ts
  function findStartXref(data) {
    const lexer = new PDFLexer(data);
    const pos = lexer.searchBackward("startxref");
    if (pos === -1) {
      throw new Error("Cannot find startxref \u2014 file may be corrupted or not a PDF");
    }
    lexer.position = pos + "startxref".length;
    lexer.skipWhitespaceAndComments();
    const token = lexer.nextToken();
    if (!token || token.type !== "Integer" /* Integer */) {
      throw new Error("Invalid startxref value");
    }
    return token.value;
  }
  function parseXrefTable(data, offset) {
    const lexer = new PDFLexer(data, offset);
    lexer.skipWhitespaceAndComments();
    const xrefKeyword = lexer.nextToken();
    if (!xrefKeyword || xrefKeyword.value !== "xref") {
      throw new Error(`Expected 'xref' keyword at offset ${offset}, got: ${xrefKeyword?.value}`);
    }
    const entries = /* @__PURE__ */ new Map();
    while (true) {
      lexer.skipWhitespaceAndComments();
      const savedPos = lexer.position;
      const nextTok = lexer.nextToken();
      if (!nextTok || nextTok.value === "trailer") {
        break;
      }
      if (nextTok.type !== "Integer" /* Integer */) {
        break;
      }
      const startObjNum = nextTok.value;
      const countTok = lexer.nextToken();
      if (!countTok || countTok.type !== "Integer" /* Integer */) {
        throw new Error("Expected object count in xref subsection");
      }
      const count = countTok.value;
      for (let i = 0; i < count; i++) {
        lexer.skipWhitespace();
        const offsetTok = lexer.nextToken();
        const genTok = lexer.nextToken();
        const typeTok = lexer.nextToken();
        if (!offsetTok || !genTok || !typeTok) {
          break;
        }
        const objNum = startObjNum + i;
        const byteOffset = offsetTok.value;
        const genNum = genTok.value;
        const type = typeTok.value === "n" ? "n" : "f";
        const key = `${objNum}_${genNum}`;
        if (!entries.has(key)) {
          entries.set(key, { objNum, genNum, offset: byteOffset, type });
        }
      }
    }
    lexer.skipWhitespaceAndComments();
    const trailerDict = parseObject(lexer);
    if (!(trailerDict instanceof PDFDict)) {
      throw new Error("Expected trailer dictionary");
    }
    return { entries, trailerDict };
  }
  async function parseXrefStream(data, offset) {
    const lexer = new PDFLexer(data, offset);
    const objNumTok = lexer.nextToken();
    const genNumTok = lexer.nextToken();
    const objKeyword = lexer.nextToken();
    if (!objKeyword || objKeyword.value !== "obj") {
      throw new Error(`Expected 'obj' keyword at xref stream offset ${offset}`);
    }
    const streamObj = parseStreamObject(lexer, data);
    if (!(streamObj instanceof PDFStream)) {
      throw new Error("XRef stream is not a stream object");
    }
    const dict = streamObj.dict;
    const filters = streamObj.getFilters();
    const params = streamObj.getDecodeParams();
    const decodedData = filters.length > 0 ? await applyFilters(streamObj.rawBytes, filters, params) : streamObj.rawBytes;
    const wArray = dict.getArray("W");
    if (!wArray) throw new Error("XRef stream missing /W array");
    const w = wArray.asNumbers();
    if (w.length < 3) throw new Error("XRef stream /W array must have 3 entries");
    const [w0, w1, w2] = w;
    const entrySize = w0 + w1 + w2;
    const size = dict.getNumber("Size") ?? 0;
    const indexArray = dict.getArray("Index");
    const indices = indexArray ? indexArray.asNumbers() : [0, size];
    const entries = /* @__PURE__ */ new Map();
    let dataPos = 0;
    for (let i = 0; i < indices.length; i += 2) {
      const startObj = indices[i];
      const count = indices[i + 1];
      for (let j = 0; j < count; j++) {
        const type = w0 > 0 ? readIntFromBytes(decodedData, dataPos, w0) : 1;
        dataPos += w0;
        const field2 = readIntFromBytes(decodedData, dataPos, w1);
        dataPos += w1;
        const field3 = readIntFromBytes(decodedData, dataPos, w2);
        dataPos += w2;
        const objNum = startObj + j;
        if (type === 0) {
          const key = `${objNum}_${field3}`;
          if (!entries.has(key)) {
            entries.set(key, {
              objNum,
              genNum: field3,
              offset: field2,
              // next free object number
              type: "f"
            });
          }
        } else if (type === 1) {
          const key = `${objNum}_${field3}`;
          if (!entries.has(key)) {
            entries.set(key, {
              objNum,
              genNum: field3,
              offset: field2,
              // byte offset
              type: "n"
            });
          }
        } else if (type === 2) {
          const key = `${objNum}_0`;
          if (!entries.has(key)) {
            entries.set(key, {
              objNum,
              genNum: 0,
              offset: 0,
              type: "n",
              compressedObjNum: field2,
              // object number of the ObjStm
              compressedIndex: field3
              // index within the ObjStm
            });
          }
        }
      }
    }
    return { entries, trailerDict: dict };
  }
  function readIntFromBytes(data, offset, width) {
    let value = 0;
    for (let i = 0; i < width; i++) {
      value = value << 8 | (data[offset + i] ?? 0);
    }
    return value;
  }
  async function buildFullXref(data) {
    const startxref = findStartXref(data);
    const mergedEntries = /* @__PURE__ */ new Map();
    let mainTrailer = null;
    let currentOffset = startxref;
    const visited = /* @__PURE__ */ new Set();
    while (currentOffset !== null && !visited.has(currentOffset)) {
      visited.add(currentOffset);
      let xrefSection;
      const isTable = isTraditionalXref(data, currentOffset);
      if (isTable) {
        xrefSection = parseXrefTable(data, currentOffset);
      } else {
        xrefSection = await parseXrefStream(data, currentOffset);
      }
      Array.from(xrefSection.entries.entries()).forEach(([key, entry]) => {
        if (!mergedEntries.has(key)) {
          mergedEntries.set(key, entry);
        }
      });
      if (!mainTrailer) {
        mainTrailer = xrefSection.trailerDict;
      }
      const prev = xrefSection.trailerDict.getNumber("Prev");
      currentOffset = prev ?? null;
    }
    if (!mainTrailer) {
      throw new Error("No trailer dictionary found");
    }
    return { entries: mergedEntries, trailerDict: mainTrailer };
  }
  function isTraditionalXref(data, offset) {
    let pos = offset;
    while (pos < data.length && (data[pos] === 32 || data[pos] === 10 || data[pos] === 13 || data[pos] === 9)) {
      pos++;
    }
    return pos + 3 < data.length && data[pos] === 120 && // x
    data[pos + 1] === 114 && // r
    data[pos + 2] === 101 && // e
    data[pos + 3] === 102;
  }
  function parseObject(lexer) {
    lexer.skipWhitespaceAndComments();
    const token = lexer.nextToken();
    if (!token) throw new Error("Unexpected end of data while parsing object");
    switch (token.type) {
      case "Boolean" /* Boolean */:
        return new PDFBoolean(token.value);
      case "Integer" /* Integer */:
      case "Real" /* Real */:
        if (token.type === "Integer" /* Integer */) {
          const savedPos = lexer.position;
          const nextTok = lexer.nextToken();
          if (nextTok && nextTok.type === "Integer" /* Integer */) {
            const rTok = lexer.nextToken();
            if (rTok && rTok.value === "R") {
              return new PDFRef(token.value, nextTok.value);
            }
          }
          lexer.position = savedPos;
        }
        return new PDFNumber(token.value);
      case "String" /* String */:
        return new PDFString(token.value);
      case "HexString" /* HexString */:
        return new PDFHexString(token.value);
      case "Name" /* Name */:
        return new PDFName(token.value);
      case "Null" /* Null */:
        return PDFNull.instance;
      case "Keyword" /* Keyword */: {
        const kw = token.value;
        if (kw === "<<") {
          return parseDictionary(lexer);
        }
        if (kw === "[") {
          return parseArray(lexer);
        }
        return PDFNull.instance;
      }
      default:
        return PDFNull.instance;
    }
  }
  function parseDictionary(lexer) {
    const dict = new PDFDict();
    while (true) {
      lexer.skipWhitespaceAndComments();
      if (lexer.isEOF) break;
      const savedPos = lexer.position;
      const token = lexer.nextToken();
      if (!token) break;
      if (token.type === "Keyword" /* Keyword */ && token.value === ">>") break;
      if (token.type !== "Name" /* Name */) {
        continue;
      }
      const key = token.value;
      const value = parseObject(lexer);
      dict.set(key, value);
    }
    return dict;
  }
  function parseArray(lexer) {
    const items = [];
    while (true) {
      lexer.skipWhitespaceAndComments();
      if (lexer.isEOF) break;
      const savedPos = lexer.position;
      const token = lexer.nextToken();
      if (!token) break;
      if (token.type === "Keyword" /* Keyword */ && token.value === "]") break;
      lexer.position = savedPos;
      items.push(parseObject(lexer));
    }
    return new PDFArray(items);
  }
  function parseStreamObject(lexer, fileData) {
    const obj = parseObject(lexer);
    if (!(obj instanceof PDFDict)) return obj;
    lexer.skipWhitespaceAndComments();
    const savedPos = lexer.position;
    const tok = lexer.nextToken();
    if (!tok || tok.value !== "stream") {
      lexer.position = savedPos;
      return obj;
    }
    lexer.skipStreamEOL();
    const length = obj.getNumber("Length") ?? 0;
    let streamBytes;
    if (length > 0 && lexer.position + length <= fileData.length) {
      streamBytes = fileData.slice(lexer.position, lexer.position + length);
      lexer.position += length;
    } else {
      const endPos = lexer.searchForward("endstream");
      if (endPos !== -1) {
        let end = endPos;
        while (end > lexer.position && (fileData[end - 1] === 10 || fileData[end - 1] === 13)) {
          end--;
        }
        streamBytes = fileData.slice(lexer.position, end);
        lexer.position = endPos;
      } else {
        streamBytes = new Uint8Array(0);
      }
    }
    lexer.skipWhitespaceAndComments();
    const endTok = lexer.nextToken();
    return new PDFStream(obj, streamBytes);
  }

  // src/engine/parser/parser.ts
  async function parsePDF(data, options = {}) {
    const version = readHeader(data);
    const xref = await buildFullXref(data);
    const encrypted = xref.trailerDict.has("Encrypt");
    const deferFilters = options.deferEncryptedFilters !== false && encrypted;
    const objects = await readAllObjects(data, xref, { skipFilters: deferFilters });
    const resolve = (obj) => resolveRef(obj, objects);
    const catalogRef = xref.trailerDict.getRef("Root");
    if (!catalogRef) throw new Error("Trailer missing /Root entry");
    const catalog = resolve(catalogRef);
    if (!(catalog instanceof PDFDict)) throw new Error("/Root is not a dictionary");
    const pages = buildPageTree(catalog, objects, resolve);
    const info = extractDocInfo(xref.trailerDict, resolve);
    return {
      version,
      objects,
      xref,
      catalog,
      pages,
      info,
      rawBytes: data
    };
  }
  function readHeader(data) {
    const lexer = new PDFLexer(data);
    const line = lexer.readLine();
    const match = line.match(/%PDF-(\d+\.\d+)/);
    if (match) return match[1];
    const headerPos = lexer.searchForward("%PDF-", 0);
    if (headerPos !== -1) {
      lexer.position = headerPos;
      const headerLine = lexer.readLine();
      const m = headerLine.match(/%PDF-(\d+\.\d+)/);
      if (m) return m[1];
    }
    return "1.4";
  }
  async function readAllObjects(data, xref, opts = {}) {
    const objects = /* @__PURE__ */ new Map();
    const xrefEntries = Array.from(xref.entries.entries());
    for (let ei = 0; ei < xrefEntries.length; ei++) {
      const [key, entry] = xrefEntries[ei];
      if (entry.type === "f") continue;
      if (entry.compressedObjNum !== void 0) continue;
      try {
        const obj = readIndirectObject(data, entry.offset);
        if (obj) {
          objects.set(key, obj);
          if (obj instanceof PDFStream && !opts.skipFilters) {
            await decodeStream(obj, objects);
          }
        }
      } catch (e) {
        console.warn(`[PDF Parser] Failed to read object ${key} at offset ${entry.offset}:`, e);
      }
    }
    for (let ei = 0; ei < xrefEntries.length; ei++) {
      const [key, entry] = xrefEntries[ei];
      if (entry.type === "f") continue;
      if (entry.compressedObjNum === void 0) continue;
      try {
        const obj = await readCompressedObject(
          entry,
          objects,
          data,
          xref
        );
        if (obj) {
          objects.set(key, obj);
        }
      } catch (e) {
        console.warn(`[PDF Parser] Failed to read compressed object ${key}:`, e);
      }
    }
    return objects;
  }
  function readIndirectObject(data, offset) {
    if (offset >= data.length || offset < 0) return null;
    const lexer = new PDFLexer(data, offset);
    const objNumTok = lexer.nextToken();
    if (!objNumTok || objNumTok.type !== "Integer" /* Integer */) return null;
    const genNumTok = lexer.nextToken();
    if (!genNumTok || genNumTok.type !== "Integer" /* Integer */) return null;
    const objKeyword = lexer.nextToken();
    if (!objKeyword || objKeyword.value !== "obj") return null;
    const value = parseFullObject(lexer, data);
    lexer.skipWhitespaceAndComments();
    const endTok = lexer.nextToken();
    return value;
  }
  function parseFullObject(lexer, fileData) {
    lexer.skipWhitespaceAndComments();
    const token = lexer.nextToken();
    if (!token) return PDFNull.instance;
    switch (token.type) {
      case "Boolean" /* Boolean */:
        return new PDFBoolean(token.value);
      case "Integer" /* Integer */:
      case "Real" /* Real */: {
        if (token.type === "Integer" /* Integer */) {
          const savedPos = lexer.position;
          const nextTok = lexer.nextToken();
          if (nextTok && nextTok.type === "Integer" /* Integer */) {
            const rTok = lexer.nextToken();
            if (rTok && rTok.value === "R") {
              return new PDFRef(token.value, nextTok.value);
            }
          }
          lexer.position = savedPos;
        }
        return new PDFNumber(token.value);
      }
      case "String" /* String */:
        return new PDFString(token.value);
      case "HexString" /* HexString */:
        return new PDFHexString(token.value);
      case "Name" /* Name */:
        return new PDFName(token.value);
      case "Null" /* Null */:
        return PDFNull.instance;
      case "Keyword" /* Keyword */: {
        const kw = token.value;
        if (kw === "<<") {
          const dict = parseDictBody(lexer, fileData);
          lexer.skipWhitespaceAndComments();
          const savedPos = lexer.position;
          const streamTok = lexer.nextToken();
          if (streamTok && streamTok.value === "stream") {
            lexer.skipStreamEOL();
            return readStreamData(lexer, dict, fileData);
          }
          lexer.position = savedPos;
          return dict;
        }
        if (kw === "[") {
          return parseArrayBody(lexer, fileData);
        }
        return PDFNull.instance;
      }
      default:
        return PDFNull.instance;
    }
  }
  function parseDictBody(lexer, fileData) {
    const dict = new PDFDict();
    while (true) {
      lexer.skipWhitespaceAndComments();
      if (lexer.isEOF) break;
      const savedPos = lexer.position;
      const token = lexer.nextToken();
      if (!token) break;
      if (token.type === "Keyword" /* Keyword */ && token.value === ">>") break;
      if (token.type !== "Name" /* Name */) {
        continue;
      }
      const key = token.value;
      const value = parseFullObject(lexer, fileData);
      dict.set(key, value);
    }
    return dict;
  }
  function parseArrayBody(lexer, fileData) {
    const items = [];
    while (true) {
      lexer.skipWhitespaceAndComments();
      if (lexer.isEOF) break;
      const savedPos = lexer.position;
      const token = lexer.nextToken();
      if (!token) break;
      if (token.type === "Keyword" /* Keyword */ && token.value === "]") break;
      lexer.position = savedPos;
      items.push(parseFullObject(lexer, fileData));
    }
    return new PDFArray(items);
  }
  function readStreamData(lexer, dict, fileData) {
    const streamStart = lexer.position;
    const lengthVal = dict.get("Length");
    let length = -1;
    if (lengthVal instanceof PDFNumber) {
      length = lengthVal.value;
    }
    let streamBytes;
    if (length >= 0 && streamStart + length <= fileData.length) {
      let endPos = streamStart + length;
      while (endPos < fileData.length && (fileData[endPos] === 10 || fileData[endPos] === 13 || fileData[endPos] === 32)) {
        endPos++;
      }
      const check = String.fromCharCode(
        fileData[endPos] ?? 0,
        fileData[endPos + 1] ?? 0,
        fileData[endPos + 2] ?? 0,
        fileData[endPos + 3] ?? 0,
        fileData[endPos + 4] ?? 0,
        fileData[endPos + 5] ?? 0,
        fileData[endPos + 6] ?? 0,
        fileData[endPos + 7] ?? 0,
        fileData[endPos + 8] ?? 0
      );
      if (check.startsWith("endstream")) {
        streamBytes = fileData.slice(streamStart, streamStart + length);
        lexer.position = endPos + 9;
      } else {
        streamBytes = findStreamByEndMarker(lexer, fileData, streamStart);
      }
    } else {
      streamBytes = findStreamByEndMarker(lexer, fileData, streamStart);
    }
    return new PDFStream(dict, streamBytes);
  }
  function findStreamByEndMarker(lexer, fileData, streamStart) {
    const endPos = lexer.searchForward("endstream", streamStart);
    if (endPos !== -1) {
      let end = endPos;
      while (end > streamStart && (fileData[end - 1] === 10 || fileData[end - 1] === 13)) {
        end--;
      }
      lexer.position = endPos + 9;
      return fileData.slice(streamStart, end);
    }
    lexer.position = fileData.length;
    return fileData.slice(streamStart);
  }
  async function decodeStream(stream, objects) {
    const lengthObj = stream.dict.get("Length");
    if (lengthObj instanceof PDFRef) {
      const resolved = objects.get(lengthObj.toKey());
      if (resolved instanceof PDFNumber) {
        stream.dict.set("Length", resolved);
      }
    }
    const filters = stream.getFilters();
    if (filters.length === 0) {
      stream.decodedBytes = stream.rawBytes;
      return;
    }
    const params = stream.getDecodeParams();
    const resolvedParams = params.map((p) => {
      if (p instanceof PDFRef) {
        const resolved = objects.get(p.toKey());
        return resolved instanceof PDFDict ? resolved : null;
      }
      return p;
    });
    try {
      stream.decodedBytes = await applyFilters(stream.rawBytes, filters, resolvedParams);
    } catch (e) {
      console.warn("[PDF Parser] Failed to decode stream:", e);
      stream.decodedBytes = stream.rawBytes;
    }
  }
  async function readCompressedObject(entry, objects, data, xref) {
    if (entry.compressedObjNum === void 0 || entry.compressedIndex === void 0) {
      return null;
    }
    const objStmKey = `${entry.compressedObjNum}_0`;
    let objStm = objects.get(objStmKey);
    if (!objStm) {
      const stmEntry = xref.entries.get(objStmKey);
      if (!stmEntry || stmEntry.type === "f") return null;
      const rawObj = readIndirectObject(data, stmEntry.offset);
      if (rawObj && rawObj instanceof PDFStream) {
        await decodeStream(rawObj, objects);
        objects.set(objStmKey, rawObj);
        objStm = rawObj;
      } else {
        return null;
      }
    }
    if (!(objStm instanceof PDFStream)) return null;
    const streamData = objStm.getBytes();
    const n = objStm.dict.getNumber("N") ?? 0;
    const first = objStm.dict.getNumber("First") ?? 0;
    const headerLexer = new PDFLexer(streamData, 0);
    const objectOffsets = [];
    for (let i = 0; i < n; i++) {
      const objNumTok = headerLexer.nextToken();
      const offsetTok = headerLexer.nextToken();
      if (!objNumTok || !offsetTok) break;
      objectOffsets.push({
        objNum: objNumTok.value,
        offset: offsetTok.value + first
      });
    }
    const targetOffset = objectOffsets[entry.compressedIndex];
    if (!targetOffset) return null;
    const nextOffset = entry.compressedIndex + 1 < objectOffsets.length ? objectOffsets[entry.compressedIndex + 1].offset : streamData.length;
    const objData = streamData.slice(targetOffset.offset, nextOffset);
    const objLexer = new PDFLexer(objData, 0);
    return parseObject(objLexer);
  }
  function resolveRef(obj, objects) {
    if (obj instanceof PDFRef) {
      const resolved = objects.get(obj.toKey());
      if (!resolved) return PDFNull.instance;
      if (resolved instanceof PDFRef) return resolveRef(resolved, objects);
      return resolved;
    }
    return obj;
  }
  function buildPageTree(catalog, objects, resolve) {
    const pagesRef = catalog.getRef("Pages");
    if (!pagesRef) throw new Error("Catalog missing /Pages entry");
    const pagesObj = resolve(pagesRef);
    if (!(pagesObj instanceof PDFDict)) throw new Error("/Pages is not a dictionary");
    const pages = [];
    collectPages(pagesObj, pagesRef, objects, resolve, pages, {});
    return pages;
  }
  function collectPages(node, nodeRef, objects, resolve, pages, inherited) {
    const type = node.getName("Type");
    const currentInherited = { ...inherited };
    for (const key of ["MediaBox", "CropBox", "Rotate", "Resources"]) {
      const val = node.get(key);
      if (val !== void 0) {
        currentInherited[key] = resolve(val);
      }
    }
    if (type === "Page") {
      const pageIndex = pages.length;
      const mediaBoxObj = node.get("MediaBox") ? resolve(node.get("MediaBox")) : currentInherited["MediaBox"];
      const mediaBox = parseRectangle(mediaBoxObj);
      const cropBoxObj = node.get("CropBox") ? resolve(node.get("CropBox")) : currentInherited["CropBox"];
      const cropBox = cropBoxObj ? parseRectangle(cropBoxObj) : mediaBox;
      const rotateObj = node.get("Rotate") ?? currentInherited["Rotate"];
      const rotate = rotateObj instanceof PDFNumber ? rotateObj.value : 0;
      const resourcesObj = node.get("Resources") ? resolve(node.get("Resources")) : currentInherited["Resources"];
      const resources = resourcesObj instanceof PDFDict ? resourcesObj : new PDFDict();
      const contentsObj = node.get("Contents");
      const contentRefs = extractContentRefs(contentsObj, resolve);
      pages.push({
        index: pageIndex,
        dict: node,
        mediaBox,
        cropBox,
        rotate,
        ref: nodeRef,
        resources,
        contentRefs
      });
    } else if (type === "Pages") {
      const kidsObj = node.get("Kids");
      const kids = resolve(kidsObj ?? PDFNull.instance);
      if (kids instanceof PDFArray) {
        for (const kidRef of kids.items) {
          const resolvedKid = resolve(kidRef);
          if (resolvedKid instanceof PDFDict) {
            const ref = kidRef instanceof PDFRef ? kidRef : new PDFRef(0, 0);
            collectPages(resolvedKid, ref, objects, resolve, pages, currentInherited);
          }
        }
      }
    }
  }
  function extractContentRefs(contentsObj, resolve) {
    if (!contentsObj) return [];
    if (contentsObj instanceof PDFRef) return [contentsObj];
    const resolved = resolve(contentsObj);
    if (resolved instanceof PDFRef) return [resolved];
    if (resolved instanceof PDFArray) {
      return resolved.items.filter((item) => item instanceof PDFRef);
    }
    return [];
  }
  function parseRectangle(obj) {
    if (!(obj instanceof PDFArray) || obj.length < 4) {
      return { x: 0, y: 0, width: 612, height: 792 };
    }
    const nums = obj.asNumbers();
    const x1 = nums[0] ?? 0;
    const y1 = nums[1] ?? 0;
    const x2 = nums[2] ?? 612;
    const y2 = nums[3] ?? 792;
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    };
  }
  function extractDocInfo(trailer, resolve) {
    const infoRef = trailer.get("Info");
    if (!infoRef) return {};
    const infoObj = resolve(infoRef);
    if (!(infoObj instanceof PDFDict)) return {};
    return {
      title: infoObj.getString("Title"),
      author: infoObj.getString("Author"),
      subject: infoObj.getString("Subject"),
      keywords: infoObj.getString("Keywords"),
      creator: infoObj.getString("Creator"),
      producer: infoObj.getString("Producer"),
      creationDate: infoObj.getString("CreationDate"),
      modDate: infoObj.getString("ModDate")
    };
  }
  function getPageContentBytes(page, objects) {
    const chunks = [];
    for (const ref of page.contentRefs) {
      const obj = objects.get(ref.toKey());
      if (obj instanceof PDFStream) {
        const bytes = obj.getBytes();
        chunks.push(bytes);
        chunks.push(new Uint8Array([32]));
      }
    }
    if (chunks.length === 0) return new Uint8Array(0);
    if (chunks.length === 1) return chunks[0];
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
  function getResource(resources, category, name, objects) {
    const categoryObj = resources.get(category);
    if (!categoryObj) return void 0;
    const categoryDict = resolveRef(categoryObj, objects);
    if (!(categoryDict instanceof PDFDict)) return void 0;
    const resource = categoryDict.get(name);
    if (!resource) return void 0;
    return resolveRef(resource, objects);
  }

  // src/engine/content/operator-lexer.ts
  var OPERATORS = /* @__PURE__ */ new Set([
    // Special
    "BT",
    "ET",
    // Graphics state
    "q",
    "Q",
    "cm",
    "w",
    "J",
    "j",
    "M",
    "d",
    "ri",
    "i",
    "gs",
    // Path construction
    "m",
    "l",
    "c",
    "v",
    "y",
    "h",
    "re",
    // Path painting
    "S",
    "s",
    "f",
    "F",
    "f*",
    "B",
    "B*",
    "b",
    "b*",
    "n",
    // Clipping
    "W",
    "W*",
    // Text state
    "Tc",
    "Tw",
    "Tz",
    "TL",
    "Tf",
    "Tr",
    "Ts",
    // Text positioning
    "Td",
    "TD",
    "Tm",
    "T*",
    // Text showing
    "Tj",
    "TJ",
    "'",
    '"',
    // Type 3 font
    "d0",
    "d1",
    // Color
    "CS",
    "cs",
    "SC",
    "SCN",
    "sc",
    "scn",
    "G",
    "g",
    "RG",
    "rg",
    "K",
    "k",
    // Shading
    "sh",
    // Inline images
    "BI",
    "ID",
    "EI",
    // XObjects
    "Do",
    // Marked content
    "MP",
    "DP",
    "BMC",
    "BDC",
    "EMC",
    // Compatibility
    "BX",
    "EX"
  ]);
  function isOperator(word) {
    return OPERATORS.has(word);
  }
  function parseContentStream(data) {
    const lexer = new PDFLexer(data);
    const instructions = [];
    const operandStack = [];
    while (!lexer.isEOF) {
      lexer.skipWhitespaceAndComments();
      if (lexer.isEOF) break;
      const offset = lexer.position;
      const token = lexer.nextToken();
      if (!token || token.type === "EOF" /* EOF */) break;
      switch (token.type) {
        case "Integer" /* Integer */:
        case "Real" /* Real */:
          operandStack.push(new PDFNumber(token.value));
          break;
        case "String" /* String */:
          operandStack.push(new PDFString(token.value));
          break;
        case "HexString" /* HexString */:
          operandStack.push(new PDFHexString(token.value));
          break;
        case "Name" /* Name */:
          operandStack.push(new PDFName(token.value));
          break;
        case "Boolean" /* Boolean */:
          operandStack.push(new PDFBoolean(token.value));
          break;
        case "Null" /* Null */:
          operandStack.push(PDFNull.instance);
          break;
        case "Keyword" /* Keyword */: {
          const kw = token.value;
          if (kw === "[") {
            operandStack.push(parseCSArray(lexer));
            break;
          }
          if (kw === "<<") {
            operandStack.push(parseCSDictionary(lexer));
            break;
          }
          if (kw === "BI") {
            const inlineImg = parseInlineImage(lexer, data);
            instructions.push({
              operator: "BI",
              operands: inlineImg ? [inlineImg] : [],
              offset
            });
            operandStack.length = 0;
            break;
          }
          if (isOperator(kw)) {
            instructions.push({
              operator: kw,
              operands: operandStack.splice(0),
              offset
            });
          } else {
            instructions.push({
              operator: kw,
              operands: operandStack.splice(0),
              offset
            });
          }
          break;
        }
        default:
          break;
      }
    }
    return instructions;
  }
  function parseCSArray(lexer) {
    const items = [];
    while (!lexer.isEOF) {
      lexer.skipWhitespaceAndComments();
      if (lexer.isEOF) break;
      const savedPos = lexer.position;
      const token = lexer.nextToken();
      if (!token) break;
      if (token.type === "Keyword" /* Keyword */ && token.value === "]") break;
      switch (token.type) {
        case "Integer" /* Integer */:
        case "Real" /* Real */:
          items.push(new PDFNumber(token.value));
          break;
        case "String" /* String */:
          items.push(new PDFString(token.value));
          break;
        case "HexString" /* HexString */:
          items.push(new PDFHexString(token.value));
          break;
        case "Name" /* Name */:
          items.push(new PDFName(token.value));
          break;
        case "Boolean" /* Boolean */:
          items.push(new PDFBoolean(token.value));
          break;
        case "Null" /* Null */:
          items.push(PDFNull.instance);
          break;
        case "Keyword" /* Keyword */:
          if (token.value === "[") {
            items.push(parseCSArray(lexer));
          } else {
            lexer.position = savedPos;
            break;
          }
          break;
        default:
          break;
      }
    }
    return new PDFArray(items);
  }
  function parseCSDictionary(lexer) {
    const dict = new PDFDict();
    while (!lexer.isEOF) {
      lexer.skipWhitespaceAndComments();
      if (lexer.isEOF) break;
      const token = lexer.nextToken();
      if (!token) break;
      if (token.type === "Keyword" /* Keyword */ && token.value === ">>") break;
      if (token.type !== "Name" /* Name */) continue;
      const key = token.value;
      const valToken = lexer.nextToken();
      if (!valToken) break;
      switch (valToken.type) {
        case "Integer" /* Integer */:
        case "Real" /* Real */:
          dict.set(key, new PDFNumber(valToken.value));
          break;
        case "String" /* String */:
          dict.set(key, new PDFString(valToken.value));
          break;
        case "HexString" /* HexString */:
          dict.set(key, new PDFHexString(valToken.value));
          break;
        case "Name" /* Name */:
          dict.set(key, new PDFName(valToken.value));
          break;
        case "Boolean" /* Boolean */:
          dict.set(key, new PDFBoolean(valToken.value));
          break;
        case "Keyword" /* Keyword */:
          if (valToken.value === "[") dict.set(key, parseCSArray(lexer));
          else if (valToken.value === "<<") dict.set(key, parseCSDictionary(lexer));
          break;
        default:
          break;
      }
    }
    return dict;
  }
  function parseInlineImage(lexer, data) {
    const dict = new PDFDict();
    while (!lexer.isEOF) {
      lexer.skipWhitespaceAndComments();
      const token = lexer.nextToken();
      if (!token) return null;
      if (token.type === "Keyword" /* Keyword */ && token.value === "ID") {
        lexer.position += 1;
        break;
      }
      if (token.type === "Name" /* Name */) {
        const key = expandInlineImageKey(token.value);
        const valToken = lexer.nextToken();
        if (!valToken) return null;
        switch (valToken.type) {
          case "Integer" /* Integer */:
          case "Real" /* Real */:
            dict.set(key, new PDFNumber(valToken.value));
            break;
          case "Name" /* Name */:
            dict.set(key, new PDFName(expandInlineImageValue(valToken.value)));
            break;
          case "Boolean" /* Boolean */:
            dict.set(key, new PDFBoolean(valToken.value));
            break;
          case "Keyword" /* Keyword */:
            if (valToken.value === "[") dict.set(key, parseCSArray(lexer));
            break;
          default:
            break;
        }
      }
    }
    const startPos = lexer.position;
    const eiPos = lexer.searchForward("EI", startPos);
    if (eiPos === -1) return null;
    let actualEiPos = eiPos;
    while (actualEiPos > startPos) {
      const prevByte = data[actualEiPos - 1];
      if (prevByte === 10 || prevByte === 13 || prevByte === 32) {
        break;
      }
      const nextEi = lexer.searchForward("EI", actualEiPos + 2);
      if (nextEi === -1) break;
      actualEiPos = nextEi;
    }
    const imageData = data.slice(startPos, actualEiPos);
    lexer.position = actualEiPos + 2;
    dict.set("__imageDataOffset", new PDFNumber(startPos));
    dict.set("__imageDataLength", new PDFNumber(imageData.length));
    return dict;
  }
  function expandInlineImageKey(abbrev) {
    const map = {
      "BPC": "BitsPerComponent",
      "CS": "ColorSpace",
      "D": "Decode",
      "DP": "DecodeParms",
      "F": "Filter",
      "H": "Height",
      "IM": "ImageMask",
      "I": "Interpolate",
      "W": "Width",
      "L": "Length"
    };
    return map[abbrev] ?? abbrev;
  }
  function expandInlineImageValue(abbrev) {
    const map = {
      "G": "DeviceGray",
      "RGB": "DeviceRGB",
      "CMYK": "DeviceCMYK",
      "I": "Indexed",
      "AHx": "ASCIIHexDecode",
      "A85": "ASCII85Decode",
      "LZW": "LZWDecode",
      "Fl": "FlateDecode",
      "RL": "RunLengthDecode",
      "CCF": "CCITTFaxDecode",
      "DCT": "DCTDecode"
    };
    return map[abbrev] ?? abbrev;
  }

  // src/engine/fonts/cmap-parser.ts
  function parseCMap(data) {
    const text = bytesToLatin1(data);
    const result = {
      toUnicode: /* @__PURE__ */ new Map(),
      toCID: /* @__PURE__ */ new Map(),
      codeSpaceRanges: [],
      name: "",
      writingMode: 0
    };
    const nameMatch = text.match(/\/CMapName\s*\/(\S+)/);
    if (nameMatch) result.name = nameMatch[1];
    const wmMatch = text.match(/\/WMode\s+(\d+)/);
    if (wmMatch) result.writingMode = parseInt(wmMatch[1], 10);
    parseCodeSpaceRanges(text, result);
    parseBfChar(text, result.toUnicode);
    parseBfRange(text, result.toUnicode);
    parseCidChar(text, result.toCID);
    parseCidRange(text, result.toCID);
    return result;
  }
  function parseCodeSpaceRanges(text, result) {
    const regex = /begincodespacerange\s*([\s\S]*?)endcodespacerange/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const block = match[1];
      const lineRegex = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
      let lineMatch;
      while ((lineMatch = lineRegex.exec(block)) !== null) {
        const low = parseInt(lineMatch[1], 16);
        const high = parseInt(lineMatch[2], 16);
        const bytes = lineMatch[1].length / 2;
        result.codeSpaceRanges.push({ low, high, bytes });
      }
    }
  }
  function parseBfChar(text, map) {
    const regex = /beginbfchar\s*([\s\S]*?)endbfchar/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const block = match[1];
      const lineRegex = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
      let lineMatch;
      while ((lineMatch = lineRegex.exec(block)) !== null) {
        const charCode = parseInt(lineMatch[1], 16);
        const unicode = hexToUnicodeStr(lineMatch[2]);
        map.set(charCode, unicode);
      }
    }
  }
  function parseBfRange(text, map) {
    const regex = /beginbfrange\s*([\s\S]*?)endbfrange/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const block = match[1];
      const rangeRegex = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([\s\S]*?)\])/g;
      let rangeMatch;
      while ((rangeMatch = rangeRegex.exec(block)) !== null) {
        const startCode = parseInt(rangeMatch[1], 16);
        const endCode = parseInt(rangeMatch[2], 16);
        if (rangeMatch[3]) {
          let unicodeStart = parseInt(rangeMatch[3], 16);
          for (let code = startCode; code <= endCode; code++) {
            map.set(code, String.fromCodePoint(unicodeStart++));
          }
        } else if (rangeMatch[4]) {
          const arrayContent = rangeMatch[4];
          const hexValues = arrayContent.match(/<([0-9a-fA-F]+)>/g) ?? [];
          for (let j = 0; j < hexValues.length && startCode + j <= endCode; j++) {
            const hex = hexValues[j].replace(/[<>]/g, "");
            map.set(startCode + j, hexToUnicodeStr(hex));
          }
        }
      }
    }
  }
  function parseCidChar(text, map) {
    const regex = /begincidchar\s*([\s\S]*?)endcidchar/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const block = match[1];
      const lineRegex = /<([0-9a-fA-F]+)>\s+(\d+)/g;
      let lineMatch;
      while ((lineMatch = lineRegex.exec(block)) !== null) {
        const charCode = parseInt(lineMatch[1], 16);
        const cid = parseInt(lineMatch[2], 10);
        map.set(charCode, cid);
      }
    }
  }
  function parseCidRange(text, map) {
    const regex = /begincidrange\s*([\s\S]*?)endcidrange/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const block = match[1];
      const lineRegex = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s+(\d+)/g;
      let lineMatch;
      while ((lineMatch = lineRegex.exec(block)) !== null) {
        const startCode = parseInt(lineMatch[1], 16);
        const endCode = parseInt(lineMatch[2], 16);
        let cid = parseInt(lineMatch[3], 10);
        for (let code = startCode; code <= endCode; code++) {
          map.set(code, cid++);
        }
      }
    }
  }
  function hexToUnicodeStr(hex) {
    let result = "";
    if (hex.length <= 2) {
      return String.fromCharCode(parseInt(hex, 16));
    }
    for (let i = 0; i < hex.length; i += 4) {
      if (i + 4 <= hex.length) {
        result += String.fromCodePoint(parseInt(hex.substring(i, i + 4), 16));
      } else {
        result += String.fromCodePoint(parseInt(hex.substring(i), 16));
      }
    }
    return result;
  }
  function bytesToLatin1(data) {
    let str = "";
    for (let i = 0; i < data.length; i++) {
      str += String.fromCharCode(data[i]);
    }
    return str;
  }

  // src/engine/fonts/standard14.ts
  var HELVETICA_WIDTHS = new Array(256).fill(278);
  var HW = {
    32: 278,
    33: 278,
    34: 355,
    35: 556,
    36: 556,
    37: 889,
    38: 667,
    39: 191,
    40: 333,
    41: 333,
    42: 389,
    43: 584,
    44: 278,
    45: 333,
    46: 278,
    47: 278,
    48: 556,
    49: 556,
    50: 556,
    51: 556,
    52: 556,
    53: 556,
    54: 556,
    55: 556,
    56: 556,
    57: 556,
    58: 278,
    59: 278,
    60: 584,
    61: 584,
    62: 584,
    63: 556,
    64: 1015,
    65: 667,
    66: 667,
    67: 722,
    68: 722,
    69: 667,
    70: 611,
    71: 778,
    72: 722,
    73: 278,
    74: 500,
    75: 667,
    76: 556,
    77: 833,
    78: 722,
    79: 778,
    80: 667,
    81: 778,
    82: 722,
    83: 667,
    84: 611,
    85: 722,
    86: 667,
    87: 944,
    88: 667,
    89: 667,
    90: 611,
    91: 278,
    92: 278,
    93: 278,
    94: 469,
    95: 556,
    96: 333,
    97: 556,
    98: 556,
    99: 500,
    100: 556,
    101: 556,
    102: 278,
    103: 556,
    104: 556,
    105: 222,
    106: 222,
    107: 500,
    108: 222,
    109: 833,
    110: 556,
    111: 556,
    112: 556,
    113: 556,
    114: 333,
    115: 500,
    116: 278,
    117: 556,
    118: 500,
    119: 722,
    120: 500,
    121: 500,
    122: 500,
    123: 334,
    124: 260,
    125: 334,
    126: 584
  };
  Object.entries(HW).forEach(([k, v]) => {
    HELVETICA_WIDTHS[Number(k)] = v;
  });
  var HELVETICA_BOLD_WIDTHS = new Array(256).fill(278);
  var HBW = {
    32: 278,
    33: 333,
    34: 474,
    35: 556,
    36: 556,
    37: 889,
    38: 722,
    39: 238,
    40: 333,
    41: 333,
    42: 389,
    43: 584,
    44: 278,
    45: 333,
    46: 278,
    47: 278,
    48: 556,
    49: 556,
    50: 556,
    51: 556,
    52: 556,
    53: 556,
    54: 556,
    55: 556,
    56: 556,
    57: 556,
    58: 333,
    59: 333,
    60: 584,
    61: 584,
    62: 584,
    63: 611,
    64: 975,
    65: 722,
    66: 722,
    67: 722,
    68: 722,
    69: 667,
    70: 611,
    71: 778,
    72: 722,
    73: 278,
    74: 556,
    75: 722,
    76: 611,
    77: 833,
    78: 722,
    79: 778,
    80: 667,
    81: 778,
    82: 722,
    83: 667,
    84: 611,
    85: 722,
    86: 667,
    87: 944,
    88: 667,
    89: 667,
    90: 611,
    91: 333,
    92: 278,
    93: 333,
    94: 584,
    95: 556,
    96: 333,
    97: 556,
    98: 611,
    99: 556,
    100: 611,
    101: 556,
    102: 333,
    103: 611,
    104: 611,
    105: 278,
    106: 278,
    107: 556,
    108: 278,
    109: 889,
    110: 611,
    111: 611,
    112: 611,
    113: 611,
    114: 389,
    115: 556,
    116: 333,
    117: 611,
    118: 556,
    119: 778,
    120: 556,
    121: 556,
    122: 500,
    123: 389,
    124: 280,
    125: 389,
    126: 584
  };
  Object.entries(HBW).forEach(([k, v]) => {
    HELVETICA_BOLD_WIDTHS[Number(k)] = v;
  });
  var TIMES_ROMAN_WIDTHS = new Array(256).fill(250);
  var TRW = {
    32: 250,
    33: 333,
    34: 408,
    35: 500,
    36: 500,
    37: 833,
    38: 778,
    39: 180,
    40: 333,
    41: 333,
    42: 500,
    43: 564,
    44: 250,
    45: 333,
    46: 250,
    47: 278,
    48: 500,
    49: 500,
    50: 500,
    51: 500,
    52: 500,
    53: 500,
    54: 500,
    55: 500,
    56: 500,
    57: 500,
    58: 278,
    59: 278,
    60: 564,
    61: 564,
    62: 564,
    63: 444,
    64: 921,
    65: 722,
    66: 667,
    67: 667,
    68: 722,
    69: 611,
    70: 556,
    71: 722,
    72: 722,
    73: 333,
    74: 389,
    75: 722,
    76: 611,
    77: 889,
    78: 722,
    79: 722,
    80: 556,
    81: 722,
    82: 667,
    83: 556,
    84: 611,
    85: 722,
    86: 722,
    87: 944,
    88: 722,
    89: 722,
    90: 611,
    91: 333,
    92: 278,
    93: 333,
    94: 469,
    95: 500,
    96: 333,
    97: 444,
    98: 500,
    99: 444,
    100: 500,
    101: 444,
    102: 333,
    103: 500,
    104: 500,
    105: 278,
    106: 278,
    107: 500,
    108: 278,
    109: 778,
    110: 500,
    111: 500,
    112: 500,
    113: 500,
    114: 333,
    115: 389,
    116: 278,
    117: 500,
    118: 500,
    119: 722,
    120: 500,
    121: 500,
    122: 444,
    123: 480,
    124: 200,
    125: 480,
    126: 541
  };
  Object.entries(TRW).forEach(([k, v]) => {
    TIMES_ROMAN_WIDTHS[Number(k)] = v;
  });
  var TIMES_BOLD_WIDTHS = new Array(256).fill(250);
  var TBW = {
    32: 250,
    33: 333,
    34: 555,
    35: 500,
    36: 500,
    37: 1e3,
    38: 833,
    39: 278,
    40: 333,
    41: 333,
    42: 500,
    43: 570,
    44: 250,
    45: 333,
    46: 250,
    47: 278,
    48: 500,
    49: 500,
    50: 500,
    51: 500,
    52: 500,
    53: 500,
    54: 500,
    55: 500,
    56: 500,
    57: 500,
    58: 333,
    59: 333,
    60: 570,
    61: 570,
    62: 570,
    63: 500,
    64: 930,
    65: 722,
    66: 667,
    67: 722,
    68: 722,
    69: 667,
    70: 611,
    71: 778,
    72: 778,
    73: 389,
    74: 500,
    75: 778,
    76: 667,
    77: 944,
    78: 722,
    79: 778,
    80: 611,
    81: 778,
    82: 722,
    83: 556,
    84: 667,
    85: 722,
    86: 722,
    87: 1e3,
    88: 722,
    89: 722,
    90: 667,
    91: 333,
    92: 278,
    93: 333,
    94: 581,
    95: 500,
    96: 333,
    97: 500,
    98: 556,
    99: 444,
    100: 556,
    101: 444,
    102: 333,
    103: 500,
    104: 556,
    105: 278,
    106: 333,
    107: 556,
    108: 278,
    109: 833,
    110: 556,
    111: 500,
    112: 556,
    113: 556,
    114: 444,
    115: 389,
    116: 333,
    117: 556,
    118: 500,
    119: 722,
    120: 500,
    121: 500,
    122: 444,
    123: 394,
    124: 220,
    125: 394,
    126: 520,
    // WinAnsi 0x80–0x9F (glyph names from Core 14 AFM)
    128: 500,
    130: 333,
    131: 556,
    132: 500,
    133: 1e3,
    134: 500,
    135: 1e3,
    136: 333,
    137: 1e3,
    138: 667,
    139: 333,
    140: 1e3,
    142: 667,
    145: 333,
    146: 333,
    147: 500,
    148: 500,
    149: 350,
    150: 500,
    151: 1e3,
    152: 333,
    153: 1e3,
    154: 556,
    155: 333,
    156: 722,
    158: 667,
    159: 722
  };
  Object.entries(TBW).forEach(([k, v]) => {
    TIMES_BOLD_WIDTHS[Number(k)] = v;
  });
  var TIMES_ITALIC_WIDTHS = new Array(256).fill(250);
  var TIW = {
    32: 250,
    33: 333,
    34: 420,
    35: 500,
    36: 500,
    37: 833,
    38: 778,
    39: 214,
    40: 333,
    41: 333,
    42: 500,
    43: 675,
    44: 250,
    45: 333,
    46: 250,
    47: 278,
    48: 500,
    49: 500,
    50: 500,
    51: 500,
    52: 500,
    53: 500,
    54: 500,
    55: 500,
    56: 500,
    57: 500,
    58: 333,
    59: 333,
    60: 675,
    61: 675,
    62: 675,
    63: 500,
    64: 920,
    65: 611,
    66: 611,
    67: 667,
    68: 722,
    69: 611,
    70: 611,
    71: 722,
    72: 722,
    73: 333,
    74: 444,
    75: 667,
    76: 556,
    77: 833,
    78: 667,
    79: 722,
    80: 611,
    81: 722,
    82: 611,
    83: 500,
    84: 556,
    85: 722,
    86: 611,
    87: 833,
    88: 611,
    89: 556,
    90: 556,
    91: 389,
    92: 278,
    93: 389,
    94: 422,
    95: 500,
    96: 333,
    97: 500,
    98: 500,
    99: 444,
    100: 500,
    101: 444,
    102: 278,
    103: 500,
    104: 500,
    105: 278,
    106: 278,
    107: 444,
    108: 278,
    109: 722,
    110: 500,
    111: 500,
    112: 500,
    113: 500,
    114: 389,
    115: 389,
    116: 278,
    117: 500,
    118: 444,
    119: 667,
    120: 444,
    121: 444,
    122: 389,
    123: 400,
    124: 275,
    125: 400,
    126: 541,
    128: 500,
    130: 333,
    131: 500,
    132: 556,
    133: 889,
    134: 500,
    135: 500,
    136: 333,
    137: 1e3,
    138: 500,
    139: 333,
    140: 944,
    142: 556,
    145: 333,
    146: 333,
    147: 556,
    148: 556,
    149: 350,
    150: 500,
    151: 889,
    152: 333,
    153: 980,
    154: 389,
    155: 333,
    156: 667,
    158: 389,
    159: 556
  };
  Object.entries(TIW).forEach(([k, v]) => {
    TIMES_ITALIC_WIDTHS[Number(k)] = v;
  });
  var TIMES_BOLDITALIC_WIDTHS = new Array(256).fill(250);
  var TBIW = {
    32: 250,
    33: 389,
    34: 555,
    35: 500,
    36: 500,
    37: 833,
    38: 778,
    39: 278,
    40: 333,
    41: 333,
    42: 500,
    43: 570,
    44: 250,
    45: 333,
    46: 250,
    47: 278,
    48: 500,
    49: 500,
    50: 500,
    51: 500,
    52: 500,
    53: 500,
    54: 500,
    55: 500,
    56: 500,
    57: 500,
    58: 333,
    59: 333,
    60: 570,
    61: 570,
    62: 570,
    63: 500,
    64: 832,
    65: 667,
    66: 667,
    67: 667,
    68: 722,
    69: 667,
    70: 667,
    71: 722,
    72: 778,
    73: 389,
    74: 500,
    75: 667,
    76: 611,
    77: 889,
    78: 722,
    79: 722,
    80: 611,
    81: 722,
    82: 667,
    83: 556,
    84: 611,
    85: 722,
    86: 667,
    87: 889,
    88: 667,
    89: 611,
    90: 611,
    91: 333,
    92: 278,
    93: 333,
    94: 570,
    95: 500,
    96: 333,
    97: 500,
    98: 500,
    99: 444,
    100: 500,
    101: 444,
    102: 333,
    103: 500,
    104: 556,
    105: 278,
    106: 278,
    107: 500,
    108: 278,
    109: 778,
    110: 556,
    111: 500,
    112: 556,
    113: 500,
    114: 389,
    115: 389,
    116: 278,
    117: 556,
    118: 444,
    119: 667,
    120: 500,
    121: 444,
    122: 389,
    123: 348,
    124: 220,
    125: 348,
    126: 570,
    128: 500,
    130: 333,
    131: 500,
    132: 500,
    133: 1e3,
    134: 500,
    135: 500,
    136: 333,
    137: 1e3,
    138: 556,
    139: 333,
    140: 944,
    142: 611,
    145: 333,
    146: 333,
    147: 500,
    148: 500,
    149: 350,
    150: 500,
    151: 1e3,
    152: 333,
    153: 1e3,
    154: 389,
    155: 333,
    156: 722,
    158: 389,
    159: 611
  };
  Object.entries(TBIW).forEach(([k, v]) => {
    TIMES_BOLDITALIC_WIDTHS[Number(k)] = v;
  });
  var COURIER_WIDTHS = new Array(256).fill(600);
  var STANDARD_FONTS = {
    "Helvetica": {
      name: "Helvetica",
      widths: HELVETICA_WIDTHS,
      defaultWidth: 278,
      ascent: 718,
      descent: -207,
      isMonospace: false,
      isSerif: false,
      cssFamily: "Helvetica, Arial, sans-serif",
      isBold: false,
      isItalic: false
    },
    "Helvetica-Bold": {
      name: "Helvetica-Bold",
      widths: HELVETICA_BOLD_WIDTHS,
      defaultWidth: 278,
      ascent: 718,
      descent: -207,
      isMonospace: false,
      isSerif: false,
      cssFamily: "Helvetica, Arial, sans-serif",
      isBold: true,
      isItalic: false
    },
    "Helvetica-Oblique": {
      name: "Helvetica-Oblique",
      widths: HELVETICA_WIDTHS,
      defaultWidth: 278,
      ascent: 718,
      descent: -207,
      isMonospace: false,
      isSerif: false,
      cssFamily: "Helvetica, Arial, sans-serif",
      isBold: false,
      isItalic: true
    },
    "Helvetica-BoldOblique": {
      name: "Helvetica-BoldOblique",
      widths: HELVETICA_BOLD_WIDTHS,
      defaultWidth: 278,
      ascent: 718,
      descent: -207,
      isMonospace: false,
      isSerif: false,
      cssFamily: "Helvetica, Arial, sans-serif",
      isBold: true,
      isItalic: true
    },
    "Times-Roman": {
      name: "Times-Roman",
      widths: TIMES_ROMAN_WIDTHS,
      defaultWidth: 250,
      ascent: 683,
      descent: -217,
      isMonospace: false,
      isSerif: true,
      cssFamily: '"Times New Roman", Times, serif',
      isBold: false,
      isItalic: false
    },
    "Times-Bold": {
      name: "Times-Bold",
      widths: TIMES_BOLD_WIDTHS,
      defaultWidth: 250,
      ascent: 683,
      descent: -217,
      isMonospace: false,
      isSerif: true,
      cssFamily: '"Times New Roman", Times, serif',
      isBold: true,
      isItalic: false
    },
    "Times-Italic": {
      name: "Times-Italic",
      widths: TIMES_ITALIC_WIDTHS,
      defaultWidth: 250,
      ascent: 683,
      descent: -217,
      isMonospace: false,
      isSerif: true,
      cssFamily: '"Times New Roman", Times, serif',
      isBold: false,
      isItalic: true
    },
    "Times-BoldItalic": {
      name: "Times-BoldItalic",
      widths: TIMES_BOLDITALIC_WIDTHS,
      defaultWidth: 250,
      ascent: 683,
      descent: -217,
      isMonospace: false,
      isSerif: true,
      cssFamily: '"Times New Roman", Times, serif',
      isBold: true,
      isItalic: true
    },
    "Courier": {
      name: "Courier",
      widths: COURIER_WIDTHS,
      defaultWidth: 600,
      ascent: 629,
      descent: -157,
      isMonospace: true,
      isSerif: true,
      cssFamily: '"Courier New", Courier, monospace',
      isBold: false,
      isItalic: false
    },
    "Courier-Bold": {
      name: "Courier-Bold",
      widths: COURIER_WIDTHS,
      defaultWidth: 600,
      ascent: 629,
      descent: -157,
      isMonospace: true,
      isSerif: true,
      cssFamily: '"Courier New", Courier, monospace',
      isBold: true,
      isItalic: false
    },
    "Courier-Oblique": {
      name: "Courier-Oblique",
      widths: COURIER_WIDTHS,
      defaultWidth: 600,
      ascent: 629,
      descent: -157,
      isMonospace: true,
      isSerif: true,
      cssFamily: '"Courier New", Courier, monospace',
      isBold: false,
      isItalic: true
    },
    "Courier-BoldOblique": {
      name: "Courier-BoldOblique",
      widths: COURIER_WIDTHS,
      defaultWidth: 600,
      ascent: 629,
      descent: -157,
      isMonospace: true,
      isSerif: true,
      cssFamily: '"Courier New", Courier, monospace',
      isBold: true,
      isItalic: true
    },
    "ZapfDingbats": {
      name: "ZapfDingbats",
      widths: HELVETICA_WIDTHS,
      defaultWidth: 278,
      ascent: 820,
      descent: -143,
      isMonospace: false,
      isSerif: false,
      cssFamily: '"Segoe UI Symbol", "Apple Symbols", "Noto Sans Symbols", sans-serif',
      isBold: false,
      isItalic: false
    },
    "Symbol": {
      name: "Symbol",
      widths: HELVETICA_WIDTHS,
      defaultWidth: 250,
      ascent: 1010,
      descent: -293,
      isMonospace: false,
      isSerif: false,
      cssFamily: '"Segoe UI Symbol", "Apple Symbols", "Noto Sans Symbols", sans-serif',
      isBold: false,
      isItalic: false
    }
  };
  function getStandardFont(fontName) {
    if (STANDARD_FONTS[fontName]) return STANDARD_FONTS[fontName];
    const stripped = fontName.replace(/^[A-Z]{6}\+/, "");
    if (STANDARD_FONTS[stripped]) return STANDARD_FONTS[stripped];
    const aliases = {
      "ArialMT": "Helvetica",
      "Arial": "Helvetica",
      "Arial-BoldMT": "Helvetica-Bold",
      "Arial-ItalicMT": "Helvetica-Oblique",
      "Arial-BoldItalicMT": "Helvetica-BoldOblique",
      "TimesNewRomanPSMT": "Times-Roman",
      "TimesNewRomanPS-BoldMT": "Times-Bold",
      "TimesNewRomanPS-ItalicMT": "Times-Italic",
      "TimesNewRomanPS-BoldItalicMT": "Times-BoldItalic",
      "CourierNewPSMT": "Courier",
      "CourierNewPS-BoldMT": "Courier-Bold",
      "CourierNewPS-ItalicMT": "Courier-Oblique",
      "CourierNewPS-BoldItalicMT": "Courier-BoldOblique"
    };
    const aliased = aliases[stripped];
    if (aliased && STANDARD_FONTS[aliased]) return STANDARD_FONTS[aliased];
    const lower = stripped.toLowerCase();
    if (lower.includes("courier") || lower.includes("mono")) {
      if (lower.includes("bold") && lower.includes("italic")) return STANDARD_FONTS["Courier-BoldOblique"];
      if (lower.includes("bold")) return STANDARD_FONTS["Courier-Bold"];
      if (lower.includes("italic") || lower.includes("oblique")) return STANDARD_FONTS["Courier-Oblique"];
      return STANDARD_FONTS["Courier"];
    }
    if (lower.includes("times") || lower.includes("roman")) {
      if (lower.includes("bold") && lower.includes("italic")) return STANDARD_FONTS["Times-BoldItalic"];
      if (lower.includes("bold")) return STANDARD_FONTS["Times-Bold"];
      if (lower.includes("italic")) return STANDARD_FONTS["Times-Italic"];
      return STANDARD_FONTS["Times-Roman"];
    }
    if (lower.includes("helv") || lower.includes("arial") || lower.includes("sans")) {
      if (lower.includes("bold") && (lower.includes("italic") || lower.includes("oblique"))) return STANDARD_FONTS["Helvetica-BoldOblique"];
      if (lower.includes("bold")) return STANDARD_FONTS["Helvetica-Bold"];
      if (lower.includes("italic") || lower.includes("oblique")) return STANDARD_FONTS["Helvetica-Oblique"];
      return STANDARD_FONTS["Helvetica"];
    }
    if (lower.includes("symbol")) return STANDARD_FONTS["Symbol"];
    if (lower.includes("zapf") || lower.includes("dingbat")) return STANDARD_FONTS["ZapfDingbats"];
    return null;
  }

  // src/engine/fonts/dingbat-encodings.ts
  var ZAPF_DINGBATS_TO_UNICODE = {
    32: " ",
    33: "\u2701",
    34: "\u2702",
    35: "\u2703",
    36: "\u2704",
    37: "\u260E",
    38: "\u2706",
    39: "\u2707",
    40: "\u2708",
    41: "\u2709",
    42: "\u261B",
    43: "\u261E",
    44: "\u270C",
    45: "\u270D",
    46: "\u270E",
    47: "\u270F",
    48: "\u2710",
    49: "\u2711",
    50: "\u2712",
    51: "\u2713",
    52: "\u2714",
    53: "\u2715",
    54: "\u2716",
    55: "\u2717",
    56: "\u2718",
    57: "\u2719",
    58: "\u271A",
    59: "\u271B",
    60: "\u271C",
    61: "\u271D",
    62: "\u271E",
    63: "\u271F",
    64: "\u2720",
    65: "\u2721",
    66: "\u2722",
    67: "\u2723",
    68: "\u2724",
    69: "\u2725",
    70: "\u2726",
    71: "\u2727",
    72: "\u2605",
    73: "\u2729",
    74: "\u272A",
    75: "\u272B",
    76: "\u272C",
    77: "\u272D",
    78: "\u272E",
    79: "\u272F",
    80: "\u2730",
    81: "\u2731",
    82: "\u2732",
    83: "\u2733",
    84: "\u2734",
    85: "\u2735",
    86: "\u2736",
    87: "\u2737",
    88: "\u2738",
    89: "\u2739",
    90: "\u273A",
    91: "\u273B",
    92: "\u273C",
    93: "\u273D",
    94: "\u273E",
    95: "\u273F",
    96: "\u2740",
    97: "\u2741",
    98: "\u2742",
    99: "\u2743",
    100: "\u2744",
    101: "\u2745",
    102: "\u2746",
    103: "\u2747",
    104: "\u2748",
    105: "\u2749",
    106: "\u274A",
    107: "\u274B",
    108: "\u25CF",
    109: "\u274D",
    110: "\u25A0",
    111: "\u274F",
    112: "\u2750",
    113: "\u2751",
    114: "\u2752",
    115: "\u25B2",
    116: "\u25BC",
    117: "\u25C6",
    118: "\u2756",
    119: "\u25D7",
    120: "\u2758",
    121: "\u2759",
    122: "\u275A",
    123: "\u275B",
    124: "\u275C",
    125: "\u275D",
    126: "\u275E",
    161: "\u2761",
    162: "\u2762",
    163: "\u2763",
    164: "\u2764",
    165: "\u2765",
    166: "\u2766",
    167: "\u2767",
    168: "\u2663",
    169: "\u2666",
    170: "\u2665",
    171: "\u2660",
    172: "\u2460",
    173: "\u2461",
    174: "\u2462",
    175: "\u2463",
    176: "\u2464",
    177: "\u2465",
    178: "\u2466",
    179: "\u2467",
    180: "\u2468",
    181: "\u2469",
    182: "\u2776",
    183: "\u2777",
    184: "\u2778",
    185: "\u2779",
    186: "\u277A",
    187: "\u277B",
    188: "\u277C",
    189: "\u277D",
    190: "\u277E",
    191: "\u277F"
  };
  var ZAPF_DINGBATS_GLYPH_TO_UNICODE = {
    a71: "\u25CF",
    a73: "\u25A0",
    a75: "\u2751",
    a76: "\u25B2",
    a77: "\u25BC",
    a78: "\u25C6",
    a79: "\u2756",
    a81: "\u25D7",
    a82: "\u2758",
    a108: "\u2767",
    a109: "\u2660",
    a110: "\u2665",
    a111: "\u2666",
    a112: "\u2663",
    blackcircle: "\u25CF",
    bullet: "\u2022",
    filledbox: "\u25A0"
  };
  var SYMBOL_TO_UNICODE = {
    32: " ",
    33: "!",
    34: "\u2200",
    35: "#",
    36: "\u2203",
    37: "%",
    38: "&",
    39: "\u220B",
    40: "(",
    41: ")",
    42: "\u2217",
    43: "+",
    44: ",",
    45: "\u2212",
    46: ".",
    47: "/",
    48: "0",
    49: "1",
    50: "2",
    51: "3",
    52: "4",
    53: "5",
    54: "6",
    55: "7",
    56: "8",
    57: "9",
    58: ":",
    59: ";",
    60: "<",
    61: "=",
    62: ">",
    63: "?",
    64: "\u2245",
    65: "\u0391",
    66: "\u0392",
    67: "\u03A7",
    68: "\u2206",
    69: "\u0395",
    70: "\u03A6",
    71: "\u0393",
    72: "\u0397",
    73: "\u0399",
    74: "\u03D1",
    75: "\u039A",
    76: "\u039B",
    77: "\u039C",
    78: "\u039D",
    79: "\u039F",
    80: "\u03A0",
    81: "\u0398",
    82: "\u03A1",
    83: "\u03A3",
    84: "\u03A4",
    85: "\u03A5",
    86: "\u03C2",
    87: "\u2126",
    88: "\u039E",
    89: "\u03A8",
    90: "\u0396",
    91: "[",
    92: "\u2234",
    93: "]",
    94: "\u22A5",
    95: "_",
    96: "\uF8E5",
    97: "\u03B1",
    98: "\u03B2",
    99: "\u03C7",
    100: "\u03B4",
    101: "\u03B5",
    102: "\u03C6",
    103: "\u03B3",
    104: "\u03B7",
    105: "\u03B9",
    106: "\u03D5",
    107: "\u03BA",
    108: "\u03BB",
    109: "\xB5",
    110: "\u03BD",
    111: "\u03BF",
    112: "\u03C0",
    113: "\u03B8",
    114: "\u03C1",
    115: "\u03C3",
    116: "\u03C4",
    117: "\u03C5",
    118: "\u03D6",
    119: "\u03C9",
    120: "\u03BE",
    121: "\u03C8",
    122: "\u03B6",
    123: "{",
    124: "|",
    125: "}",
    126: "\u223C",
    160: "\u20AC",
    161: "\u03D2",
    162: "\u2032",
    163: "\u2264",
    164: "\u2044",
    165: "\u221E",
    166: "\u0192",
    167: "\u2663",
    168: "\u2666",
    169: "\u2665",
    170: "\u2660",
    171: "\u2194",
    172: "\u2190",
    173: "\u2191",
    174: "\u2192",
    175: "\u2193",
    176: "\xB0",
    177: "\xB1",
    178: "\u2033",
    179: "\u2265",
    180: "\xD7",
    181: "\u221D",
    182: "\u2202",
    183: "\u2022",
    184: "\xF7",
    185: "\u2260",
    186: "\u2261",
    187: "\u2248",
    188: "\u2026",
    189: "\uF8E6",
    190: "\uF8E7",
    191: "\u21B5",
    192: "\u2135",
    193: "\u2111",
    194: "\u211C",
    195: "\u2118",
    196: "\u2297",
    197: "\u2295",
    198: "\u2205",
    199: "\u2229",
    200: "\u222A",
    201: "\u2283",
    202: "\u2287",
    203: "\u2284",
    204: "\u2282",
    205: "\u2286",
    206: "\u2208",
    207: "\u2209",
    208: "\u2220",
    209: "\u2207",
    210: "\uF6DA",
    211: "\uF6D9",
    212: "\uF6DB",
    213: "\u220F",
    214: "\u221A",
    215: "\u22C5",
    216: "\xAC",
    217: "\u2227",
    218: "\u2228",
    219: "\u21D4",
    220: "\u21D0",
    221: "\u21D1",
    222: "\u21D2",
    223: "\u21D3",
    224: "\u25CA",
    225: "\u2329",
    226: "\uF8E8",
    227: "\uF8E9",
    228: "\uF8EA",
    229: "\u2211",
    230: "\uF8EB",
    231: "\uF8EC",
    232: "\uF8ED",
    233: "\uF8EE",
    234: "\uF8EF",
    235: "\uF8F0",
    236: "\uF8F1",
    237: "\uF8F2",
    238: "\uF8F3",
    239: "\uF8F4",
    241: "\u232A",
    242: "\u222B",
    243: "\u2320",
    244: "\uF8F5",
    245: "\u2321",
    246: "\uF8F6",
    247: "\uF8F7",
    248: "\uF8F8",
    249: "\uF8F9",
    250: "\uF8FA",
    251: "\uF8FB",
    252: "\uF8FC",
    253: "\uF8FD",
    254: "\uF8FE"
  };
  var SYMBOL_GLYPH_TO_UNICODE = {
    bullet: "\u2022",
    periodcentered: "\xB7",
    circle: "\u25CB",
    filledcircle: "\u25CF",
    blackcircle: "\u25CF"
  };
  function isZapfDingbatsFont(baseFont) {
    const lower = baseFont.toLowerCase();
    return lower.includes("zapf") || lower.includes("dingbat");
  }
  function isSymbolFont(baseFont) {
    const lower = baseFont.toLowerCase().replace(/^[a-z]{6}\+/, "");
    return lower === "symbol" || /(^|[^a-z])symbol$/i.test(lower);
  }
  function zapfDingbatsCharToUnicode(charCode, differences) {
    const diffName = differences?.get(charCode);
    if (diffName) {
      if (ZAPF_DINGBATS_GLYPH_TO_UNICODE[diffName]) {
        return ZAPF_DINGBATS_GLYPH_TO_UNICODE[diffName];
      }
    }
    return ZAPF_DINGBATS_TO_UNICODE[charCode] ?? null;
  }
  function symbolCharToUnicode(charCode, differences) {
    const diffName = differences?.get(charCode);
    if (diffName) {
      if (SYMBOL_GLYPH_TO_UNICODE[diffName]) return SYMBOL_GLYPH_TO_UNICODE[diffName];
      if (SYMBOL_TO_UNICODE[charCode]) return SYMBOL_TO_UNICODE[charCode];
    }
    return SYMBOL_TO_UNICODE[charCode] ?? null;
  }
  function isSuspiciousDingbatToUnicode(unicode) {
    if (!unicode || unicode.length === 0) return true;
    if (unicode.length > 2) return false;
    const cp = unicode.codePointAt(0);
    return cp >= 65 && cp <= 90 || cp >= 97 && cp <= 122 || cp >= 48 && cp <= 57;
  }
  function unicodeFromGlyphId(glyphId, cmapEntries, baseFont) {
    let best = null;
    for (const [code, gid] of cmapEntries) {
      if (gid !== glyphId) continue;
      if (best == null) best = code;
      if (code >= 61472 && code <= 61695) {
        best = code;
        break;
      }
      if (code >= 32 && code <= 255 && (best < 32 || best > 255)) {
        best = code;
      }
    }
    if (best == null) return null;
    if (isSymbolFont(baseFont)) {
      const byte = best >= 61440 && best <= 61695 ? best & 255 : best;
      if (byte >= 0 && byte <= 255) {
        return symbolCharToUnicode(byte) ?? String.fromCodePoint(best);
      }
    }
    try {
      return String.fromCodePoint(best);
    } catch {
      return null;
    }
  }

  // src/engine/fonts/truetype-parser.ts
  var BinaryReader = class {
    constructor(data, offset = 0) {
      this.raw = data;
      this.data = new DataView(data.buffer, data.byteOffset, data.byteLength);
      this.pos = offset;
    }
    get length() {
      return this.raw.length;
    }
    readU8() {
      return this.data.getUint8(this.pos++);
    }
    readU16() {
      const v = this.data.getUint16(this.pos, false);
      this.pos += 2;
      return v;
    }
    readI16() {
      const v = this.data.getInt16(this.pos, false);
      this.pos += 2;
      return v;
    }
    readU32() {
      const v = this.data.getUint32(this.pos, false);
      this.pos += 4;
      return v;
    }
    readI32() {
      const v = this.data.getInt32(this.pos, false);
      this.pos += 4;
      return v;
    }
    readFixed() {
      return this.readI32() / 65536;
    }
    readTag() {
      let s = "";
      for (let i = 0; i < 4; i++) s += String.fromCharCode(this.readU8());
      return s;
    }
    readBytes(count) {
      const bytes = this.raw.slice(this.pos, this.pos + count);
      this.pos += count;
      return bytes;
    }
    readString(length) {
      let s = "";
      for (let i = 0; i < length; i++) s += String.fromCharCode(this.readU8());
      return s;
    }
    seek(offset) {
      this.pos = offset;
    }
    skip(count) {
      this.pos += count;
    }
    atEnd() {
      return this.pos >= this.raw.length;
    }
  };
  function isTrueTypeFontData(data) {
    if (data.length < 4) return false;
    const sig = data[0] << 24 | data[1] << 16 | data[2] << 8 | data[3];
    return sig === 65536 || // TrueType
    sig === 1953658213 || // 'true'
    sig === 1330926671;
  }
  function parseTTF(data) {
    const reader = new BinaryReader(data);
    const sfVersion = reader.readU32();
    const numTables = reader.readU16();
    reader.skip(6);
    const tables = /* @__PURE__ */ new Map();
    for (let i = 0; i < numTables; i++) {
      const tag = reader.readTag();
      const checksum = reader.readU32();
      const offset = reader.readU32();
      const length = reader.readU32();
      tables.set(tag, { tag, checksum, offset, length });
    }
    const font = {
      tables,
      numGlyphs: 0,
      unitsPerEm: 1e3,
      bbox: [0, 0, 0, 0],
      ascent: 800,
      descent: -200,
      lineGap: 0,
      advanceWidths: new Uint16Array(0),
      leftSideBearings: new Int16Array(0),
      cmapEntries: /* @__PURE__ */ new Map(),
      glyphNames: /* @__PURE__ */ new Map(),
      familyName: "",
      fullName: "",
      glyphCache: /* @__PURE__ */ new Map(),
      rawData: data,
      indexToLocFormat: 0
    };
    parseHead(data, tables, font);
    parseMaxp(data, tables, font);
    parseHhea(data, tables, font);
    parseHmtx(data, tables, font);
    parseCmap(data, tables, font);
    parseName(data, tables, font);
    parseOS2(data, tables, font);
    return font;
  }
  function parseHead(data, tables, font) {
    const table = tables.get("head");
    if (!table) return;
    const r = new BinaryReader(data, table.offset);
    r.skip(4);
    r.skip(4);
    r.skip(4);
    r.skip(4);
    r.skip(2);
    font.unitsPerEm = r.readU16();
    r.skip(16);
    font.bbox = [r.readI16(), r.readI16(), r.readI16(), r.readI16()];
    r.skip(2);
    r.skip(2);
    r.skip(2);
    font.indexToLocFormat = r.readI16();
  }
  function parseMaxp(data, tables, font) {
    const table = tables.get("maxp");
    if (!table) return;
    const r = new BinaryReader(data, table.offset);
    r.skip(4);
    font.numGlyphs = r.readU16();
  }
  function parseHhea(data, tables, font) {
    const table = tables.get("hhea");
    if (!table) return;
    const r = new BinaryReader(data, table.offset);
    r.skip(4);
    font.ascent = r.readI16();
    font.descent = r.readI16();
    font.lineGap = r.readI16();
  }
  function parseHmtx(data, tables, font) {
    const hheaTable = tables.get("hhea");
    const hmtxTable = tables.get("hmtx");
    if (!hheaTable || !hmtxTable) return;
    const hheaReader = new BinaryReader(data, hheaTable.offset);
    hheaReader.skip(34);
    const numberOfHMetrics = hheaReader.readU16();
    const r = new BinaryReader(data, hmtxTable.offset);
    font.advanceWidths = new Uint16Array(font.numGlyphs);
    font.leftSideBearings = new Int16Array(font.numGlyphs);
    let lastAdvanceWidth = 0;
    for (let i = 0; i < numberOfHMetrics && i < font.numGlyphs; i++) {
      font.advanceWidths[i] = r.readU16();
      font.leftSideBearings[i] = r.readI16();
      lastAdvanceWidth = font.advanceWidths[i];
    }
    for (let i = numberOfHMetrics; i < font.numGlyphs; i++) {
      font.advanceWidths[i] = lastAdvanceWidth;
      if (!r.atEnd()) {
        font.leftSideBearings[i] = r.readI16();
      }
    }
  }
  function parseCmap(data, tables, font) {
    const table = tables.get("cmap");
    if (!table) return;
    const r = new BinaryReader(data, table.offset);
    r.skip(2);
    const numSubtables = r.readU16();
    const subtables = [];
    for (let i = 0; i < numSubtables; i++) {
      const platformID = r.readU16();
      const encodingID = r.readU16();
      const offset = r.readU32();
      let priority = 0;
      if (platformID === 3 && encodingID === 1) priority = 10;
      else if (platformID === 3 && encodingID === 10) priority = 9;
      else if (platformID === 0) priority = 8;
      else if (platformID === 3 && encodingID === 0) priority = 6;
      else if (platformID === 1 && encodingID === 0) priority = 5;
      if (priority > 0) {
        subtables.push({ offset: table.offset + offset, priority });
      }
    }
    subtables.sort((a, b) => b.priority - a.priority);
    for (const sub of subtables) {
      const before = font.cmapEntries.size;
      const sr = new BinaryReader(data, sub.offset);
      const format = sr.readU16();
      const scratch = before === 0 ? font : {
        ...font,
        cmapEntries: /* @__PURE__ */ new Map()
      };
      switch (format) {
        case 0:
          parseCmapFormat0(sr, scratch);
          break;
        case 4:
          parseCmapFormat4(sr, scratch);
          break;
        case 6:
          parseCmapFormat6(sr, scratch);
          break;
        case 12:
          parseCmapFormat12(sr, scratch);
          break;
        default:
          break;
      }
      if (scratch === font) continue;
      for (const [code, gid] of scratch.cmapEntries) {
        if (!font.cmapEntries.has(code)) font.cmapEntries.set(code, gid);
      }
    }
  }
  function parseCmapFormat0(r, font) {
    r.skip(2);
    r.skip(2);
    for (let i = 0; i < 256; i++) {
      const glyphId = r.readU8();
      if (glyphId > 0) font.cmapEntries.set(i, glyphId);
    }
  }
  function parseCmapFormat4(r, font) {
    const length = r.readU16();
    r.skip(2);
    const segCount = r.readU16() / 2;
    r.skip(6);
    const endCodes = [];
    for (let i = 0; i < segCount; i++) endCodes.push(r.readU16());
    r.skip(2);
    const startCodes = [];
    for (let i = 0; i < segCount; i++) startCodes.push(r.readU16());
    const idDeltas = [];
    for (let i = 0; i < segCount; i++) idDeltas.push(r.readI16());
    const idRangeOffsetPos = r.pos;
    const idRangeOffsets = [];
    for (let i = 0; i < segCount; i++) idRangeOffsets.push(r.readU16());
    for (let i = 0; i < segCount; i++) {
      const start = startCodes[i];
      const end = endCodes[i];
      const delta = idDeltas[i];
      const rangeOffset = idRangeOffsets[i];
      if (start === 65535) continue;
      for (let c = start; c <= end; c++) {
        let glyphId;
        if (rangeOffset === 0) {
          glyphId = c + delta & 65535;
        } else {
          const glyphIndexOffset = idRangeOffsetPos + i * 2 + rangeOffset + (c - start) * 2;
          const glyphReader = new BinaryReader(font.rawData, glyphIndexOffset);
          glyphId = glyphReader.readU16();
          if (glyphId !== 0) {
            glyphId = glyphId + delta & 65535;
          }
        }
        if (glyphId !== 0) {
          font.cmapEntries.set(c, glyphId);
        }
      }
    }
  }
  function parseCmapFormat6(r, font) {
    r.skip(2);
    r.skip(2);
    const firstCode = r.readU16();
    const entryCount = r.readU16();
    for (let i = 0; i < entryCount; i++) {
      const glyphId = r.readU16();
      if (glyphId !== 0) {
        font.cmapEntries.set(firstCode + i, glyphId);
      }
    }
  }
  function parseCmapFormat12(r, font) {
    r.skip(2);
    r.skip(4);
    r.skip(4);
    const numGroups = r.readU32();
    for (let i = 0; i < numGroups; i++) {
      const startCharCode = r.readU32();
      const endCharCode = r.readU32();
      const startGlyphID = r.readU32();
      for (let c = startCharCode; c <= endCharCode; c++) {
        font.cmapEntries.set(c, startGlyphID + (c - startCharCode));
      }
    }
  }
  function parseName(data, tables, font) {
    const table = tables.get("name");
    if (!table) return;
    const r = new BinaryReader(data, table.offset);
    r.skip(2);
    const count = r.readU16();
    const stringOffset = r.readU16();
    for (let i = 0; i < count; i++) {
      const platformID = r.readU16();
      const encodingID = r.readU16();
      const languageID = r.readU16();
      const nameID = r.readU16();
      const length = r.readU16();
      const offset = r.readU16();
      if (nameID === 1 || nameID === 4) {
        const savedPos = r.pos;
        r.seek(table.offset + stringOffset + offset);
        let name = "";
        if (platformID === 3 || platformID === 0) {
          for (let j = 0; j < length; j += 2) {
            name += String.fromCharCode(r.readU16());
          }
        } else {
          name = r.readString(length);
        }
        r.seek(savedPos);
        if (nameID === 1 && !font.familyName) font.familyName = name;
        if (nameID === 4 && !font.fullName) font.fullName = name;
      }
    }
  }
  function parseOS2(data, tables, font) {
    const table = tables.get("OS/2");
    if (!table) return;
    const r = new BinaryReader(data, table.offset);
    r.skip(2);
    r.skip(2);
    r.skip(2);
    r.skip(2);
    r.skip(2);
    r.skip(20);
    r.skip(2);
    r.skip(2);
    r.skip(2);
    r.skip(10);
    r.skip(16);
    r.skip(4);
    r.skip(2);
    r.skip(4);
    const typoAscender = r.readI16();
    const typoDescender = r.readI16();
    if (typoAscender !== 0) font.ascent = typoAscender;
    if (typoDescender !== 0) font.descent = typoDescender;
  }
  function getGlyphWidth(font, glyphId) {
    if (glyphId < font.advanceWidths.length) {
      return font.advanceWidths[glyphId];
    }
    return font.advanceWidths[font.advanceWidths.length - 1] || 0;
  }
  function fontUnitsToTextSpace(value, unitsPerEm) {
    return value / unitsPerEm * 1e3;
  }

  // src/engine/fonts/cff-wrapper.ts
  function isCFFData(data) {
    if (!data || data.length < 4) return false;
    return data[0] === 1 && data[1] === 0 && data[2] >= 4 && data[3] >= 1 && data[3] <= 4;
  }
  function parseCFFMetadata(data) {
    try {
      if (!isCFFData(data)) return { numGlyphs: 1 };
      const hdrSize = data[2];
      let pos = hdrSize;
      if (pos + 2 > data.length) return { numGlyphs: 1 };
      const nameCount = data[pos] << 8 | data[pos + 1];
      pos += 2;
      let fontName;
      if (nameCount > 0) {
        const offSize = data[pos++];
        const offsetArrayStart = pos;
        const dataStart = offsetArrayStart + (nameCount + 1) * offSize;
        if (dataStart <= data.length) {
          const startOff = readCFFOffset(data, offsetArrayStart, offSize);
          const endOff = readCFFOffset(data, offsetArrayStart + offSize, offSize);
          const nameLen = endOff - startOff;
          const nameBytesPos = dataStart + startOff - 1;
          if (nameBytesPos + nameLen <= data.length) {
            let str = "";
            for (let i = 0; i < nameLen; i++) {
              str += String.fromCharCode(data[nameBytesPos + i]);
            }
            fontName = str;
          }
          const totalNameDataLen = readCFFOffset(data, offsetArrayStart + nameCount * offSize, offSize) - 1;
          pos = dataStart + totalNameDataLen;
        }
      }
      if (pos + 2 > data.length) return { numGlyphs: 1, fontName };
      const topDictCount = data[pos] << 8 | data[pos + 1];
      pos += 2;
      let charStringsOffset = null;
      let fontBBox;
      if (topDictCount > 0) {
        const offSize = data[pos++];
        const offsetArrayStart = pos;
        const dataStart = offsetArrayStart + (topDictCount + 1) * offSize;
        if (dataStart <= data.length) {
          const startOff = readCFFOffset(data, offsetArrayStart, offSize);
          const endOff = readCFFOffset(data, offsetArrayStart + offSize, offSize);
          const dictLen = endOff - startOff;
          const dictBytesPos = dataStart + startOff - 1;
          if (dictBytesPos + dictLen <= data.length) {
            const dictEnd = dictBytesPos + dictLen;
            let dPos = dictBytesPos;
            const stack = [];
            while (dPos < dictEnd) {
              const b0 = data[dPos++];
              if (b0 >= 32 && b0 <= 246) {
                stack.push(b0 - 139);
              } else if (b0 >= 247 && b0 <= 250) {
                const b1 = data[dPos++];
                stack.push((b0 - 247) * 256 + b1 + 108);
              } else if (b0 >= 251 && b0 <= 254) {
                const b1 = data[dPos++];
                stack.push(-(b0 - 251) * 256 - b1 - 108);
              } else if (b0 === 28) {
                const b1 = data[dPos++];
                const b2 = data[dPos++];
                let val = b1 << 8 | b2;
                if (val >= 32768) val -= 65536;
                stack.push(val);
              } else if (b0 === 29) {
                const b1 = data[dPos++];
                const b2 = data[dPos++];
                const b3 = data[dPos++];
                const b4 = data[dPos++];
                let val = b1 << 24 | b2 << 16 | b3 << 8 | b4;
                if (val >= 2147483648) val -= 4294967296;
                stack.push(val);
              } else if (b0 === 30) {
                while (dPos < dictEnd) {
                  const byte = data[dPos++];
                  if ((byte & 15) === 15 || (byte >> 4 & 15) === 15) break;
                }
                stack.push(0);
              } else if (b0 === 12) {
                const b1 = data[dPos++];
                stack.length = 0;
              } else {
                if (b0 === 17 && stack.length > 0) {
                  charStringsOffset = stack[stack.length - 1];
                } else if (b0 === 5 && stack.length >= 4) {
                  fontBBox = [
                    stack[stack.length - 4],
                    stack[stack.length - 3],
                    stack[stack.length - 2],
                    stack[stack.length - 1]
                  ];
                }
                stack.length = 0;
              }
            }
          }
        }
      }
      let numGlyphs = 1;
      if (charStringsOffset != null && charStringsOffset + 2 <= data.length) {
        const csCount = data[charStringsOffset] << 8 | data[charStringsOffset + 1];
        if (csCount > 0) numGlyphs = csCount;
      }
      return { numGlyphs, fontBBox, fontName };
    } catch {
      return { numGlyphs: 1 };
    }
  }
  function readCFFOffset(data, offset, offSize) {
    let v = 0;
    for (let i = 0; i < offSize; i++) {
      v = v << 8 | data[offset + i];
    }
    return v;
  }
  function wrapCFFInOTF(cffData, options = {}) {
    const metadata = parseCFFMetadata(cffData);
    const numGlyphs = Math.max(1, metadata.numGlyphs);
    const bbox = options.bbox || metadata.fontBBox || [-100, -200, 1e3, 800];
    const ascent = Math.round(options.ascent ?? (bbox[3] > 0 ? bbox[3] : 800));
    const descent = Math.round(options.descent ?? (bbox[1] < 0 ? bbox[1] : -200));
    const familyName = options.familyName || metadata.fontName || "EmbeddedFont";
    const weight = options.weight ?? 400;
    const isBold = weight >= 600 || /bold|black|heavy/i.test(familyName);
    const isItalic = options.italicAngle != null && Math.abs(options.italicAngle) > 1 || /italic|oblique/i.test(familyName);
    const widthsMap = options.widths || void 0;
    const cffTable = cffData;
    const headTable = buildHeadTable(bbox, isBold, isItalic);
    const hheaTable = buildHheaTable(numGlyphs, ascent, descent, widthsMap);
    const maxpTable = buildMaxpTable(numGlyphs);
    const hmtxTable = buildHmtxTable(numGlyphs, widthsMap);
    const cmapTable = buildCmapTable(numGlyphs);
    const nameTable = buildNameTable(familyName, isBold, isItalic);
    const os2Table = buildOS2Table(familyName, weight, isBold, isItalic, ascent, descent);
    const postTable = buildPostTable(options.italicAngle ?? 0);
    const tables = [
      { tag: "CFF ", data: cffTable },
      { tag: "OS/2", data: os2Table },
      { tag: "cmap", data: cmapTable },
      { tag: "head", data: headTable },
      { tag: "hhea", data: hheaTable },
      { tag: "hmtx", data: hmtxTable },
      { tag: "maxp", data: maxpTable },
      { tag: "name", data: nameTable },
      { tag: "post", data: postTable }
    ];
    const numTables = tables.length;
    const headerSize = 12 + numTables * 16;
    let currentOffset = headerSize;
    const tableEntries = [];
    for (const t of tables) {
      const length = t.data.length;
      const paddedLength = length + 3 & ~3;
      const paddedData = new Uint8Array(paddedLength);
      paddedData.set(t.data);
      const checksum = calcChecksum(paddedData);
      tableEntries.push({
        tag: t.tag,
        checksum,
        offset: currentOffset,
        length,
        paddedData
      });
      currentOffset += paddedLength;
    }
    const totalSize = currentOffset;
    const otf = new Uint8Array(totalSize);
    const view = new DataView(otf.buffer);
    view.setUint32(0, 1330926671, false);
    view.setUint16(4, numTables, false);
    const entrySelector = Math.floor(Math.log2(numTables));
    const searchRange = (1 << entrySelector) * 16;
    const rangeShift = numTables * 16 - searchRange;
    view.setUint16(6, searchRange, false);
    view.setUint16(8, entrySelector, false);
    view.setUint16(10, rangeShift, false);
    let dirOffset = 12;
    let headTableOffset = 0;
    for (const entry of tableEntries) {
      for (let i = 0; i < 4; i++) {
        otf[dirOffset + i] = entry.tag.charCodeAt(i);
      }
      view.setUint32(dirOffset + 4, entry.checksum, false);
      view.setUint32(dirOffset + 8, entry.offset, false);
      view.setUint32(dirOffset + 12, entry.length, false);
      if (entry.tag === "head") {
        headTableOffset = entry.offset;
      }
      otf.set(entry.paddedData, entry.offset);
      dirOffset += 16;
    }
    if (headTableOffset > 0) {
      const fileChecksum = calcChecksum(otf);
      const checksumAdjustment = 2981146554 - fileChecksum >>> 0;
      view.setUint32(headTableOffset + 8, checksumAdjustment, false);
    }
    return otf;
  }
  function buildHeadTable(bbox, isBold, isItalic) {
    const buf = new Uint8Array(54);
    const view = new DataView(buf.buffer);
    view.setUint16(0, 1, false);
    view.setUint16(2, 0, false);
    view.setUint32(4, 65536, false);
    view.setUint32(8, 0, false);
    view.setUint32(12, 1594834165, false);
    view.setUint16(16, 3, false);
    view.setUint16(18, 1e3, false);
    view.setInt16(36, bbox[0], false);
    view.setInt16(38, bbox[1], false);
    view.setInt16(40, bbox[2], false);
    view.setInt16(42, bbox[3], false);
    let macStyle = 0;
    if (isBold) macStyle |= 1;
    if (isItalic) macStyle |= 2;
    view.setUint16(44, macStyle, false);
    view.setUint16(46, 6, false);
    view.setInt16(48, 2, false);
    view.setInt16(50, 0, false);
    view.setInt16(52, 0, false);
    return buf;
  }
  function buildHheaTable(numGlyphs, ascent, descent, widths) {
    const buf = new Uint8Array(36);
    const view = new DataView(buf.buffer);
    let maxWidth = 1e3;
    if (widths && widths.size > 0) {
      for (const w of widths.values()) {
        if (w > maxWidth) maxWidth = Math.round(w);
      }
    }
    view.setUint16(0, 1, false);
    view.setUint16(2, 0, false);
    view.setInt16(4, ascent, false);
    view.setInt16(6, descent, false);
    view.setInt16(8, 0, false);
    view.setUint16(10, Math.min(65535, maxWidth), false);
    view.setInt16(12, 0, false);
    view.setInt16(14, 0, false);
    view.setInt16(16, Math.min(32767, maxWidth), false);
    view.setInt16(18, 1, false);
    view.setInt16(20, 0, false);
    view.setInt16(22, 0, false);
    view.setInt16(32, 0, false);
    view.setUint16(34, numGlyphs, false);
    return buf;
  }
  function buildMaxpTable(numGlyphs) {
    const buf = new Uint8Array(6);
    const view = new DataView(buf.buffer);
    view.setUint32(0, 20480, false);
    view.setUint16(4, numGlyphs, false);
    return buf;
  }
  function buildHmtxTable(numGlyphs, widths) {
    const buf = new Uint8Array(numGlyphs * 4);
    const view = new DataView(buf.buffer);
    for (let i = 0; i < numGlyphs; i++) {
      const w = widths?.get(i) ?? 1e3;
      view.setUint16(i * 4, Math.round(Math.max(0, Math.min(65535, w))), false);
      view.setInt16(i * 4 + 2, 0, false);
    }
    return buf;
  }
  function buildCmapTable(numGlyphs) {
    const segCount = 2;
    const segCountX2 = segCount * 2;
    const entrySelector = 1;
    const searchRange = 4;
    const rangeShift = 0;
    const subtableLength = 16 + segCount * 8;
    const cmapLength = 20 + subtableLength;
    const buf = new Uint8Array(cmapLength);
    const view = new DataView(buf.buffer);
    view.setUint16(0, 0, false);
    view.setUint16(2, 2, false);
    view.setUint16(4, 0, false);
    view.setUint16(6, 3, false);
    view.setUint32(8, 20, false);
    view.setUint16(12, 3, false);
    view.setUint16(14, 1, false);
    view.setUint32(16, 20, false);
    const sub = 20;
    view.setUint16(sub, 4, false);
    view.setUint16(sub + 2, subtableLength, false);
    view.setUint16(sub + 4, 0, false);
    view.setUint16(sub + 6, segCountX2, false);
    view.setUint16(sub + 8, searchRange, false);
    view.setUint16(sub + 10, entrySelector, false);
    view.setUint16(sub + 12, rangeShift, false);
    view.setUint16(sub + 14, 65534, false);
    view.setUint16(sub + 16, 65535, false);
    view.setUint16(sub + 18, 0, false);
    view.setUint16(sub + 20, 0, false);
    view.setUint16(sub + 22, 65535, false);
    view.setInt16(sub + 24, 0, false);
    view.setInt16(sub + 26, 1, false);
    view.setUint16(sub + 28, 0, false);
    view.setUint16(sub + 30, 0, false);
    return buf;
  }
  function buildNameTable(familyName, isBold, isItalic) {
    const cleanFamily = familyName.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "EmbeddedFont";
    let subfamily = "Regular";
    if (isBold && isItalic) subfamily = "Bold Italic";
    else if (isBold) subfamily = "Bold";
    else if (isItalic) subfamily = "Italic";
    const fullName = `${cleanFamily} ${subfamily}`;
    const psName = cleanFamily.replace(/\s+/g, "") + "-" + subfamily.replace(/\s+/g, "");
    const names = [
      { id: 1, text: cleanFamily },
      // Family Name
      { id: 2, text: subfamily },
      // Subfamily Name
      { id: 4, text: fullName },
      // Full Name
      { id: 6, text: psName }
      // PostScript Name
    ];
    const encodedStrings = [];
    let stringStorageLen = 0;
    for (const n of names) {
      const strBytes = new Uint8Array(n.text.length * 2);
      for (let i = 0; i < n.text.length; i++) {
        const code = n.text.charCodeAt(i);
        strBytes[i * 2] = code >> 8;
        strBytes[i * 2 + 1] = code & 255;
      }
      encodedStrings.push({
        id: n.id,
        data: strBytes,
        offset: stringStorageLen
      });
      stringStorageLen += strBytes.length;
    }
    const recordCount = names.length;
    const stringOffset = 6 + recordCount * 12;
    const tableLength = stringOffset + stringStorageLen;
    const buf = new Uint8Array(tableLength);
    const view = new DataView(buf.buffer);
    view.setUint16(0, 0, false);
    view.setUint16(2, recordCount, false);
    view.setUint16(4, stringOffset, false);
    let rPos = 6;
    for (const s of encodedStrings) {
      view.setUint16(rPos, 3, false);
      view.setUint16(rPos + 2, 1, false);
      view.setUint16(rPos + 4, 1033, false);
      view.setUint16(rPos + 6, s.id, false);
      view.setUint16(rPos + 8, s.data.length, false);
      view.setUint16(rPos + 10, s.offset, false);
      rPos += 12;
      buf.set(s.data, stringOffset + s.offset);
    }
    return buf;
  }
  function buildOS2Table(familyName, weight, isBold, isItalic, ascent, descent) {
    const buf = new Uint8Array(96);
    const view = new DataView(buf.buffer);
    view.setUint16(0, 3, false);
    view.setInt16(2, 500, false);
    view.setUint16(4, Math.max(100, Math.min(900, weight)), false);
    view.setUint16(6, 5, false);
    view.setUint16(8, 0, false);
    view.setInt16(10, 650, false);
    view.setInt16(12, 600, false);
    view.setInt16(14, 0, false);
    view.setInt16(16, 75, false);
    view.setInt16(18, 650, false);
    view.setInt16(20, 600, false);
    view.setInt16(22, 0, false);
    view.setInt16(24, 350, false);
    view.setInt16(26, 50, false);
    view.setInt16(28, 300, false);
    view.setInt16(30, 0, false);
    view.setUint32(42, 4294967295, false);
    view.setUint32(46, 4294967295, false);
    view.setUint32(50, 4294967295, false);
    view.setUint32(54, 4294967295, false);
    buf[58] = 78;
    buf[59] = 79;
    buf[60] = 78;
    buf[61] = 69;
    let fsSelection = 0;
    if (isBold) fsSelection |= 1 << 5;
    if (isItalic) fsSelection |= 1 << 0;
    if (!isBold && !isItalic) fsSelection |= 1 << 6;
    view.setUint16(62, fsSelection, false);
    view.setUint16(64, 32, false);
    view.setUint16(66, 65535, false);
    view.setInt16(68, ascent, false);
    view.setInt16(70, descent, false);
    view.setInt16(72, 0, false);
    view.setUint16(74, Math.abs(ascent) || 800, false);
    view.setUint16(76, Math.abs(descent) || 200, false);
    view.setUint32(78, 1, false);
    view.setUint32(82, 0, false);
    view.setInt16(86, 500, false);
    view.setInt16(88, 700, false);
    view.setUint16(90, 0, false);
    view.setUint16(92, 32, false);
    view.setUint16(94, 1, false);
    return buf;
  }
  function buildPostTable(italicAngle) {
    const buf = new Uint8Array(32);
    const view = new DataView(buf.buffer);
    view.setUint32(0, 196608, false);
    view.setInt32(4, Math.round(italicAngle * 65536), false);
    view.setInt16(8, -100, false);
    view.setInt16(10, 50, false);
    view.setUint32(12, 0, false);
    return buf;
  }
  function calcChecksum(data) {
    let sum = 0;
    const len = data.length & ~3;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    for (let i = 0; i < len; i += 4) {
      sum = sum + view.getUint32(i, false) >>> 0;
    }
    const remaining = data.length - len;
    if (remaining > 0) {
      let last = 0;
      for (let i = 0; i < remaining; i++) {
        last |= data[len + i] << (3 - i) * 8;
      }
      sum = sum + (last >>> 0) >>> 0;
    }
    return sum;
  }

  // src/engine/content/interpreter.ts
  function identityMatrix() {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  }
  function multiplyMatrices(m1, m2) {
    return {
      a: m1.a * m2.a + m1.b * m2.c,
      b: m1.a * m2.b + m1.b * m2.d,
      c: m1.c * m2.a + m1.d * m2.c,
      d: m1.c * m2.b + m1.d * m2.d,
      e: m1.e * m2.a + m1.f * m2.c + m2.e,
      f: m1.e * m2.b + m1.f * m2.d + m2.f
    };
  }
  function transformPoint(m, x, y) {
    return [
      m.a * x + m.c * y + m.e,
      m.b * x + m.d * y + m.f
    ];
  }
  function defaultGraphicsState() {
    return {
      ctm: identityMatrix(),
      fillColor: [0, 0, 0],
      strokeColor: [0, 0, 0],
      fillAlpha: 1,
      strokeAlpha: 1,
      lineWidth: 1,
      lineCap: 0,
      lineJoin: 0,
      miterLimit: 10,
      dashPattern: [],
      dashPhase: 0,
      textFont: "",
      textFontSize: 12,
      charSpacing: 0,
      wordSpacing: 0,
      horizontalScaling: 100,
      textLeading: 0,
      textRenderMode: 0,
      textRise: 0,
      blendMode: "Normal",
      softMask: null,
      clipPaths: []
    };
  }
  function cloneGraphicsState(gs) {
    return {
      ...gs,
      ctm: { ...gs.ctm },
      fillColor: [...gs.fillColor],
      strokeColor: [...gs.strokeColor],
      dashPattern: [...gs.dashPattern],
      clipPaths: [...gs.clipPaths]
    };
  }
  var WIN_ANSI_TO_UNICODE = {
    128: 8364,
    // € Euro sign
    130: 8218,
    // ‚ Single low-9 quotation mark
    131: 402,
    // ƒ Latin small letter f with hook
    132: 8222,
    // „ Double low-9 quotation mark
    133: 8230,
    // … Horizontal ellipsis
    134: 8224,
    // † Dagger
    135: 8225,
    // ‡ Double dagger
    136: 710,
    // ˆ Modifier letter circumflex accent
    137: 8240,
    // ‰ Per mille sign
    138: 352,
    // Š Latin capital letter S with caron
    139: 8249,
    // ‹ Single left-pointing angle quotation mark
    140: 338,
    // Œ Latin capital ligature OE
    142: 381,
    // Ž Latin capital letter Z with caron
    145: 8216,
    // ' Left single quotation mark
    146: 8217,
    // ' Right single quotation mark
    147: 8220,
    // " Left double quotation mark
    148: 8221,
    // " Right double quotation mark
    149: 8226,
    // • Bullet
    150: 8211,
    // – En dash
    151: 8212,
    // — Em dash
    152: 732,
    // ˜ Small tilde
    153: 8482,
    // ™ Trade mark sign
    154: 353,
    // š Latin small letter s with caron
    155: 8250,
    // › Single right-pointing angle quotation mark
    156: 339,
    // œ Latin small ligature oe
    158: 382,
    // ž Latin small letter z with caron
    159: 376
    // Ÿ Latin capital letter Y with diaeresis
  };
  var GLYPH_NAME_TO_UNICODE = {
    space: " ",
    exclam: "!",
    quotedbl: '"',
    numbersign: "#",
    dollar: "$",
    percent: "%",
    ampersand: "&",
    quotesingle: "'",
    parenleft: "(",
    parenright: ")",
    asterisk: "*",
    plus: "+",
    comma: ",",
    hyphen: "-",
    period: ".",
    slash: "/",
    zero: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    colon: ":",
    semicolon: ";",
    less: "<",
    equal: "=",
    greater: ">",
    question: "?",
    at: "@",
    A: "A",
    B: "B",
    C: "C",
    D: "D",
    E: "E",
    F: "F",
    G: "G",
    H: "H",
    I: "I",
    J: "J",
    K: "K",
    L: "L",
    M: "M",
    N: "N",
    O: "O",
    P: "P",
    Q: "Q",
    R: "R",
    S: "S",
    T: "T",
    U: "U",
    V: "V",
    W: "W",
    X: "X",
    Y: "Y",
    Z: "Z",
    bracketleft: "[",
    backslash: "\\",
    bracketright: "]",
    asciicircum: "^",
    underscore: "_",
    grave: "`",
    a: "a",
    b: "b",
    c: "c",
    d: "d",
    e: "e",
    f: "f",
    g: "g",
    h: "h",
    i: "i",
    j: "j",
    k: "k",
    l: "l",
    m: "m",
    n: "n",
    o: "o",
    p: "p",
    q: "q",
    r: "r",
    s: "s",
    t: "t",
    u: "u",
    v: "v",
    w: "w",
    x: "x",
    y: "y",
    z: "z",
    braceleft: "{",
    bar: "|",
    braceright: "}",
    asciitilde: "~",
    // Extended Latin
    Agrave: "\xC0",
    Aacute: "\xC1",
    Acircumflex: "\xC2",
    Atilde: "\xC3",
    Adieresis: "\xC4",
    Aring: "\xC5",
    AE: "\xC6",
    Ccedilla: "\xC7",
    Egrave: "\xC8",
    Eacute: "\xC9",
    Ecircumflex: "\xCA",
    Edieresis: "\xCB",
    Igrave: "\xCC",
    Iacute: "\xCD",
    Icircumflex: "\xCE",
    Idieresis: "\xCF",
    Eth: "\xD0",
    Ntilde: "\xD1",
    Ograve: "\xD2",
    Oacute: "\xD3",
    Ocircumflex: "\xD4",
    Otilde: "\xD5",
    Odieresis: "\xD6",
    multiply: "\xD7",
    Oslash: "\xD8",
    Ugrave: "\xD9",
    Uacute: "\xDA",
    Ucircumflex: "\xDB",
    Udieresis: "\xDC",
    Yacute: "\xDD",
    Thorn: "\xDE",
    germandbls: "\xDF",
    agrave: "\xE0",
    aacute: "\xE1",
    acircumflex: "\xE2",
    atilde: "\xE3",
    adieresis: "\xE4",
    aring: "\xE5",
    ae: "\xE6",
    ccedilla: "\xE7",
    egrave: "\xE8",
    eacute: "\xE9",
    ecircumflex: "\xEA",
    edieresis: "\xEB",
    igrave: "\xEC",
    iacute: "\xED",
    icircumflex: "\xEE",
    idieresis: "\xEF",
    eth: "\xF0",
    ntilde: "\xF1",
    ograve: "\xF2",
    oacute: "\xF3",
    ocircumflex: "\xF4",
    otilde: "\xF5",
    odieresis: "\xF6",
    divide: "\xF7",
    oslash: "\xF8",
    ugrave: "\xF9",
    uacute: "\xFA",
    ucircumflex: "\xFB",
    udieresis: "\xFC",
    yacute: "\xFD",
    thorn: "\xFE",
    ydieresis: "\xFF",
    // Symbols and punctuation
    bullet: "\u2022",
    endash: "\u2013",
    emdash: "\u2014",
    ellipsis: "\u2026",
    quotedblleft: "\u201C",
    quotedblright: "\u201D",
    quoteleft: "\u2018",
    quoteright: "\u2019",
    quotesinglbase: "\u201A",
    quotedblbase: "\u201E",
    dagger: "\u2020",
    daggerdbl: "\u2021",
    perthousand: "\u2030",
    guilsinglleft: "\u2039",
    guilsinglright: "\u203A",
    guillemotleft: "\xAB",
    guillemotright: "\xBB",
    fi: "fi",
    fl: "fl",
    ff: "ff",
    ffi: "ffi",
    ffl: "ffl",
    trademark: "\u2122",
    copyright: "\xA9",
    registered: "\xAE",
    degree: "\xB0",
    plusminus: "\xB1",
    mu: "\xB5",
    paragraph: "\xB6",
    section: "\xA7",
    Euro: "\u20AC",
    sterling: "\xA3",
    yen: "\xA5",
    cent: "\xA2",
    currency: "\xA4",
    florin: "\u0192",
    fraction: "\u2044",
    minus: "\u2212",
    dotlessi: "\u0131",
    lslash: "\u0142",
    Lslash: "\u0141",
    OE: "\u0152",
    oe: "\u0153",
    Scaron: "\u0160",
    scaron: "\u0161",
    Zcaron: "\u017D",
    zcaron: "\u017E",
    Ydieresis: "\u0178",
    brokenbar: "\xA6",
    exclamdown: "\xA1",
    questiondown: "\xBF",
    logicalnot: "\xAC",
    ordfeminine: "\xAA",
    ordmasculine: "\xBA",
    onehalf: "\xBD",
    onequarter: "\xBC",
    threequarters: "\xBE",
    onesuperior: "\xB9",
    twosuperior: "\xB2",
    threesuperior: "\xB3",
    nbspace: "\xA0",
    circumflex: "\u02C6",
    tilde: "\u02DC",
    macron: "\xAF",
    breve: "\u02D8",
    dotaccent: "\u02D9",
    ring: "\u02DA",
    cedilla: "\xB8",
    hungarumlaut: "\u02DD",
    ogonek: "\u02DB",
    caron: "\u02C7"
  };
  function glyphNameToUnicode(name) {
    if (GLYPH_NAME_TO_UNICODE[name]) return GLYPH_NAME_TO_UNICODE[name];
    if (ZAPF_DINGBATS_GLYPH_TO_UNICODE[name]) return ZAPF_DINGBATS_GLYPH_TO_UNICODE[name];
    if (name.startsWith("uni") && name.length === 7) {
      const code = parseInt(name.substring(3), 16);
      if (!isNaN(code) && code > 0) return String.fromCodePoint(code);
    }
    return "";
  }
  function isObscureSymbol(ch) {
    if (!ch || ch.length === 0) return true;
    const cp = ch.codePointAt(0) ?? 0;
    return cp === 167 || cp === 182 || cp === 164 || cp === 8224 || cp === 8225 || cp === 8251 || cp === 166 || cp === 172;
  }
  function encodingCharToUnicode(charCode, encoding) {
    if (charCode >= 128 && charCode <= 159) {
      const mapped = WIN_ANSI_TO_UNICODE[charCode];
      if (mapped) return String.fromCodePoint(mapped);
    }
    return String.fromCharCode(charCode);
  }
  function interpretPage(contentBytes, page, objects) {
    const instructions = parseContentStream(contentBytes);
    const displayList = [];
    const rawTextRuns = [];
    const fonts = /* @__PURE__ */ new Map();
    let gs = defaultGraphicsState();
    const gsStack = [];
    let textMatrix = identityMatrix();
    let textLineMatrix = identityMatrix();
    let inTextBlock = false;
    let currentPath = [];
    let pathStartX = 0;
    let pathStartY = 0;
    loadFonts(page.resources, objects, fonts);
    function num(obj) {
      return obj instanceof PDFNumber ? obj.value : 0;
    }
    function nameStr(obj) {
      return obj instanceof PDFName ? obj.name : "";
    }
    for (let i = 0; i < instructions.length; i++) {
      const inst = instructions[i];
      const ops = inst.operands;
      switch (inst.operator) {
        // ── Graphics state ──────────────────────────────────────────────
        case "q":
          gsStack.push(cloneGraphicsState(gs));
          break;
        case "Q":
          if (gsStack.length > 0) gs = gsStack.pop();
          break;
        case "cm": {
          const m = {
            a: num(ops[0]),
            b: num(ops[1]),
            c: num(ops[2]),
            d: num(ops[3]),
            e: num(ops[4]),
            f: num(ops[5])
          };
          gs.ctm = multiplyMatrices(m, gs.ctm);
          break;
        }
        case "w":
          gs.lineWidth = num(ops[0]);
          break;
        case "J":
          gs.lineCap = num(ops[0]);
          break;
        case "j":
          gs.lineJoin = num(ops[0]);
          break;
        case "M":
          gs.miterLimit = num(ops[0]);
          break;
        case "d": {
          const arr = ops[0] instanceof PDFArray ? ops[0].asNumbers() : [];
          gs.dashPattern = arr;
          gs.dashPhase = num(ops[1]);
          break;
        }
        case "gs": {
          const gsName = nameStr(ops[0]);
          const gsDict = getResource(page.resources, "ExtGState", gsName, objects);
          if (gsDict instanceof PDFDict) {
            applyExtGState(gsDict, gs, objects);
          }
          break;
        }
        // ── Color operators ─────────────────────────────────────────────
        case "g":
          gs.fillColor = [num(ops[0]), num(ops[0]), num(ops[0])];
          break;
        case "G":
          gs.strokeColor = [num(ops[0]), num(ops[0]), num(ops[0])];
          break;
        case "rg":
          gs.fillColor = [num(ops[0]), num(ops[1]), num(ops[2])];
          break;
        case "RG":
          gs.strokeColor = [num(ops[0]), num(ops[1]), num(ops[2])];
          break;
        case "k": {
          const [c, m, y, k] = [num(ops[0]), num(ops[1]), num(ops[2]), num(ops[3])];
          gs.fillColor = cmykToRgb(c, m, y, k);
          break;
        }
        case "K": {
          const [c, m, y, k] = [num(ops[0]), num(ops[1]), num(ops[2]), num(ops[3])];
          gs.strokeColor = cmykToRgb(c, m, y, k);
          break;
        }
        case "sc":
        case "scn":
          if (ops.length >= 3) gs.fillColor = [num(ops[0]), num(ops[1]), num(ops[2])];
          else if (ops.length >= 1) gs.fillColor = [num(ops[0]), num(ops[0]), num(ops[0])];
          break;
        case "SC":
        case "SCN":
          if (ops.length >= 3) gs.strokeColor = [num(ops[0]), num(ops[1]), num(ops[2])];
          else if (ops.length >= 1) gs.strokeColor = [num(ops[0]), num(ops[0]), num(ops[0])];
          break;
        // ── Text state ──────────────────────────────────────────────────
        case "Tc":
          gs.charSpacing = num(ops[0]);
          break;
        case "Tw":
          gs.wordSpacing = num(ops[0]);
          break;
        case "Tz":
          gs.horizontalScaling = num(ops[0]);
          break;
        case "TL":
          gs.textLeading = num(ops[0]);
          break;
        case "Tf":
          gs.textFont = nameStr(ops[0]);
          gs.textFontSize = num(ops[1]);
          break;
        case "Tr":
          gs.textRenderMode = num(ops[0]);
          break;
        case "Ts":
          gs.textRise = num(ops[0]);
          break;
        // ── Text blocks ─────────────────────────────────────────────────
        case "BT":
          inTextBlock = true;
          textMatrix = identityMatrix();
          textLineMatrix = identityMatrix();
          break;
        case "ET":
          inTextBlock = false;
          break;
        // ── Text positioning ────────────────────────────────────────────
        case "Td": {
          const tx = num(ops[0]);
          const ty = num(ops[1]);
          const m = { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
          textLineMatrix = multiplyMatrices(m, textLineMatrix);
          textMatrix = { ...textLineMatrix };
          break;
        }
        case "TD": {
          const tx = num(ops[0]);
          const ty = num(ops[1]);
          gs.textLeading = -ty;
          const m = { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
          textLineMatrix = multiplyMatrices(m, textLineMatrix);
          textMatrix = { ...textLineMatrix };
          break;
        }
        case "Tm": {
          textMatrix = {
            a: num(ops[0]),
            b: num(ops[1]),
            c: num(ops[2]),
            d: num(ops[3]),
            e: num(ops[4]),
            f: num(ops[5])
          };
          textLineMatrix = { ...textMatrix };
          break;
        }
        case "T*": {
          const m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: -gs.textLeading };
          textLineMatrix = multiplyMatrices(m, textLineMatrix);
          textMatrix = { ...textLineMatrix };
          break;
        }
        // ── Text showing ────────────────────────────────────────────────
        case "Tj": {
          const strObj = ops[0];
          if (strObj) {
            const result = showTextString(strObj, gs, textMatrix, fonts, objects, page, i);
            if (result) {
              displayList.push(result.run);
              rawTextRuns.push(result.run);
              textMatrix = result.newTextMatrix;
            }
          }
          break;
        }
        case "TJ": {
          const arr = ops[0];
          if (arr instanceof PDFArray) {
            const combinedGlyphs = [];
            let combinedText = "";
            let firstRun = null;
            let lastRun = null;
            for (let j = 0; j < arr.length; j++) {
              const item = arr.get(j);
              if (item instanceof PDFNumber) {
                const displacement = -item.value / 1e3 * gs.textFontSize * (gs.horizontalScaling / 100);
                textMatrix = {
                  ...textMatrix,
                  e: textMatrix.e + displacement * textMatrix.a,
                  f: textMatrix.f + displacement * textMatrix.b
                };
              } else {
                const result = showTextString(item, gs, textMatrix, fonts, objects, page, i);
                if (result) {
                  if (!firstRun) firstRun = result.run;
                  lastRun = result.run;
                  combinedGlyphs.push(...result.run.glyphs);
                  combinedText += result.run.text;
                  textMatrix = result.newTextMatrix;
                }
              }
            }
            if (firstRun && lastRun && combinedGlyphs.length > 0) {
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              for (let k = 0; k < combinedGlyphs.length; k++) {
                const g = combinedGlyphs[k];
                if (g.x < minX) minX = g.x;
                if (g.y < minY) minY = g.y;
                if (g.x + g.width > maxX) maxX = g.x + g.width;
                if (g.y + g.fontSize > maxY) maxY = g.y + g.fontSize;
              }
              const combinedRun = {
                ...firstRun,
                text: combinedText,
                glyphs: combinedGlyphs,
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
              };
              displayList.push(combinedRun);
              rawTextRuns.push(combinedRun);
            }
          }
          break;
        }
        case "'": {
          const m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: -gs.textLeading };
          textLineMatrix = multiplyMatrices(m, textLineMatrix);
          textMatrix = { ...textLineMatrix };
          const strObj = ops[0];
          if (strObj) {
            const result = showTextString(strObj, gs, textMatrix, fonts, objects, page, i);
            if (result) {
              displayList.push(result.run);
              rawTextRuns.push(result.run);
              textMatrix = result.newTextMatrix;
            }
          }
          break;
        }
        case '"': {
          gs.wordSpacing = num(ops[0]);
          gs.charSpacing = num(ops[1]);
          const m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: -gs.textLeading };
          textLineMatrix = multiplyMatrices(m, textLineMatrix);
          textMatrix = { ...textLineMatrix };
          const strObj = ops[2];
          if (strObj) {
            const result = showTextString(strObj, gs, textMatrix, fonts, objects, page, i);
            if (result) {
              displayList.push(result.run);
              rawTextRuns.push(result.run);
              textMatrix = result.newTextMatrix;
            }
          }
          break;
        }
        // ── Path construction ───────────────────────────────────────────
        case "m": {
          const [x, y] = transformPoint(gs.ctm, num(ops[0]), num(ops[1]));
          currentPath.push({ type: "M", points: [x, y] });
          pathStartX = x;
          pathStartY = y;
          break;
        }
        case "l": {
          const [x, y] = transformPoint(gs.ctm, num(ops[0]), num(ops[1]));
          currentPath.push({ type: "L", points: [x, y] });
          break;
        }
        case "c": {
          const [x1, y1] = transformPoint(gs.ctm, num(ops[0]), num(ops[1]));
          const [x2, y2] = transformPoint(gs.ctm, num(ops[2]), num(ops[3]));
          const [x3, y3] = transformPoint(gs.ctm, num(ops[4]), num(ops[5]));
          currentPath.push({ type: "C", points: [x1, y1, x2, y2, x3, y3] });
          break;
        }
        case "v": {
          const lastSeg = currentPath[currentPath.length - 1];
          const cx = lastSeg ? lastSeg.points[lastSeg.points.length - 2] : 0;
          const cy = lastSeg ? lastSeg.points[lastSeg.points.length - 1] : 0;
          const [x2, y2] = transformPoint(gs.ctm, num(ops[0]), num(ops[1]));
          const [x3, y3] = transformPoint(gs.ctm, num(ops[2]), num(ops[3]));
          currentPath.push({ type: "C", points: [cx, cy, x2, y2, x3, y3] });
          break;
        }
        case "y": {
          const [x1, y1] = transformPoint(gs.ctm, num(ops[0]), num(ops[1]));
          const [x3, y3] = transformPoint(gs.ctm, num(ops[2]), num(ops[3]));
          currentPath.push({ type: "C", points: [x1, y1, x3, y3, x3, y3] });
          break;
        }
        case "h":
          currentPath.push({ type: "Z", points: [] });
          break;
        case "re": {
          const rx = num(ops[0]);
          const ry = num(ops[1]);
          const rw = num(ops[2]);
          const rh = num(ops[3]);
          const [p1x, p1y] = transformPoint(gs.ctm, rx, ry);
          const [p2x, p2y] = transformPoint(gs.ctm, rx + rw, ry);
          const [p3x, p3y] = transformPoint(gs.ctm, rx + rw, ry + rh);
          const [p4x, p4y] = transformPoint(gs.ctm, rx, ry + rh);
          currentPath.push({ type: "M", points: [p1x, p1y] });
          currentPath.push({ type: "L", points: [p2x, p2y] });
          currentPath.push({ type: "L", points: [p3x, p3y] });
          currentPath.push({ type: "L", points: [p4x, p4y] });
          currentPath.push({ type: "Z", points: [] });
          break;
        }
        // ── Path painting ───────────────────────────────────────────────
        case "S":
          emitPath("stroke");
          break;
        case "s": {
          currentPath.push({ type: "Z", points: [] });
          emitPath("stroke");
          break;
        }
        case "f":
        case "F":
          emitPath("fill");
          break;
        case "f*":
          emitPath("fill");
          break;
        case "B":
          emitPath("both");
          break;
        case "B*":
          emitPath("both");
          break;
        case "b": {
          currentPath.push({ type: "Z", points: [] });
          emitPath("both");
          break;
        }
        case "b*": {
          currentPath.push({ type: "Z", points: [] });
          emitPath("both");
          break;
        }
        case "W": {
          const wSegments = [...currentPath];
          if (wSegments.length > 0 && !isDegenerateClipPath(wSegments)) {
            gs.clipPaths = [...gs.clipPaths, { segments: wSegments, windingRule: "nonzero" }];
          }
          break;
        }
        case "W*": {
          const wsSegments = [...currentPath];
          if (wsSegments.length > 0 && !isDegenerateClipPath(wsSegments)) {
            gs.clipPaths = [...gs.clipPaths, { segments: wsSegments, windingRule: "evenodd" }];
          }
          break;
        }
        case "n": {
          currentPath = [];
          break;
        }
        // Discard path
        // ── XObjects ────────────────────────────────────────────────────
        case "Do": {
          const xobjName = nameStr(ops[0]);
          if (xobjName) {
            const xobj = getResource(page.resources, "XObject", xobjName, objects);
            if (xobj instanceof PDFStream) {
              const subtype = xobj.dict.getName("Subtype");
              if (subtype === "Image") {
                const imgW = xobj.dict.getNumber("Width") ?? 1;
                const imgH = xobj.dict.getNumber("Height") ?? 1;
                const [x, y] = transformPoint(gs.ctm, 0, 0);
                const [x2, y2] = transformPoint(gs.ctm, 1, 1);
                displayList.push({
                  type: "image",
                  name: xobjName,
                  ctm: { ...gs.ctm },
                  x: Math.min(x, x2),
                  y: Math.min(y, y2),
                  width: Math.abs(x2 - x),
                  height: Math.abs(y2 - y),
                  blendMode: gs.blendMode,
                  softMask: gs.softMask,
                  clipPaths: [...gs.clipPaths],
                  sourceInstructionIndex: i
                });
              } else if (subtype === "Form") {
                displayList.push({
                  type: "form",
                  name: xobjName,
                  ctm: { ...gs.ctm },
                  blendMode: gs.blendMode,
                  softMask: gs.softMask,
                  clipPaths: [...gs.clipPaths]
                });
              }
            }
          }
          break;
        }
        // ── Shading ─────────────────────────────────────────────────────
        case "sh": {
          const shName = nameStr(ops[0]);
          if (shName) {
            displayList.push({
              type: "shading",
              name: shName,
              ctm: { ...gs.ctm },
              blendMode: gs.blendMode,
              softMask: gs.softMask,
              clipPaths: [...gs.clipPaths]
            });
          }
          break;
        }
        // ── Marked content (skip) ───────────────────────────────────────
        case "BMC":
        case "BDC":
        case "EMC":
        case "MP":
        case "DP":
          break;
        // ── Compatibility (skip) ────────────────────────────────────────
        case "BX":
        case "EX":
          break;
        default:
          break;
      }
    }
    function emitPath(paintType) {
      if (currentPath.length === 0) return;
      const bounds = computePathBounds(currentPath);
      displayList.push({
        type: "path",
        segments: [...currentPath],
        strokeColor: paintType === "fill" ? null : [...gs.strokeColor],
        fillColor: paintType === "stroke" ? null : [...gs.fillColor],
        strokeAlpha: gs.strokeAlpha,
        fillAlpha: gs.fillAlpha,
        lineWidth: gs.lineWidth,
        paintType,
        blendMode: gs.blendMode,
        softMask: gs.softMask,
        clipPaths: [...gs.clipPaths],
        ...bounds
      });
      currentPath = [];
    }
    repairApostrophesAcrossRuns(rawTextRuns);
    mergeAdjacentTextRuns(displayList, rawTextRuns);
    return { displayList, textRuns: rawTextRuns, fonts };
  }
  function mergeAdjacentTextRuns(displayList, rawTextRuns) {
    let i = 0;
    while (i < displayList.length - 1) {
      const a = displayList[i];
      const b = displayList[i + 1];
      if (a.type !== "text" || b.type !== "text") {
        i++;
        continue;
      }
      const runA = a;
      const runB = b;
      if (runA.glyphs.length === 0 || runB.glyphs.length === 0) {
        i++;
        continue;
      }
      const baselineA = runA.glyphs[runA.glyphs.length - 1].tRm.f;
      const baselineB = runB.glyphs[0].tRm.f;
      if (Math.abs(baselineA - baselineB) > 0.5) {
        i++;
        continue;
      }
      const lastGlyphA = runA.glyphs[runA.glyphs.length - 1];
      const firstGlyphB = runB.glyphs[0];
      const fs = runA.fontSize || 12;
      const gapX = firstGlyphB.tRm.e - (lastGlyphA.tRm.e + lastGlyphA.width);
      if (gapX < -fs * 0.05 || gapX > fs * 0.3) {
        i++;
        continue;
      }
      if (runA.fontName !== runB.fontName) {
        i++;
        continue;
      }
      const fsB = runB.fontSize || 12;
      if (Math.abs(fs - fsB) / Math.max(fs, fsB) > 0.1) {
        i++;
        continue;
      }
      const mergedGlyphs = [...runA.glyphs, ...runB.glyphs];
      const mergedText = runA.text + runB.text;
      const minX = Math.min(runA.x, runB.x);
      const minY = Math.min(runA.y, runB.y);
      const maxX = Math.max(runA.x + runA.width, runB.x + runB.width);
      const maxY = Math.max(runA.y + runA.height, runB.y + runB.height);
      const sourceInstructionIndices = [
        ...runA.sourceInstructionIndices ?? [],
        ...runB.sourceInstructionIndices ?? []
      ];
      const merged = {
        ...runA,
        text: mergedText,
        glyphs: mergedGlyphs,
        sourceInstructionIndices: sourceInstructionIndices.length > 0 ? sourceInstructionIndices : void 0,
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
      displayList[i] = merged;
      displayList.splice(i + 1, 1);
      const idxA = rawTextRuns.indexOf(runA);
      const idxB = rawTextRuns.indexOf(runB);
      if (idxA >= 0) rawTextRuns[idxA] = merged;
      if (idxB >= 0) rawTextRuns.splice(idxB, 1);
    }
  }
  function isDegenerateClipPath(segments) {
    if (segments.length === 0) return true;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasPoints = false;
    for (const seg of segments) {
      for (let i = 0; i < seg.points.length; i += 2) {
        const x = seg.points[i];
        const y = seg.points[i + 1];
        if (!isFinite(x) || !isFinite(y)) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        hasPoints = true;
      }
    }
    if (!hasPoints) return true;
    const width = maxX - minX;
    const height = maxY - minY;
    if (width < 0.5 || height < 0.5) return true;
    return false;
  }
  function showTextString(strObj, gs, textMatrix, fonts, objects, page, sourceInstructionIndex) {
    const font = fonts.get(gs.textFont);
    let rawBytes;
    if (strObj instanceof PDFString) {
      rawBytes = strObj.toBytes();
    } else if (strObj instanceof PDFHexString) {
      rawBytes = strObj.toBytes();
    } else {
      return null;
    }
    if (rawBytes.length === 0) return null;
    const glyphs = [];
    let text = "";
    let totalWidth = 0;
    const fontSize = gs.textFontSize;
    const hScale = gs.horizontalScaling / 100;
    const isComposite = font?.isComposite ?? false;
    let idx = 0;
    while (idx < rawBytes.length) {
      let charCode;
      if (isComposite) {
        if (idx + 1 < rawBytes.length) {
          charCode = rawBytes[idx] << 8 | rawBytes[idx + 1];
          idx += 2;
        } else {
          charCode = rawBytes[idx];
          idx += 1;
        }
      } else {
        charCode = rawBytes[idx];
        idx += 1;
      }
      let unicode;
      const diffName = !isComposite ? font?.differences?.get(charCode) : void 0;
      const fromDiff = diffName ? glyphNameToUnicode(diffName) : "";
      const fromToUnicode = font?.toUnicode?.get(charCode);
      const dingbatMapped = font && isZapfDingbatsFont(font.baseFont) ? zapfDingbatsCharToUnicode(charCode, font.differences) : null;
      const symbolMapped = !dingbatMapped && font && isSymbolFont(font.baseFont) && !isComposite ? symbolCharToUnicode(charCode, font.differences) : null;
      const cidMapped = !dingbatMapped && !symbolMapped && font?.cidToUnicode?.has(charCode) ? font.cidToUnicode.get(charCode) : null;
      if (dingbatMapped) {
        if (fromToUnicode && !isSuspiciousDingbatToUnicode(fromToUnicode)) {
          unicode = fromToUnicode;
        } else {
          unicode = dingbatMapped;
        }
      } else if (symbolMapped) {
        if (fromToUnicode && !isSuspiciousDingbatToUnicode(fromToUnicode)) {
          unicode = fromToUnicode;
        } else {
          unicode = symbolMapped;
        }
      } else if (cidMapped && (!fromToUnicode || isSuspiciousDingbatToUnicode(fromToUnicode))) {
        unicode = cidMapped;
      } else if (fromDiff) {
        unicode = fromDiff;
        if (fromToUnicode && fromToUnicode !== fromDiff && isObscureSymbol(fromDiff) && !isObscureSymbol(fromToUnicode)) {
          unicode = fromToUnicode;
        }
      } else if (fromToUnicode) {
        unicode = fromToUnicode;
        if (isObscureSymbol(unicode) && !isComposite) {
          const fromEnc = encodingCharToUnicode(charCode, font?.encoding ?? "StandardEncoding");
          if (fromEnc && fromEnc !== unicode && !isObscureSymbol(fromEnc)) {
            unicode = fromEnc;
          } else if (charCode === 39 || charCode === 145 || charCode === 146) {
            unicode = charCode === 145 ? "\u2018" : charCode === 146 ? "\u2019" : "'";
          }
        }
      } else if (!isComposite) {
        unicode = encodingCharToUnicode(charCode, font?.encoding ?? "StandardEncoding");
        const cp = unicode.codePointAt(0) ?? 0;
        if (cp > 0 && cp < 32 && charCode >= 128) {
          const winAnsiMapped = WIN_ANSI_TO_UNICODE[charCode];
          if (winAnsiMapped) unicode = String.fromCodePoint(winAnsiMapped);
        }
      } else {
        unicode = String.fromCharCode(charCode);
      }
      const widthKey = isComposite ? font?.encoding !== "Identity-H" && font?.toCID?.has(charCode) ? font.toCID.get(charCode) : charCode : charCode;
      let glyphWidth1000 = font?.widths.get(widthKey);
      if (glyphWidth1000 === void 0 && isComposite) {
        glyphWidth1000 = font?.widths.get(charCode);
      }
      if (glyphWidth1000 === void 0 && unicode && font?.widths) {
        const unicodeCodePoint = unicode.charCodeAt(0);
        glyphWidth1000 = font.widths.get(unicodeCodePoint);
      }
      glyphWidth1000 = glyphWidth1000 ?? font?.defaultWidth ?? 500;
      const glyphWidth = glyphWidth1000 / 1e3 * fontSize * hScale;
      const tState = {
        a: fontSize * hScale,
        b: 0,
        c: 0,
        d: fontSize,
        e: 0,
        f: gs.textRise
      };
      const tRm = multiplyMatrices(multiplyMatrices(tState, textMatrix), gs.ctm);
      glyphs.push({
        charCode,
        unicode,
        x: tRm.e,
        y: tRm.f,
        width: glyphWidth1000 / 1e3 * Math.abs(tRm.a || tRm.d),
        fontSize: Math.abs(tRm.d || tRm.a),
        textSpaceWidth: glyphWidth1000 / 1e3,
        tRm
      });
      text += unicode;
      let advance = glyphWidth1000 / 1e3 * fontSize + gs.charSpacing;
      if (charCode === 32) advance += gs.wordSpacing;
      advance *= hScale;
      totalWidth += advance;
      textMatrix = {
        ...textMatrix,
        e: textMatrix.e + advance * textMatrix.a,
        f: textMatrix.f + advance * textMatrix.b
      };
    }
    if (glyphs.length === 0) return null;
    repairObscureApostropheGlyphs(glyphs);
    text = glyphs.map((g) => g.unicode).join("");
    const effectiveMatrix = multiplyMatrices(textMatrix, gs.ctm);
    const startX = glyphs[0].x;
    const startY = glyphs[0].y;
    const endGlyph = glyphs[glyphs.length - 1];
    const runWidth = endGlyph.x + endGlyph.width - startX;
    const runHeight = fontSize * Math.abs(effectiveMatrix.d || effectiveMatrix.a || 1);
    return {
      run: {
        type: "text",
        text,
        glyphs,
        sourceInstructionIndices: sourceInstructionIndex !== void 0 ? [sourceInstructionIndex] : void 0,
        x: startX,
        y: startY,
        width: Math.abs(runWidth) || totalWidth,
        height: runHeight,
        fontName: gs.textFont,
        fontSize,
        textMatrix: { ...effectiveMatrix },
        fillColor: [...gs.fillColor],
        fillAlpha: gs.fillAlpha,
        blendMode: gs.blendMode,
        softMask: gs.softMask,
        clipPaths: [...gs.clipPaths]
      },
      newTextMatrix: textMatrix
    };
  }
  function repairObscureApostropheGlyphs(glyphs) {
    if (glyphs.length === 0) return;
    const onlyObscure = glyphs.every(
      (g) => !g.unicode || g.unicode === " " || g.unicode === "\xA0" || isObscureSymbol(g.unicode)
    );
    if (onlyObscure) {
      for (let gi = 0; gi < glyphs.length; gi++) {
        if (isObscureSymbol(glyphs[gi].unicode)) {
          glyphs[gi] = { ...glyphs[gi], unicode: "'" };
        }
      }
      return;
    }
    for (let gi = 0; gi < glyphs.length; gi++) {
      if (!isObscureSymbol(glyphs[gi].unicode)) continue;
      const prev = gi > 0 ? glyphs[gi - 1].unicode : "";
      const next = gi + 1 < glyphs.length ? glyphs[gi + 1].unicode : "";
      const prevLetter = /[A-Za-z]/.test(prev.slice(-1));
      const nextLetter = /[A-Za-z]/.test(next.charAt(0));
      if (prevLetter && nextLetter) {
        glyphs[gi] = { ...glyphs[gi], unicode: "'" };
      }
    }
  }
  function repairApostrophesAcrossRuns(runs) {
    for (let i = 0; i < runs.length; i++) {
      repairObscureApostropheGlyphs(runs[i].glyphs);
      runs[i].text = runs[i].glyphs.map((g) => g.unicode).join("");
    }
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      if (run.glyphs.length === 0) continue;
      const onlyObscure = run.glyphs.every((g) => isObscureSymbol(g.unicode));
      if (!onlyObscure && !run.glyphs.some((g) => isObscureSymbol(g.unicode))) continue;
      const baseline = run.glyphs[0].tRm.f;
      const fs = run.fontSize || 12;
      let leftLetter = false;
      let rightLetter = false;
      for (let j = i - 1; j >= 0; j--) {
        const other = runs[j];
        if (other.glyphs.length === 0) continue;
        if (Math.abs(other.glyphs[other.glyphs.length - 1].tRm.f - baseline) > fs * 0.35) continue;
        const gap = run.glyphs[0].tRm.e - (other.glyphs[other.glyphs.length - 1].tRm.e + other.glyphs[other.glyphs.length - 1].width);
        if (gap > fs * 2) break;
        const ch = other.glyphs[other.glyphs.length - 1].unicode.slice(-1);
        if (/[A-Za-z]/.test(ch)) {
          leftLetter = true;
          break;
        }
        if (ch.trim()) break;
      }
      for (let j = i + 1; j < runs.length; j++) {
        const other = runs[j];
        if (other.glyphs.length === 0) continue;
        if (Math.abs(other.glyphs[0].tRm.f - baseline) > fs * 0.35) continue;
        const gap = other.glyphs[0].tRm.e - (run.glyphs[run.glyphs.length - 1].tRm.e + run.glyphs[run.glyphs.length - 1].width);
        if (gap > fs * 2) break;
        const ch = other.glyphs[0].unicode.charAt(0);
        if (/[A-Za-z]/.test(ch)) {
          rightLetter = true;
          break;
        }
        if (ch.trim()) break;
      }
      if (leftLetter && rightLetter) {
        for (let gi = 0; gi < run.glyphs.length; gi++) {
          if (isObscureSymbol(run.glyphs[gi].unicode)) {
            run.glyphs[gi] = { ...run.glyphs[gi], unicode: "'" };
          }
        }
        run.text = run.glyphs.map((g) => g.unicode).join("");
      }
    }
  }
  function loadFonts(resources, objects, fonts) {
    const fontDict = resources.get("Font");
    if (!fontDict) return;
    const resolved = resolveRef(fontDict, objects);
    if (!(resolved instanceof PDFDict)) return;
    const entries = Array.from(resolved.entries());
    for (let i = 0; i < entries.length; i++) {
      const [name, ref] = entries[i];
      const fontObj = resolveRef(ref, objects);
      if (!(fontObj instanceof PDFDict)) continue;
      const info = parseFontDict(name, fontObj, objects);
      fonts.set(name, info);
    }
  }
  function parseFontDict(name, dict, objects) {
    const subtype = dict.getName("Subtype") ?? "Type1";
    const baseFont = dict.getName("BaseFont") ?? "";
    const isComposite = subtype === "Type0";
    const widths = /* @__PURE__ */ new Map();
    let defaultWidth = 1e3;
    let firstChar = 0;
    let lastChar = 255;
    if (isComposite) {
      const descFonts = dict.getArray("DescendantFonts");
      if (descFonts && descFonts.length > 0) {
        const cidFontRef = descFonts.get(0);
        const cidFont = resolveRef(cidFontRef, objects);
        if (cidFont instanceof PDFDict) {
          defaultWidth = cidFont.getNumber("DW") ?? 1e3;
          const wArray = cidFont.get("W");
          const resolvedW = wArray ? resolveRef(wArray, objects) : void 0;
          if (resolvedW instanceof PDFArray) {
            parseCIDWidths(resolvedW, widths);
          }
        }
      }
    } else {
      firstChar = dict.getNumber("FirstChar") ?? 0;
      lastChar = dict.getNumber("LastChar") ?? 255;
      const widthsArray = dict.get("Widths");
      const resolvedWidths = widthsArray ? resolveRef(widthsArray, objects) : void 0;
      if (resolvedWidths instanceof PDFArray) {
        const nums = resolvedWidths.asNumbers();
        for (let i = 0; i < nums.length; i++) {
          if (!isNaN(nums[i])) {
            widths.set(firstChar + i, nums[i]);
          }
        }
      }
      const fdRef = dict.get("FontDescriptor");
      if (fdRef) {
        const fd = resolveRef(fdRef, objects);
        if (fd instanceof PDFDict) {
          const missing = fd.getNumber("MissingWidth");
          if (missing != null) defaultWidth = missing;
        }
      }
      if (widths.size === 0) {
        const stdMetrics = getStandardFont(baseFont);
        if (stdMetrics) {
          for (let i = 0; i < 256; i++) {
            widths.set(i, stdMetrics.widths[i]);
          }
          defaultWidth = stdMetrics.defaultWidth;
        } else if (defaultWidth === 1e3) {
          defaultWidth = 600;
        }
      } else if (defaultWidth === 1e3) {
        defaultWidth = 600;
      }
    }
    let toUnicode = null;
    const toUnicodeRef = dict.get("ToUnicode");
    if (toUnicodeRef) {
      const toUnicodeObj = resolveRef(toUnicodeRef, objects);
      if (toUnicodeObj instanceof PDFStream) {
        toUnicode = parseToUnicodeCMap(toUnicodeObj.getBytes());
      }
    }
    let toCID = null;
    let encoding = "StandardEncoding";
    const differences = /* @__PURE__ */ new Map();
    const encodingObj = dict.get("Encoding");
    if (encodingObj) {
      const resolved = resolveRef(encodingObj, objects);
      if (resolved instanceof PDFName) {
        encoding = resolved.name;
      } else if (resolved instanceof PDFStream) {
        const cmap = parseCMap(resolved.getBytes());
        toCID = cmap.toCID;
        if (!toUnicode && cmap.toUnicode.size > 0) {
          toUnicode = cmap.toUnicode;
        }
      } else if (resolved instanceof PDFDict) {
        encoding = resolved.getName("BaseEncoding") ?? "WinAnsiEncoding";
        const diffsArr = resolved.get("Differences");
        const resolvedDiffs = diffsArr ? resolveRef(diffsArr, objects) : void 0;
        if (resolvedDiffs instanceof PDFArray) {
          let currentCode = 0;
          for (let di = 0; di < resolvedDiffs.length; di++) {
            const item = resolvedDiffs.get(di);
            if (item instanceof PDFNumber) {
              currentCode = item.value;
            } else if (item instanceof PDFName) {
              differences.set(currentCode, item.name);
              currentCode++;
            }
          }
        }
      }
    }
    let cidToUnicode = null;
    if (isComposite && (!toUnicode || toUnicode.size === 0)) {
      cidToUnicode = buildCidToUnicodeFromEmbeddedFont(dict, objects, baseFont);
    }
    return {
      name,
      baseFont,
      subtype,
      encoding,
      isComposite,
      toUnicode,
      toCID,
      widths,
      defaultWidth,
      firstChar,
      lastChar,
      differences,
      cidToUnicode
    };
  }
  function buildCidToUnicodeFromEmbeddedFont(dict, objects, baseFont) {
    const descFonts = dict.getArray("DescendantFonts");
    if (!descFonts || descFonts.length === 0) return null;
    const cidFont = resolveRef(descFonts.get(0), objects);
    if (!(cidFont instanceof PDFDict)) return null;
    const fdRef = cidFont.get("FontDescriptor") ?? dict.get("FontDescriptor");
    if (!fdRef) return null;
    const fd = resolveRef(fdRef, objects);
    if (!(fd instanceof PDFDict)) return null;
    const fontFile = fd.get("FontFile2") ?? fd.get("FontFile3") ?? fd.get("FontFile");
    if (!fontFile) return null;
    const fontStream = resolveRef(fontFile, objects);
    if (!(fontStream instanceof PDFStream)) return null;
    let fontBytes = fontStream.getBytes();
    if (!isTrueTypeFontData(fontBytes) && isCFFData(fontBytes)) {
      try {
        const wrapped = wrapCFFInOTF(fontBytes, { familyName: baseFont });
        if (wrapped && isTrueTypeFontData(wrapped)) fontBytes = wrapped;
      } catch {
      }
    }
    if (!isTrueTypeFontData(fontBytes)) return null;
    let ttf;
    try {
      ttf = parseTTF(fontBytes);
    } catch {
      return null;
    }
    const cidToGid = /* @__PURE__ */ new Map();
    const cidToGidRef = cidFont.get("CIDToGIDMap");
    if (cidToGidRef) {
      const resolved = resolveRef(cidToGidRef, objects);
      if (resolved instanceof PDFStream) {
        const mapData = resolved.getBytes();
        for (let cid = 0; cid * 2 + 1 < mapData.length; cid++) {
          const gid = mapData[cid * 2] << 8 | mapData[cid * 2 + 1];
          if (gid !== 0) cidToGid.set(cid, gid);
        }
      }
    }
    const out = /* @__PURE__ */ new Map();
    if (cidToGid.size > 0) {
      for (const [cid, gid] of cidToGid) {
        const uni = unicodeFromGlyphId(gid, ttf.cmapEntries, baseFont);
        if (uni) out.set(cid, uni);
      }
    } else {
      const gids = new Set(ttf.cmapEntries.values());
      for (const gid of gids) {
        const uni = unicodeFromGlyphId(gid, ttf.cmapEntries, baseFont);
        if (uni) out.set(gid, uni);
      }
    }
    return out.size > 0 ? out : null;
  }
  function parseCIDWidths(wArray, widths) {
    let i = 0;
    while (i < wArray.length) {
      const first = wArray.get(i);
      if (!(first instanceof PDFNumber)) {
        i++;
        continue;
      }
      const second = wArray.get(i + 1);
      if (second instanceof PDFArray) {
        const cid = first.value;
        const ws = second.asNumbers();
        for (let j = 0; j < ws.length; j++) {
          if (!isNaN(ws[j])) widths.set(cid + j, ws[j]);
        }
        i += 2;
      } else if (second instanceof PDFNumber) {
        const cidFirst = first.value;
        const cidLast = second.value;
        const w = wArray.get(i + 2);
        const width = w instanceof PDFNumber ? w.value : 1e3;
        for (let cid = cidFirst; cid <= cidLast; cid++) {
          widths.set(cid, width);
        }
        i += 3;
      } else {
        i++;
      }
    }
  }
  function parseToUnicodeCMap(data) {
    const map = /* @__PURE__ */ new Map();
    const text = new TextDecoder("latin1").decode(data);
    const bfcharRegex = /beginbfchar\s*([\s\S]*?)endbfchar/g;
    let match;
    while ((match = bfcharRegex.exec(text)) !== null) {
      const block = match[1];
      const lineRegex = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
      let lineMatch;
      while ((lineMatch = lineRegex.exec(block)) !== null) {
        const charCode = parseInt(lineMatch[1], 16);
        const unicode = hexToUnicodeString(lineMatch[2]);
        map.set(charCode, unicode);
      }
    }
    const bfrangeRegex = /beginbfrange\s*([\s\S]*?)endbfrange/g;
    while ((match = bfrangeRegex.exec(text)) !== null) {
      const block = match[1];
      const rangeRegex = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([\s\S]*?)\])/g;
      let rangeMatch;
      while ((rangeMatch = rangeRegex.exec(block)) !== null) {
        const startCode = parseInt(rangeMatch[1], 16);
        const endCode = parseInt(rangeMatch[2], 16);
        if (rangeMatch[3]) {
          let unicodeStart = parseInt(rangeMatch[3], 16);
          for (let code = startCode; code <= endCode; code++) {
            map.set(code, String.fromCodePoint(unicodeStart++));
          }
        } else if (rangeMatch[4]) {
          const arrayContent = rangeMatch[4];
          const hexValues = arrayContent.match(/<([0-9a-fA-F]+)>/g) ?? [];
          for (let j = 0; j < hexValues.length && startCode + j <= endCode; j++) {
            const hex = hexValues[j].replace(/[<>]/g, "");
            map.set(startCode + j, hexToUnicodeString(hex));
          }
        }
      }
    }
    return map;
  }
  function hexToUnicodeString(hex) {
    let result = "";
    for (let i = 0; i < hex.length; i += 4) {
      if (i + 4 <= hex.length) {
        result += String.fromCodePoint(parseInt(hex.substring(i, i + 4), 16));
      } else {
        result += String.fromCodePoint(parseInt(hex.substring(i), 16));
      }
    }
    return result;
  }
  function applyExtGState(dict, gs, objects) {
    const ca = dict.getNumber("ca");
    if (ca !== void 0) gs.fillAlpha = ca;
    const CA = dict.getNumber("CA");
    if (CA !== void 0) gs.strokeAlpha = CA;
    const LW = dict.getNumber("LW");
    if (LW !== void 0) gs.lineWidth = LW;
    const LC = dict.getNumber("LC");
    if (LC !== void 0) gs.lineCap = LC;
    const LJ = dict.getNumber("LJ");
    if (LJ !== void 0) gs.lineJoin = LJ;
    const ML = dict.getNumber("ML");
    if (ML !== void 0) gs.miterLimit = ML;
    const fontArr = dict.getArray("Font");
    if (fontArr && fontArr.length >= 2) {
      const fontName = fontArr.get(0);
      const fontSize = fontArr.get(1);
      if (fontName instanceof PDFName) gs.textFont = fontName.name;
      if (fontSize instanceof PDFNumber) gs.textFontSize = fontSize.value;
    }
    const bmObj = dict.get("BM");
    if (bmObj instanceof PDFName) {
      gs.blendMode = bmObj.name;
    } else if (bmObj instanceof PDFArray && bmObj.length > 0) {
      const first = bmObj.get(0);
      if (first instanceof PDFName) gs.blendMode = first.name;
    }
    const smaskObj = dict.get("SMask");
    if (smaskObj instanceof PDFName && smaskObj.name === "None") {
      gs.softMask = null;
    } else if (smaskObj) {
      const resolvedSMask = resolveRef(smaskObj, objects);
      if (resolvedSMask instanceof PDFDict) {
        gs.softMask = resolvedSMask;
      }
    }
  }
  function computePathBounds(segments) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const seg of segments) {
      for (let i = 0; i < seg.points.length; i += 2) {
        const x = seg.points[i];
        const y = seg.points[i + 1];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
  function cmykToRgb(c, m, y, k) {
    return [
      (1 - c) * (1 - k),
      (1 - m) * (1 - k),
      (1 - y) * (1 - k)
    ];
  }

  // src/engine/fonts/font-parser.ts
  function loadFont(name, dict, objects) {
    const subtype = dict.getName("Subtype") ?? "Type1";
    const baseFont = dict.getName("BaseFont") ?? "";
    const isComposite = subtype === "Type0";
    const fontData = {
      name,
      baseFont,
      subtype,
      isComposite,
      encoding: "StandardEncoding",
      differences: /* @__PURE__ */ new Map(),
      toUnicode: /* @__PURE__ */ new Map(),
      widths: /* @__PURE__ */ new Map(),
      defaultWidth: 1e3,
      firstChar: 0,
      lastChar: 255,
      standardMetrics: null,
      ttfFont: null,
      fontBytes: null,
      ascent: 800,
      descent: -200,
      italicAngle: 0,
      flags: 0,
      fontWeight: null,
      cssFontString: "12px sans-serif",
      fontMatrix: null,
      charProcs: null
    };
    fontData.standardMetrics = getStandardFont(baseFont);
    if (fontData.standardMetrics) {
      for (let i = 0; i < 256; i++) {
        fontData.widths.set(i, fontData.standardMetrics.widths[i]);
      }
      fontData.defaultWidth = fontData.standardMetrics.defaultWidth;
      fontData.ascent = fontData.standardMetrics.ascent;
      fontData.descent = fontData.standardMetrics.descent;
    }
    loadEncoding(dict, objects, fontData);
    loadToUnicode(dict, objects, fontData);
    if (isComposite) {
      loadCompositeWidths(dict, objects, fontData);
    } else {
      loadSimpleWidths(dict, objects, fontData);
      const fdEarly = dict.get("FontDescriptor");
      if (fdEarly) {
        const fd = resolveRef(fdEarly, objects);
        if (fd instanceof PDFDict) {
          const missing = fd.getNumber("MissingWidth");
          if (missing != null) fontData.defaultWidth = missing;
        }
      }
    }
    loadFontDescriptor(dict, objects, fontData);
    if (isComposite) {
      loadDescendantFont(dict, objects, fontData);
    }
    if (subtype === "Type3") {
      const matrixArr = dict.getArray("FontMatrix");
      if (matrixArr) {
        fontData.fontMatrix = matrixArr.asNumbers();
      }
      const charProcsDictRef = dict.get("CharProcs");
      const charProcsDict = charProcsDictRef ? resolveRef(charProcsDictRef, objects) : void 0;
      if (charProcsDict instanceof PDFDict) {
        fontData.charProcs = /* @__PURE__ */ new Map();
        const entries = Array.from(charProcsDict.entries());
        for (const [charName, streamRef] of entries) {
          const stream = resolveRef(streamRef, objects);
          if (stream instanceof PDFStream) {
            fontData.charProcs.set(charName, stream);
          }
        }
      }
    }
    fontData.cssFontString = buildCSSFont(fontData);
    if (fontData.widths.size === 0) {
      console.warn(`[Font Parser] WARNING: Font ${name} (${baseFont}) has no widths! Standard: ${!!fontData.standardMetrics}, isComposite: ${isComposite}`);
    }
    return fontData;
  }
  function loadEncoding(dict, objects, fontData) {
    const encodingObj = dict.get("Encoding");
    if (!encodingObj) return;
    const resolved = resolveRef(encodingObj, objects);
    if (resolved instanceof PDFName) {
      fontData.encoding = resolved.name;
      return;
    }
    if (resolved instanceof PDFDict) {
      const baseName = resolved.getName("BaseEncoding");
      if (baseName) fontData.encoding = baseName;
      const diffsArr = resolved.get("Differences");
      const resolvedDiffs = diffsArr ? resolveRef(diffsArr, objects) : void 0;
      if (resolvedDiffs instanceof PDFArray) {
        let currentCode = 0;
        for (let i = 0; i < resolvedDiffs.length; i++) {
          const item = resolvedDiffs.get(i);
          if (item instanceof PDFNumber) {
            currentCode = item.value;
          } else if (item instanceof PDFName) {
            fontData.differences.set(currentCode, item.name);
            currentCode++;
          }
        }
      }
    }
  }
  function loadToUnicode(dict, objects, fontData) {
    const toUnicodeRef = dict.get("ToUnicode");
    if (!toUnicodeRef) return;
    const toUnicodeObj = resolveRef(toUnicodeRef, objects);
    if (!(toUnicodeObj instanceof PDFStream)) return;
    const cmapData = parseCMap(toUnicodeObj.getBytes());
    fontData.toUnicode = cmapData.toUnicode;
  }
  function resolveNumber(dict, key, objects) {
    const ref = dict.get(key);
    if (!ref) return void 0;
    const obj = resolveRef(ref, objects);
    return obj instanceof PDFNumber ? obj.value : void 0;
  }
  function loadSimpleWidths(dict, objects, fontData) {
    fontData.firstChar = resolveNumber(dict, "FirstChar", objects) ?? 0;
    fontData.lastChar = resolveNumber(dict, "LastChar", objects) ?? 255;
    const widthsRef = dict.get("Widths");
    if (!widthsRef) return;
    const widthsArr = resolveRef(widthsRef, objects);
    if (!(widthsArr instanceof PDFArray)) return;
    const nums = [];
    for (let i = 0; i < widthsArr.length; i++) {
      const raw = widthsArr.get(i);
      const obj = raw ? resolveRef(raw, objects) : void 0;
      if (obj instanceof PDFNumber) {
        nums.push(obj.value);
      } else {
        nums.push(NaN);
      }
    }
    for (let i = 0; i < nums.length; i++) {
      if (!isNaN(nums[i])) {
        fontData.widths.set(fontData.firstChar + i, nums[i]);
      }
    }
  }
  function loadCompositeWidths(dict, objects, fontData) {
    const descFontsRef = dict.get("DescendantFonts");
    if (!descFontsRef) return;
    const descFonts = resolveRef(descFontsRef, objects);
    if (!(descFonts instanceof PDFArray) || descFonts.length === 0) return;
    const cidFontRef = descFonts.get(0);
    const cidFont = resolveRef(cidFontRef, objects);
    if (!(cidFont instanceof PDFDict)) return;
    fontData.defaultWidth = resolveNumber(cidFont, "DW", objects) ?? 1e3;
    const wRef = cidFont.get("W");
    if (!wRef) return;
    const wArr = resolveRef(wRef, objects);
    if (!(wArr instanceof PDFArray)) return;
    let i = 0;
    while (i < wArr.length) {
      const firstRaw = wArr.get(i);
      const first = firstRaw ? resolveRef(firstRaw, objects) : void 0;
      if (!(first instanceof PDFNumber)) {
        i++;
        continue;
      }
      const secondRaw = wArr.get(i + 1);
      const second = secondRaw ? resolveRef(secondRaw, objects) : void 0;
      if (second instanceof PDFArray) {
        const cid = first.value;
        for (let j = 0; j < second.length; j++) {
          const wRaw = second.get(j);
          const w = wRaw ? resolveRef(wRaw, objects) : void 0;
          if (w instanceof PDFNumber) {
            fontData.widths.set(cid + j, w.value);
          }
        }
        i += 2;
      } else if (second instanceof PDFNumber) {
        const cidFirst = first.value;
        const cidLast = second.value;
        const wObjRaw = wArr.get(i + 2);
        const wObj = wObjRaw ? resolveRef(wObjRaw, objects) : void 0;
        const width = wObj instanceof PDFNumber ? wObj.value : fontData.defaultWidth;
        for (let cid = cidFirst; cid <= cidLast; cid++) {
          fontData.widths.set(cid, width);
        }
        i += 3;
      } else {
        i++;
      }
    }
  }
  function loadFontDescriptor(dict, objects, fontData) {
    const fdRef = dict.get("FontDescriptor");
    if (!fdRef) return;
    const fd = resolveRef(fdRef, objects);
    if (!(fd instanceof PDFDict)) return;
    fontData.ascent = fd.getNumber("Ascent") ?? fontData.ascent;
    fontData.descent = fd.getNumber("Descent") ?? fontData.descent;
    fontData.italicAngle = fd.getNumber("ItalicAngle") ?? 0;
    fontData.flags = fd.getNumber("Flags") ?? 0;
    const weight = fd.getNumber("FontWeight");
    if (weight != null) fontData.fontWeight = weight;
    const fontFile = fd.get("FontFile") ?? fd.get("FontFile2") ?? fd.get("FontFile3");
    if (fontFile) {
      const fontStream = resolveRef(fontFile, objects);
      if (fontStream instanceof PDFStream) {
        let fontBytes = fontStream.getBytes();
        if (!isTrueTypeFontData(fontBytes) && isCFFData(fontBytes)) {
          try {
            const wrapped = wrapCFFInOTF(fontBytes, {
              familyName: fontData.baseFont,
              ascent: fontData.ascent,
              descent: fontData.descent,
              weight: fontData.fontWeight,
              italicAngle: fontData.italicAngle,
              widths: fontData.widths
            });
            if (wrapped && isTrueTypeFontData(wrapped)) {
              fontBytes = wrapped;
            }
          } catch (e) {
            console.warn(`[Font Parser] Failed to wrap CFF font for ${fontData.baseFont}:`, e);
          }
        }
        if (isTrueTypeFontData(fontBytes)) {
          fontData.fontBytes = fontBytes;
          try {
            fontData.ttfFont = parseTTF(fontBytes);
            if (fontData.widths.size === 0 && fontData.ttfFont) {
              populateWidthsFromTTF(fontData);
            }
          } catch (e) {
            console.warn(`[Font Parser] Failed to parse embedded font for ${fontData.baseFont}:`, e);
          }
        } else {
          fontData.fontBytes = null;
        }
      }
    }
  }
  function loadDescendantFont(dict, objects, fontData) {
    const descFontsRef = dict.get("DescendantFonts");
    if (!descFontsRef) return;
    const descFonts = resolveRef(descFontsRef, objects);
    if (!(descFonts instanceof PDFArray) || descFonts.length === 0) return;
    const cidFontRef = descFonts.get(0);
    const cidFont = resolveRef(cidFontRef, objects);
    if (!(cidFont instanceof PDFDict)) return;
    const cidSubtype = cidFont.getName("Subtype");
    if (cidSubtype) fontData.subtype = cidSubtype;
    if (!fontData.ttfFont) {
      loadFontDescriptor(cidFont, objects, fontData);
    }
    const cidToGidRef = cidFont.get("CIDToGIDMap");
    if (cidToGidRef) {
      const resolved = resolveRef(cidToGidRef, objects);
      if (resolved instanceof PDFStream) {
        const mapData = resolved.getBytes();
        if (fontData.ttfFont && mapData.length >= 2) {
          for (let cid = 0; cid < mapData.length / 2; cid++) {
            const gid = mapData[cid * 2] << 8 | mapData[cid * 2 + 1];
            if (gid !== 0 && fontData.ttfFont) {
              const widthFU = getGlyphWidth(fontData.ttfFont, gid);
              const width1000 = fontUnitsToTextSpace(widthFU, fontData.ttfFont.unitsPerEm);
              fontData.widths.set(cid, width1000);
            }
          }
        }
      }
    } else if (!cidToGidRef || cidToGidRef instanceof PDFName && cidToGidRef.name === "Identity") {
      if (fontData.ttfFont && fontData.widths.size === 0) {
        const numGlyphs = fontData.ttfFont.numGlyphs;
        for (let cid = 0; cid < numGlyphs; cid++) {
          const widthFU = getGlyphWidth(fontData.ttfFont, cid);
          const width1000 = fontUnitsToTextSpace(widthFU, fontData.ttfFont.unitsPerEm);
          fontData.widths.set(cid, width1000);
        }
      }
    }
  }
  function populateWidthsFromTTF(fontData) {
    if (!fontData.ttfFont) return;
    const ttf = fontData.ttfFont;
    const entries = Array.from(ttf.cmapEntries.entries());
    for (let i = 0; i < entries.length; i++) {
      const [charCode, glyphId] = entries[i];
      const widthFU = getGlyphWidth(ttf, glyphId);
      fontData.widths.set(charCode, fontUnitsToTextSpace(widthFU, ttf.unitsPerEm));
    }
  }
  function buildCSSFont(fontData) {
    const std = fontData.standardMetrics;
    if (std) {
      const weight2 = std.isBold ? "bold" : "normal";
      const style2 = std.isItalic ? "italic" : "normal";
      return `${style2} ${weight2} 10px ${std.cssFamily}`;
    }
    const lower = fontData.baseFont.toLowerCase();
    const weight = lower.includes("bold") ? "bold" : "normal";
    const style = lower.includes("italic") || lower.includes("oblique") ? "italic" : "normal";
    let family = "sans-serif";
    if (lower.includes("courier") || lower.includes("mono")) {
      family = '"Courier New", Courier, monospace';
    } else if (lower.includes("times") || lower.includes("roman") || lower.includes("serif")) {
      family = '"Times New Roman", Times, serif';
    } else if (lower.includes("helv") || lower.includes("arial")) {
      family = "Helvetica, Arial, sans-serif";
    }
    return `${style} ${weight} 10px ${family}`;
  }
  function charCodeToUnicode(charCode, fontData) {
    if (isZapfDingbatsFont(fontData.baseFont)) {
      const dingbat = zapfDingbatsCharToUnicode(charCode, fontData.differences);
      if (dingbat) {
        const fromCMap2 = fontData.toUnicode.get(charCode);
        if (fromCMap2 && !isSuspiciousDingbatToUnicode(fromCMap2)) return fromCMap2;
        return dingbat;
      }
    }
    if (isSymbolFont(fontData.baseFont) && !fontData.isComposite) {
      const sym = symbolCharToUnicode(charCode, fontData.differences);
      if (sym) {
        const fromCMap2 = fontData.toUnicode.get(charCode);
        if (fromCMap2 && !isSuspiciousDingbatToUnicode(fromCMap2)) return fromCMap2;
        return sym;
      }
    }
    const glyphName = fontData.differences.get(charCode);
    if (glyphName) {
      const fromDiff = glyphNameToUnicode2(glyphName);
      if (fromDiff) {
        const fromCMap2 = fontData.toUnicode.get(charCode);
        if (fromCMap2 && fromCMap2 !== fromDiff && isObscureSymbolChar(fromDiff) && !isObscureSymbolChar(fromCMap2)) {
          return fromCMap2;
        }
        return fromDiff;
      }
    }
    const fromCMap = fontData.toUnicode.get(charCode);
    if (fromCMap) {
      if (isObscureSymbolChar(fromCMap)) {
        if (charCode === 39) return "'";
        if (charCode === 145) return "\u2018";
        if (charCode === 146) return "\u2019";
      }
      return fromCMap;
    }
    if (fontData.isComposite && fontData.ttfFont) {
      const fromGlyph = unicodeFromGlyphId(
        charCode,
        fontData.ttfFont.cmapEntries,
        fontData.baseFont
      );
      if (fromGlyph) return fromGlyph;
    }
    if (charCode >= 128 && charCode <= 159) {
      const winAnsiMap = {
        128: 8364,
        130: 8218,
        131: 402,
        132: 8222,
        133: 8230,
        134: 8224,
        135: 8225,
        136: 710,
        137: 8240,
        138: 352,
        139: 8249,
        140: 338,
        142: 381,
        145: 8216,
        146: 8217,
        147: 8220,
        148: 8221,
        149: 8226,
        150: 8211,
        151: 8212,
        152: 732,
        153: 8482,
        154: 353,
        155: 8250,
        156: 339,
        158: 382,
        159: 376
      };
      const mapped = winAnsiMap[charCode];
      if (mapped) return String.fromCodePoint(mapped);
    }
    if (!fontData.isComposite && charCode >= 32 && charCode <= 126) {
      return String.fromCharCode(charCode);
    }
    return String.fromCharCode(charCode);
  }
  function isObscureSymbolChar(ch) {
    if (!ch || ch.length === 0) return true;
    const cp = ch.codePointAt(0) ?? 0;
    return cp === 167 || cp === 182 || cp === 164 || cp === 8224 || cp === 8225 || cp === 8226 || cp === 8251 || cp === 166 || cp === 172;
  }
  function glyphNameToUnicode2(name) {
    const map = {
      "space": " ",
      "exclam": "!",
      "quotedbl": '"',
      "numbersign": "#",
      "dollar": "$",
      "percent": "%",
      "ampersand": "&",
      "quotesingle": "'",
      "parenleft": "(",
      "parenright": ")",
      "asterisk": "*",
      "plus": "+",
      "comma": ",",
      "hyphen": "-",
      "period": ".",
      "slash": "/",
      "zero": "0",
      "one": "1",
      "two": "2",
      "three": "3",
      "four": "4",
      "five": "5",
      "six": "6",
      "seven": "7",
      "eight": "8",
      "nine": "9",
      "colon": ":",
      "semicolon": ";",
      "less": "<",
      "equal": "=",
      "greater": ">",
      "question": "?",
      "at": "@",
      "A": "A",
      "B": "B",
      "C": "C",
      "D": "D",
      "E": "E",
      "F": "F",
      "G": "G",
      "H": "H",
      "I": "I",
      "J": "J",
      "K": "K",
      "L": "L",
      "M": "M",
      "N": "N",
      "O": "O",
      "P": "P",
      "Q": "Q",
      "R": "R",
      "S": "S",
      "T": "T",
      "U": "U",
      "V": "V",
      "W": "W",
      "X": "X",
      "Y": "Y",
      "Z": "Z",
      "bracketleft": "[",
      "backslash": "\\",
      "bracketright": "]",
      "asciicircum": "^",
      "underscore": "_",
      "grave": "`",
      "a": "a",
      "b": "b",
      "c": "c",
      "d": "d",
      "e": "e",
      "f": "f",
      "g": "g",
      "h": "h",
      "i": "i",
      "j": "j",
      "k": "k",
      "l": "l",
      "m": "m",
      "n": "n",
      "o": "o",
      "p": "p",
      "q": "q",
      "r": "r",
      "s": "s",
      "t": "t",
      "u": "u",
      "v": "v",
      "w": "w",
      "x": "x",
      "y": "y",
      "z": "z",
      "braceleft": "{",
      "bar": "|",
      "braceright": "}",
      "asciitilde": "~",
      // Extended Latin
      "bullet": "\u2022",
      "endash": "\u2013",
      "emdash": "\u2014",
      "quotedblleft": "\u201C",
      "quotedblright": "\u201D",
      "quoteleft": "\u2018",
      "quoteright": "\u2019",
      "fi": "\uFB01",
      "fl": "\uFB02",
      "ellipsis": "\u2026",
      "trademark": "\u2122",
      "copyright": "\xA9",
      "registered": "\xAE",
      "degree": "\xB0",
      "plusminus": "\xB1",
      "mu": "\xB5",
      "paragraph": "\xB6",
      "section": "\xA7",
      // Accented characters
      "Agrave": "\xC0",
      "Aacute": "\xC1",
      "Acircumflex": "\xC2",
      "Atilde": "\xC3",
      "Adieresis": "\xC4",
      "Aring": "\xC5",
      "AE": "\xC6",
      "Ccedilla": "\xC7",
      "Egrave": "\xC8",
      "Eacute": "\xC9",
      "Ecircumflex": "\xCA",
      "Edieresis": "\xCB",
      "Igrave": "\xCC",
      "Iacute": "\xCD",
      "Icircumflex": "\xCE",
      "Idieresis": "\xCF",
      "Ntilde": "\xD1",
      "Ograve": "\xD2",
      "Oacute": "\xD3",
      "Ocircumflex": "\xD4",
      "Otilde": "\xD5",
      "Odieresis": "\xD6",
      "Ugrave": "\xD9",
      "Uacute": "\xDA",
      "Ucircumflex": "\xDB",
      "Udieresis": "\xDC",
      "agrave": "\xE0",
      "aacute": "\xE1",
      "acircumflex": "\xE2",
      "atilde": "\xE3",
      "adieresis": "\xE4",
      "aring": "\xE5",
      "ae": "\xE6",
      "ccedilla": "\xE7",
      "egrave": "\xE8",
      "eacute": "\xE9",
      "ecircumflex": "\xEA",
      "edieresis": "\xEB",
      "igrave": "\xEC",
      "iacute": "\xED",
      "icircumflex": "\xEE",
      "idieresis": "\xEF",
      "ntilde": "\xF1",
      "ograve": "\xF2",
      "oacute": "\xF3",
      "ocircumflex": "\xF4",
      "otilde": "\xF5",
      "odieresis": "\xF6",
      "ugrave": "\xF9",
      "uacute": "\xFA",
      "ucircumflex": "\xFB",
      "udieresis": "\xFC"
    };
    return map[name] ?? ZAPF_DINGBATS_GLYPH_TO_UNICODE[name] ?? null;
  }

  // src/engine/editor/stream-compiler.ts
  function serializeToString(obj) {
    if (obj instanceof PDFBoolean) return obj.value ? "true" : "false";
    if (obj instanceof PDFNumber) return formatNumber(obj.value);
    if (obj instanceof PDFString) return serializeLiteralString(obj.value);
    if (obj instanceof PDFHexString) return `<${obj.hex}>`;
    if (obj instanceof PDFName) return serializeName(obj.name);
    if (obj instanceof PDFNull) return "null";
    if (obj instanceof PDFRef) return `${obj.objNum} ${obj.genNum} R`;
    if (obj instanceof PDFArray) {
      const items = [];
      for (let i = 0; i < obj.length; i++) {
        items.push(serializeToString(obj.get(i)));
      }
      return `[${items.join(" ")}]`;
    }
    if (obj instanceof PDFDict) {
      const entries = [];
      const dictEntries = Array.from(obj.entries());
      for (let i = 0; i < dictEntries.length; i++) {
        const [key, value] = dictEntries[i];
        entries.push(`${serializeName(key)} ${serializeToString(value)}`);
      }
      return `<<${entries.join(" ")}>>`;
    }
    if (obj instanceof PDFStream) {
      const dictStr = serializeToString(obj.dict);
      return dictStr;
    }
    return "null";
  }
  function serializeIndirectObject(objNum, genNum, obj) {
    const header = `${objNum} ${genNum} obj
`;
    if (obj instanceof PDFStream) {
      const dictStr = serializeToString(obj.dict);
      const streamData = obj.rawBytes;
      const prefix = stringToBytes(`${header}${dictStr}
stream
`);
      const suffix = stringToBytes("\nendstream\nendobj\n");
      const result = new Uint8Array(prefix.length + streamData.length + suffix.length);
      result.set(prefix, 0);
      result.set(streamData, prefix.length);
      result.set(suffix, prefix.length + streamData.length);
      return result;
    }
    const body = serializeToString(obj);
    return stringToBytes(`${header}${body}
endobj
`);
  }
  function formatNumber(value) {
    if (Number.isInteger(value)) return value.toString();
    let str = value.toFixed(5);
    if (str.includes(".")) {
      str = str.replace(/0+$/, "");
      str = str.replace(/\.$/, "");
    }
    return str;
  }
  function serializeLiteralString(value) {
    let escaped = "";
    for (let i = 0; i < value.length; i++) {
      const ch = value.charCodeAt(i);
      switch (ch) {
        case 10:
          escaped += "\\n";
          break;
        case 13:
          escaped += "\\r";
          break;
        case 9:
          escaped += "\\t";
          break;
        case 8:
          escaped += "\\b";
          break;
        case 12:
          escaped += "\\f";
          break;
        case 40:
          escaped += "\\(";
          break;
        // (
        case 41:
          escaped += "\\)";
          break;
        // )
        case 92:
          escaped += "\\\\";
          break;
        // \
        default:
          if (ch < 32 || ch > 126) {
            escaped += "\\" + ch.toString(8).padStart(3, "0");
          } else {
            escaped += value[i];
          }
      }
    }
    return `(${escaped})`;
  }
  function serializeName(name) {
    let escaped = "/";
    for (let i = 0; i < name.length; i++) {
      const ch = name.charCodeAt(i);
      if (ch < 33 || ch > 126 || ch === 35 || ch === 40 || ch === 41 || ch === 60 || ch === 62 || ch === 91 || ch === 93 || ch === 123 || ch === 125 || ch === 47 || ch === 37) {
        escaped += "#" + ch.toString(16).padStart(2, "0");
      } else {
        escaped += name[i];
      }
    }
    return escaped;
  }
  function stringToBytes(str) {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 255;
    }
    return bytes;
  }
  function concatBytes(...arrays) {
    let totalLength = 0;
    for (const arr of arrays) totalLength += arr.length;
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  // src/engine/writer/serializer.ts
  async function serializeDocument(doc) {
    const chunks = [];
    const offsets = /* @__PURE__ */ new Map();
    const header = stringToBytes2(`%PDF-${doc.version}
%\xE2\xE3\xCF\xD3
`);
    chunks.push(header);
    let currentOffset = header.length;
    const objectEntries = Array.from(doc.objects.entries());
    const objNumMap = /* @__PURE__ */ new Map();
    let nextObjNum = 1;
    for (let i = 0; i < objectEntries.length; i++) {
      const [key] = objectEntries[i];
      const parts = key.split("_");
      const objNum = parseInt(parts[0], 10);
      const genNum = parseInt(parts[1], 10);
      objNumMap.set(key, { objNum, genNum });
      if (objNum >= nextObjNum) nextObjNum = objNum + 1;
    }
    for (let i = 0; i < objectEntries.length; i++) {
      const [key, obj] = objectEntries[i];
      const nums = objNumMap.get(key);
      offsets.set(key, currentOffset);
      const objBytes = serializeIndirectObject(nums.objNum, nums.genNum, obj);
      chunks.push(objBytes);
      currentOffset += objBytes.length;
    }
    const xrefOffset = currentOffset;
    const xrefBytes = buildXrefTable(objectEntries, offsets, objNumMap);
    chunks.push(xrefBytes);
    currentOffset += xrefBytes.length;
    const catalogRef = doc.xref.trailerDict.getRef("Root");
    const infoRef = doc.xref.trailerDict.get("Info");
    const encryptRef = doc.xref.trailerDict.get("Encrypt");
    const idArr = doc.xref.trailerDict.get("ID");
    const trailerDict = new PDFDict();
    trailerDict.set("Size", new PDFNumber(nextObjNum));
    if (catalogRef) trailerDict.set("Root", catalogRef);
    if (infoRef) trailerDict.set("Info", infoRef);
    if (encryptRef) trailerDict.set("Encrypt", encryptRef);
    if (idArr) trailerDict.set("ID", idArr);
    const trailerBytes = stringToBytes2(
      `trailer
${trailerDictToString(trailerDict)}
startxref
${xrefOffset}
%%EOF
`
    );
    chunks.push(trailerBytes);
    return concatBytes(...chunks);
  }
  function buildXrefTable(entries, offsets, objNumMap) {
    let maxObjNum = 0;
    for (let i = 0; i < entries.length; i++) {
      const nums = objNumMap.get(entries[i][0]);
      if (nums.objNum > maxObjNum) maxObjNum = nums.objNum;
    }
    const byObjNum = /* @__PURE__ */ new Map();
    for (let i = 0; i < entries.length; i++) {
      const key = entries[i][0];
      const nums = objNumMap.get(key);
      const offset = offsets.get(key) ?? 0;
      byObjNum.set(nums.objNum, { offset, genNum: nums.genNum });
    }
    const lines = [];
    lines.push("xref");
    lines.push(`0 ${maxObjNum + 1}`);
    lines.push("0000000000 65535 f \r");
    for (let n = 1; n <= maxObjNum; n++) {
      const entry = byObjNum.get(n);
      if (entry) {
        const offsetStr = entry.offset.toString().padStart(10, "0");
        const genStr = entry.genNum.toString().padStart(5, "0");
        lines.push(`${offsetStr} ${genStr} n \r`);
      } else {
        lines.push("0000000000 00000 f \r");
      }
    }
    return stringToBytes2(lines.join("\n") + "\n");
  }
  function trailerDictToString(dict) {
    const entries = [];
    const dictEntries = Array.from(dict.entries());
    for (let i = 0; i < dictEntries.length; i++) {
      const [key, value] = dictEntries[i];
      entries.push(`/${key} ${pdfObjectToString(value)}`);
    }
    return `<< ${entries.join(" ")} >>`;
  }
  function pdfObjectToString(obj) {
    if (obj instanceof PDFNumber) return obj.toString();
    if (obj instanceof PDFName) return obj.toString();
    if (obj instanceof PDFRef) return obj.toString();
    if (obj instanceof PDFArray) {
      const items = [];
      for (let i = 0; i < obj.length; i++) {
        items.push(pdfObjectToString(obj.get(i)));
      }
      return `[${items.join(" ")}]`;
    }
    if (obj instanceof PDFDict) return trailerDictToString(obj);
    return obj.toString();
  }
  function stringToBytes2(str) {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 255;
    }
    return bytes;
  }

  // src/engine/fonts/font-augmentation.ts
  var FALLBACK_FONT = "HelvAug";
  var FALLBACK_FONT_BOLD = "HelvAugBold";
  var FALLBACK_FONT_OBLIQUE = "HelvAugOblique";
  var FALLBACK_FONT_BOLD_OBLIQUE = "HelvAugBoldOblique";
  function ensureFallbackFont(page, objects, style) {
    const wantBold = !!style?.bold;
    const wantItalic = !!style?.italic;
    let resourceName = FALLBACK_FONT;
    let baseFont = "Helvetica";
    if (wantBold && wantItalic) {
      resourceName = FALLBACK_FONT_BOLD_OBLIQUE;
      baseFont = "Helvetica-BoldOblique";
    } else if (wantBold) {
      resourceName = FALLBACK_FONT_BOLD;
      baseFont = "Helvetica-Bold";
    } else if (wantItalic) {
      resourceName = FALLBACK_FONT_OBLIQUE;
      baseFont = "Helvetica-Oblique";
    }
    const resourcesObj = page.dict.get("Resources");
    let resources = resourcesObj instanceof PDFRef ? resolveRef(resourcesObj, objects) : resourcesObj;
    if (!(resources instanceof PDFDict)) {
      resources = new PDFDict();
      page.dict.set("Resources", resources);
    }
    let fontDict = resources.get("Font");
    if (fontDict instanceof PDFRef) fontDict = resolveRef(fontDict, objects);
    if (!(fontDict instanceof PDFDict)) {
      fontDict = new PDFDict();
      resources.set("Font", fontDict);
    }
    if (!fontDict.has(resourceName)) {
      const helvetica = new PDFDict();
      helvetica.set("Type", new PDFName("Font"));
      helvetica.set("Subtype", new PDFName("Type1"));
      helvetica.set("BaseFont", new PDFName(baseFont));
      helvetica.set("Encoding", new PDFName("WinAnsiEncoding"));
      fontDict.set(resourceName, helvetica);
    }
    return resourceName;
  }

  // src/engine/flow/metrics.ts
  function fontNameStyleFlags(fontName) {
    const lower = fontName.replace(/^.*\+/, "").toLowerCase();
    return {
      bold: /bold|black|heavy|extrabold|demibold|semibold/.test(lower),
      italic: /italic|oblique|slanted/.test(lower)
    };
  }
  function resolveRunStyleFlags(fontName, fontData) {
    if (fontData?.standardMetrics) {
      return {
        bold: fontData.standardMetrics.isBold,
        italic: fontData.standardMetrics.isItalic
      };
    }
    if (fontData?.baseFont) return fontNameStyleFlags(fontData.baseFont);
    return fontNameStyleFlags(fontName);
  }

  // src/engine/editor/text-editor.ts
  function runFontSize(run) {
    if (run.glyphs.length > 0) {
      const tRm = run.glyphs[0].tRm;
      const fromTm = Math.hypot(tRm.a, tRm.b) || Math.hypot(tRm.c, tRm.d);
      if (fromTm > 0.5) return fromTm;
    }
    return run.fontSize > 0.5 ? run.fontSize : 12;
  }
  function applyTextEdits(contentBytes, page, objects, edits) {
    const instructions = parseContentStream(contentBytes);
    const textInstructions = findTextInstructions(instructions);
    let needsFontAugmentation = false;
    const missingCharCodes = [];
    let indexOffset = 0;
    for (const edit of edits) {
      if (edit.newText === edit.targetRun.text) {
        continue;
      }
      const fontData = loadFontForRun(edit.targetRun, page, objects);
      let encoded = encodeTextForFont(edit.newText, fontData);
      let useFallbackFont = null;
      const lossy = isEncodingLossy(edit.newText, encoded, fontData);
      if (lossy) {
        const flags = resolveRunStyleFlags(edit.targetRun.fontName, fontData);
        useFallbackFont = ensureFallbackFont(page, objects, flags);
        encoded = encodeTextWinAnsi(edit.newText);
        needsFontAugmentation = true;
        if (encoded.missing.length > 0) {
          missingCharCodes.push(...encoded.missing);
        }
      } else if (encoded.missing.length > 0) {
        needsFontAugmentation = true;
        missingCharCodes.push(...encoded.missing);
      }
      const rawIndices = edit.targetRun.sourceInstructionIndices ?? [];
      if (edit.newText !== edit.targetRun.text && rawIndices.length > 0) {
        const inserted = insertEraseRectForRun(
          instructions,
          edit.targetRun,
          edit.newText,
          Math.min(...rawIndices) + indexOffset
        );
        indexOffset += inserted;
      }
      const sourceInstructionIndices = rawIndices.map((i) => i + indexOffset);
      if (sourceInstructionIndices.length > 1) {
        const wrote = applyGroupedTextEdit(
          instructions,
          sourceInstructionIndices,
          edit.newText,
          encoded,
          useFallbackFont,
          edit.targetRun,
          fontData
        );
        indexOffset += wrote;
        continue;
      }
      let matched = null;
      if (sourceInstructionIndices.length === 1) {
        const idx = sourceInstructionIndices[0];
        const inst = instructions[idx];
        if (inst && isTextShowingOperator(inst.operator)) {
          matched = {
            index: idx,
            instruction: inst,
            fontInstruction: null,
            fontName: edit.targetRun.fontName,
            fontSize: edit.targetRun.fontSize,
            tmX: edit.targetRun.x,
            tmY: edit.targetRun.y
          };
        }
      }
      if (!matched) {
        matched = matchTextRunToInstruction(
          edit.targetRun,
          textInstructions,
          contentBytes,
          page,
          objects
        );
      }
      if (!matched) {
        console.warn("[TextEditor] Could not match text run to instruction");
        continue;
      }
      applyEncodedShowingOperands(
        matched.instruction,
        edit.newText,
        encoded,
        fontData,
        !!useFallbackFont
      );
      if (useFallbackFont) {
        const inserted = insertFallbackFontAround(
          instructions,
          matched.index,
          useFallbackFont,
          runFontSize(edit.targetRun)
        );
        indexOffset += inserted;
      }
    }
    const newBytes = compileInstructions(instructions);
    return {
      newContentBytes: newBytes,
      needsFontAugmentation,
      missingCharCodes
    };
  }
  function numVal(obj) {
    return obj instanceof PDFNumber ? obj.value : 0;
  }
  function findTextInstructions(instructions) {
    const result = [];
    let currentFont = "";
    let currentFontSize = 12;
    let lastTfInstruction = null;
    let tmE = 0, tmF = 0;
    let tlmE = 0, tlmF = 0;
    let tmA = 1, tmB = 0, tmC = 0, tmD = 1;
    let tlmA = 1, tlmB = 0, tlmC = 0, tlmD = 1;
    let textLeading = 0;
    for (let i = 0; i < instructions.length; i++) {
      const inst = instructions[i];
      switch (inst.operator) {
        case "BT":
          tmA = 1;
          tmB = 0;
          tmC = 0;
          tmD = 1;
          tmE = 0;
          tmF = 0;
          tlmA = 1;
          tlmB = 0;
          tlmC = 0;
          tlmD = 1;
          tlmE = 0;
          tlmF = 0;
          break;
        case "Tm": {
          tmA = numVal(inst.operands[0]);
          tmB = numVal(inst.operands[1]);
          tmC = numVal(inst.operands[2]);
          tmD = numVal(inst.operands[3]);
          tmE = numVal(inst.operands[4]);
          tmF = numVal(inst.operands[5]);
          tlmA = tmA;
          tlmB = tmB;
          tlmC = tmC;
          tlmD = tmD;
          tlmE = tmE;
          tlmF = tmF;
          break;
        }
        case "Td": {
          const tx = numVal(inst.operands[0]);
          const ty = numVal(inst.operands[1]);
          tlmE = tlmA * tx + tlmC * ty + tlmE;
          tlmF = tlmB * tx + tlmD * ty + tlmF;
          tmA = tlmA;
          tmB = tlmB;
          tmC = tlmC;
          tmD = tlmD;
          tmE = tlmE;
          tmF = tlmF;
          break;
        }
        case "TD": {
          const tx = numVal(inst.operands[0]);
          const ty = numVal(inst.operands[1]);
          textLeading = -ty;
          tlmE = tlmA * tx + tlmC * ty + tlmE;
          tlmF = tlmB * tx + tlmD * ty + tlmF;
          tmA = tlmA;
          tmB = tlmB;
          tmC = tlmC;
          tmD = tlmD;
          tmE = tlmE;
          tmF = tlmF;
          break;
        }
        case "T*": {
          const ty = -textLeading;
          tlmE = tlmC * ty + tlmE;
          tlmF = tlmD * ty + tlmF;
          tmA = tlmA;
          tmB = tlmB;
          tmC = tlmC;
          tmD = tlmD;
          tmE = tlmE;
          tmF = tlmF;
          break;
        }
        case "TL":
          textLeading = numVal(inst.operands[0]);
          break;
        case "Tf":
          currentFont = inst.operands[0] instanceof PDFName ? inst.operands[0].name : "";
          currentFontSize = inst.operands[1] instanceof PDFNumber ? inst.operands[1].value : 12;
          lastTfInstruction = inst;
          break;
      }
      if (inst.operator === "Tj" || inst.operator === "TJ" || inst.operator === "'" || inst.operator === '"') {
        result.push({
          instruction: inst,
          index: i,
          fontInstruction: lastTfInstruction,
          fontName: currentFont,
          fontSize: currentFontSize,
          tmX: tmE,
          tmY: tmF
        });
      }
    }
    return result;
  }
  function matchTextRunToInstruction(run, textInstructions, contentBytes, page, objects) {
    const fontsMatch = (tiFontName, runFontName) => {
      if (runFontName === "" || tiFontName === "") return true;
      if (tiFontName === runFontName) return true;
      return false;
    };
    for (const ti of textInstructions) {
      if (!fontsMatch(ti.fontName, run.fontName)) continue;
      const decoded = decodeInstructionText(ti.instruction, ti.fontName, page, objects);
      if (decoded === null) continue;
      if (decoded === run.text || decoded.trim() === run.text.trim()) {
        return ti;
      }
    }
    const runClean = run.text.replace(/\s+/g, "");
    if (runClean.length > 0) {
      for (const ti of textInstructions) {
        if (!fontsMatch(ti.fontName, run.fontName)) continue;
        const decoded = decodeInstructionText(ti.instruction, ti.fontName, page, objects);
        if (decoded === null) continue;
        const decClean = decoded.replace(/\s+/g, "");
        if (decClean === runClean) {
          return ti;
        }
      }
    }
    for (const ti of textInstructions) {
      if (!fontsMatch(ti.fontName, run.fontName)) continue;
      const decoded = decodeInstructionText(ti.instruction, ti.fontName, page, objects);
      if (decoded === null) continue;
      if (decoded.includes(run.text) && run.text.trim().length > 1) {
        return ti;
      }
    }
    const runNorm = run.text.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    if (runNorm.length > 2) {
      for (const ti of textInstructions) {
        if (!fontsMatch(ti.fontName, run.fontName)) continue;
        const decoded = decodeInstructionText(ti.instruction, ti.fontName, page, objects);
        if (decoded === null) continue;
        const decNorm = decoded.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        if (decNorm === runNorm) {
          return ti;
        }
      }
    }
    if (run.text.trim().length <= 2 && run.text.trim().length > 0) {
      const candidates = textInstructions.filter((ti) => {
        if (!fontsMatch(ti.fontName, run.fontName)) return false;
        const decoded = decodeInstructionText(ti.instruction, ti.fontName, page, objects);
        if (decoded === null) return false;
        return decoded.trim().length <= 3 && decoded.trim().length > 0;
      });
      if (candidates.length === 1) {
        return candidates[0];
      }
    }
    return null;
  }
  function decodeInstructionText(instruction, fontName, page, objects) {
    const op = instruction.operator;
    const ops = instruction.operands;
    if (op === "Tj") {
      return extractStringText(ops[0], fontName, page, objects);
    }
    if (op === "TJ") {
      const arr = ops[0];
      if (!(arr instanceof PDFArray)) return null;
      let text = "";
      for (let i = 0; i < arr.length; i++) {
        const item = arr.get(i);
        if (item instanceof PDFString || item instanceof PDFHexString) {
          text += extractStringText(item, fontName, page, objects) ?? "";
        }
      }
      return text;
    }
    if (op === "'") {
      return extractStringText(ops[0], fontName, page, objects);
    }
    if (op === '"') {
      return extractStringText(ops[2], fontName, page, objects);
    }
    return null;
  }
  function extractStringText(obj, fontName, page, objects) {
    if (!obj) return null;
    let bytes;
    if (obj instanceof PDFString) {
      bytes = obj.toBytes();
    } else if (obj instanceof PDFHexString) {
      bytes = obj.toBytes();
    } else {
      return null;
    }
    const fontData = loadFontForName(fontName, page, objects);
    if (!fontData) {
      let text2 = "";
      for (let i = 0; i < bytes.length; i++) {
        text2 += String.fromCharCode(bytes[i]);
      }
      return text2;
    }
    let text = "";
    const isComposite = fontData.isComposite;
    let idx = 0;
    while (idx < bytes.length) {
      let charCode;
      if (isComposite && idx + 1 < bytes.length) {
        charCode = bytes[idx] << 8 | bytes[idx + 1];
        idx += 2;
      } else {
        charCode = bytes[idx];
        idx += 1;
      }
      text += charCodeToUnicode(charCode, fontData);
    }
    return text;
  }
  function encodeTextForFont(text, fontData) {
    if (!fontData) {
      return encodeTextWinAnsi(text);
    }
    const missing = [];
    if (fontData.isComposite) {
      const reverseMap = buildReverseUnicodeMap(fontData);
      let hex = "";
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const code = reverseMap.get(char);
        if (code !== void 0 && code !== 0) {
          hex += code.toString(16).padStart(4, "0");
        } else {
          missing.push(char.codePointAt(0));
          hex += "0000";
        }
      }
      return {
        pdfString: new PDFHexString(hex),
        missing
      };
    } else {
      const reverseMap = buildReverseUnicodeMap(fontData);
      let result = "";
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const code = reverseMap.get(char);
        if (code !== void 0 && code !== 0) {
          result += String.fromCharCode(code & 255);
        } else {
          const cp = char.codePointAt(0);
          if (fontData.toUnicode.size > 0) {
            missing.push(cp);
            result += "?";
          } else if (cp < 256) {
            result += char;
          } else {
            missing.push(cp);
            result += "?";
          }
        }
      }
      return {
        pdfString: new PDFString(result),
        missing
      };
    }
  }
  function isBulletLike(cp) {
    return cp === 8226 || cp === 8227 || cp === 8259 || cp === 8729 || cp === 9679 || cp === 9675 || cp === 9702 || cp === 9642 || cp === 9643 || cp === 183 || cp === 8228 || cp === 65121 || cp === 65381 || cp >= 61440 && cp <= 61695;
  }
  function encodeTextWinAnsi(text) {
    const missing = [];
    let result = "";
    for (let i = 0; i < text.length; i++) {
      const cp = text.codePointAt(i);
      if (cp > 65535) {
        i++;
      }
      if (isBulletLike(cp)) {
        result += String.fromCharCode(149);
        continue;
      }
      if (cp <= 255) {
        result += String.fromCharCode(cp);
      } else {
        missing.push(cp);
        if (cp === 8216 || cp === 8217) result += "'";
        else if (cp === 8220 || cp === 8221) result += '"';
        else if (cp === 8211 || cp === 8212) result += "-";
        else if (cp === 8230) result += "...";
        else result += "?";
      }
    }
    return { pdfString: new PDFString(result), missing };
  }
  function isEncodingLossy(text, encoded, fontData) {
    if (!text) return false;
    if (encoded.missing.length > 0) return true;
    if (!fontData) return false;
    if (fontData.isComposite && encoded.pdfString instanceof PDFHexString) {
      const hex = encoded.pdfString.hex.replace(/\s/g, "");
      for (let i = 0; i + 3 < hex.length; i += 4) {
        if (hex.slice(i, i + 4) === "0000") return true;
      }
    }
    if (encoded.pdfString instanceof PDFString) {
      const out = encoded.pdfString.value;
      const n = Math.min(text.length, out.length);
      for (let i = 0; i < n; i++) {
        if (text[i] !== "?" && out[i] === "?") return true;
      }
      if (out.length !== text.length) return true;
      const isType3 = !!(fontData.charProcs && fontData.charProcs.size > 0);
      if (isType3) {
        let g0Hits = 0;
        for (let i = 0; i < out.length; i++) {
          const code = out.charCodeAt(i) & 255;
          const name = fontData.differences.get(code);
          if (name === "g0" || name != null && !fontData.charProcs.has(name)) g0Hits++;
          else if (name == null && fontData.toUnicode.size > 0 && !fontData.toUnicode.has(code)) g0Hits++;
        }
        if (g0Hits > 0) return true;
      }
    }
    return false;
  }
  function insertFallbackFontAround(instructions, textIndex, fallbackFont, visualSize) {
    if (textIndex < 0 || textIndex >= instructions.length) return 0;
    let size = Number.isFinite(visualSize) && visualSize > 0 ? visualSize : 12;
    let prevFont = null;
    for (let i = textIndex - 1; i >= 0; i--) {
      if (instructions[i].operator === "BT") break;
      if (instructions[i].operator === "Tf" && instructions[i].operands.length >= 2) {
        const nameOp = instructions[i].operands[0];
        const sizeOp = instructions[i].operands[1];
        if (nameOp instanceof PDFName) prevFont = nameOp.name;
        if (sizeOp instanceof PDFNumber && sizeOp.value > 0) size = sizeOp.value;
        break;
      }
    }
    instructions.splice(textIndex, 0, {
      operator: "Tf",
      operands: [new PDFName(fallbackFont), new PDFNumber(size)],
      offset: 0
    });
    let inserted = 1;
    if (prevFont && prevFont !== fallbackFont) {
      instructions.splice(textIndex + 2, 0, {
        operator: "Tf",
        operands: [new PDFName(prevFont), new PDFNumber(size)],
        offset: 0
      });
      inserted += 1;
    }
    return inserted;
  }
  function buildReverseUnicodeMap(fontData) {
    const reverse = /* @__PURE__ */ new Map();
    const entries = Array.from(fontData.toUnicode.entries());
    for (let i = 0; i < entries.length; i++) {
      const [code, unicode] = entries[i];
      reverse.set(unicode, code);
    }
    const diffEntries = Array.from(fontData.differences.entries());
    for (let i = 0; i < diffEntries.length; i++) {
      const [code, glyphName] = diffEntries[i];
      if (glyphName.length === 1) {
        reverse.set(glyphName, code);
      }
    }
    const isType3 = !!(fontData.charProcs && fontData.charProcs.size > 0);
    if (!fontData.isComposite && !isType3) {
      for (let i = 32; i <= 126; i++) {
        const char = String.fromCharCode(i);
        if (!reverse.has(char)) {
          reverse.set(char, i);
        }
      }
    }
    return reverse;
  }
  function isTextShowingOperator(op) {
    return op === "Tj" || op === "TJ" || op === "'" || op === '"';
  }
  function insertEraseRectForRun(instructions, run, newText, hintIndex) {
    if (hintIndex < 0 || hintIndex >= instructions.length) return 0;
    let btIndex = hintIndex;
    for (let i = hintIndex; i >= 0; i--) {
      if (instructions[i].operator === "BT") {
        btIndex = i;
        break;
      }
      if (instructions[i].operator === "ET") break;
    }
    const fontSize = run.fontSize || run.glyphs[0]?.fontSize || 12;
    const pad = Math.max(1, fontSize * 0.08);
    const eraseWidth = Math.max(run.width, fontSize * 0.5) + pad * 2;
    const ascent = fontSize * 0.85;
    const descent = fontSize * 0.25;
    const eraseHeight = ascent + descent + pad * 2;
    const eraseX = run.x - pad;
    const eraseY = run.y - descent - pad;
    const eraseOps = [
      { operator: "q", operands: [], offset: 0 },
      { operator: "rg", operands: [new PDFNumber(1), new PDFNumber(1), new PDFNumber(1)], offset: 0 },
      {
        operator: "re",
        operands: [
          new PDFNumber(eraseX),
          new PDFNumber(eraseY),
          new PDFNumber(eraseWidth),
          new PDFNumber(eraseHeight)
        ],
        offset: 0
      },
      { operator: "f", operands: [], offset: 0 },
      { operator: "Q", operands: [], offset: 0 }
    ];
    instructions.splice(btIndex, 0, ...eraseOps);
    return eraseOps.length;
  }
  function applyGroupedTextEdit(instructions, sourceIndices, newText, encoded, fallbackFont, run, fontData) {
    const sortedIndices = Array.from(new Set(sourceIndices)).sort((a, b) => a - b);
    let primaryIdx = -1;
    for (let i = 0; i < sortedIndices.length; i++) {
      const idx = sortedIndices[i];
      const inst = instructions[idx];
      if (inst && isTextShowingOperator(inst.operator)) {
        primaryIdx = idx;
        break;
      }
    }
    if (primaryIdx < 0) return 0;
    const empty = new PDFString("");
    const primary = instructions[primaryIdx];
    applyEncodedShowingOperands(primary, newText, encoded, fontData, !!fallbackFont);
    for (let i = 0; i < sortedIndices.length; i++) {
      const idx = sortedIndices[i];
      if (idx === primaryIdx) continue;
      const inst = instructions[idx];
      if (!inst || !isTextShowingOperator(inst.operator)) continue;
      if (inst.operator === "TJ") {
        inst.operands = [new PDFArray([empty])];
      } else {
        inst.operands = [empty];
      }
    }
    if (fallbackFont) {
      return insertFallbackFontAround(
        instructions,
        primaryIdx,
        fallbackFont,
        runFontSize(run)
      );
    }
    return 0;
  }
  var SPACE_TJ_EM = 0.28;
  var SPACE_TJ_MAX_CHARS = 64;
  function spaceSupplementalTJ(fontData, useWinAnsi) {
    const desired = Math.round(SPACE_TJ_EM * 1e3);
    const glyphW = fontData?.widths?.get(32) ?? fontData?.widths?.get(32) ?? (useWinAnsi ? 278 : 0);
    return Math.max(0, desired - Math.max(0, glyphW));
  }
  function buildTJWithSpaceAdvances(text, fontData, useWinAnsi) {
    const items = [];
    const parts = text.split(/([ ]+)/);
    const supplemental = spaceSupplementalTJ(fontData, useWinAnsi);
    for (const part of parts) {
      if (!part) continue;
      if (/^ +$/.test(part)) {
        const enc2 = useWinAnsi ? encodeTextWinAnsi(part) : encodeTextForFont(part, fontData);
        items.push(enc2.pdfString);
        if (supplemental > 0) {
          const advChars = Math.min(part.length, SPACE_TJ_MAX_CHARS);
          items.push(new PDFNumber(-Math.round(advChars * supplemental)));
        }
        continue;
      }
      const enc = useWinAnsi ? encodeTextWinAnsi(part) : encodeTextForFont(part, fontData);
      items.push(enc.pdfString);
    }
    if (items.length === 0) {
      const enc = useWinAnsi ? encodeTextWinAnsi(text) : encodeTextForFont(text, fontData);
      items.push(enc.pdfString);
    }
    return new PDFArray(items);
  }
  function applyEncodedShowingOperands(inst, text, encoded, fontData, useWinAnsi) {
    if (/ /.test(text)) {
      inst.operator = "TJ";
      inst.operands = [buildTJWithSpaceAdvances(text, fontData, useWinAnsi)];
      return;
    }
    if (inst.operator === "TJ") {
      inst.operands = [new PDFArray([encoded.pdfString])];
    } else {
      inst.operands = [encoded.pdfString];
    }
  }
  function compileInstructions(instructions) {
    const parts = [];
    for (let i = 0; i < instructions.length; i++) {
      const inst = instructions[i];
      for (const op of inst.operands) {
        parts.push(serializeToString(op));
        parts.push(" ");
      }
      parts.push(inst.operator);
      parts.push("\n");
    }
    const text = parts.join("");
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      bytes[i] = text.charCodeAt(i) & 255;
    }
    return bytes;
  }
  function loadFontForRun(run, page, objects) {
    return loadFontForName(run.fontName, page, objects);
  }
  function loadFontForName(fontName, page, objects) {
    const fontDictRef = page.resources.get("Font");
    if (!fontDictRef) return null;
    const fontDict = resolveRef(fontDictRef, objects);
    if (!(fontDict instanceof PDFDict)) return null;
    const fontRef = fontDict.get(fontName);
    if (!fontRef) return null;
    const fontObj = resolveRef(fontRef, objects);
    if (!(fontObj instanceof PDFDict)) return null;
    return loadFont(fontName, fontObj, objects);
  }
  function findTextInPage(contentBytes, page, objects, searchText, caseSensitive = false) {
    const interpreted = interpretPage(contentBytes, page, objects);
    const results = [];
    const search = caseSensitive ? searchText : searchText.toLowerCase();
    for (const run of interpreted.textRuns) {
      const text = caseSensitive ? run.text : run.text.toLowerCase();
      if (text.includes(search)) {
        results.push(run);
      }
    }
    return results;
  }
  function findAndReplace(contentBytes, page, objects, searchText, replaceText, caseSensitive = false) {
    const matchingRuns = findTextInPage(contentBytes, page, objects, searchText, caseSensitive);
    const edits = matchingRuns.map((run) => {
      let newText;
      if (caseSensitive) {
        newText = run.text.split(searchText).join(replaceText);
      } else {
        const regex = new RegExp(escapeRegex(searchText), "gi");
        newText = run.text.replace(regex, replaceText);
      }
      return { targetRun: run, newText };
    });
    return applyTextEdits(contentBytes, page, objects, edits);
  }
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return __toCommonJS(bloom_entry_exports);
})();
