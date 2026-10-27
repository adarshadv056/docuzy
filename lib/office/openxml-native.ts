/**
 * Pure In-House Native OpenXML Generator for .docx, .xlsx, and .pptx
 * 100% In-house, zero external npm dependencies.
 *
 * Implements ISO/IEC 29500 OpenXML standards using lib/zip/zip-native.ts.
 */

import { createZip, readZip, ZipEntry } from '../zip/zip-native';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function colToLetter(c: number): string {
  let s = '';
  let temp = c + 1;
  while (temp > 0) {
    const m = (temp - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    temp = Math.floor((temp - m) / 26);
  }
  return s;
}

export function letterToCol(letters: string): number {
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col - 1;
}

// ==========================================
// 1. DOCX GENERATION (.docx)
// ==========================================

export interface DocxParagraph {
  text: string;
  isHeading?: boolean;
  headingLevel?: 1 | 2 | 3;
  isBold?: boolean;
  isItalic?: boolean;
}

export async function createDocx(paragraphs: DocxParagraph[]): Promise<Uint8Array> {
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const packageRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  let documentBody = '';
  for (const p of paragraphs) {
    const escaped = escapeXml(p.text);
    const fontSize = p.isHeading
      ? p.headingLevel === 1
        ? 36
        : p.headingLevel === 2
        ? 28
        : 24
      : 22; // half-points (22 = 11pt)

    documentBody += `
    <w:p>
      <w:pPr>
        ${p.isHeading ? `<w:pStyle w:val="Heading${p.headingLevel || 1}"/>` : ''}
        <w:rPr>
          ${p.isHeading || p.isBold ? '<w:b/>' : ''}
          ${p.isItalic ? '<w:i/>' : ''}
          <w:sz w:val="${fontSize}"/>
        </w:rPr>
      </w:pPr>
      <w:r>
        <w:rPr>
          ${p.isHeading || p.isBold ? '<w:b/>' : ''}
          ${p.isItalic ? '<w:i/>' : ''}
          <w:sz w:val="${fontSize}"/>
        </w:rPr>
        <w:t xml:space="preserve">${escaped}</w:t>
      </w:r>
    </w:p>`;
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${documentBody}
  </w:body>
</w:document>`;

  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml) },
    { name: '_rels/.rels', data: encoder.encode(packageRelsXml) },
    { name: 'word/document.xml', data: encoder.encode(documentXml) },
  ];

  return await createZip(entries);
}

// ==========================================
// 2. XLSX GENERATION (.xlsx)
// ==========================================

export async function createXlsx(rows: string[][], sheetName = 'Sheet1'): Promise<Uint8Array> {
  const safeSheetName = escapeXml(sheetName || 'Sheet1');
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const packageRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  let sheetDataXml = '';
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const rowNum = r + 1;
    let cellsXml = '';

    for (let c = 0; c < row.length; c++) {
      const colLetter = colToLetter(c);
      const cellRef = `${colLetter}${rowNum}`;
      const escapedVal = escapeXml(row[c] ?? '');

      cellsXml += `
        <c r="${cellRef}" t="inlineStr">
          <is><t>${escapedVal}</t></is>
        </c>`;
    }

    sheetDataXml += `<row r="${rowNum}">${cellsXml}</row>`;
  }

  const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${sheetDataXml}
  </sheetData>
</worksheet>`;

  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml) },
    { name: '_rels/.rels', data: encoder.encode(packageRelsXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRelsXml) },
    { name: 'xl/workbook.xml', data: encoder.encode(workbookXml) },
    { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(worksheetXml) },
  ];

  return await createZip(entries);
}

export interface XlsxSheet {
  name: string;
  rows: string[][];
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let match: RegExpExecArray | null;

  while ((match = siRegex.exec(xml)) !== null) {
    const content = match[1];
    const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
    let tMatch: RegExpExecArray | null;
    let text = '';
    while ((tMatch = tRegex.exec(content)) !== null) {
      text += unescapeXml(tMatch[1]);
    }
    strings.push(text);
  }

  return strings;
}

function parseWorksheetXml(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  const rowRegex = /<row\b([^>]*)>([\s\S]*?)<\/row>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowContent = rowMatch[2];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let cellMatch: RegExpExecArray | null;
    const rowCells: string[] = [];

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];

      const rMatch = attrs.match(/\br="([A-Za-z]+)(\d+)"/);
      const tMatch = attrs.match(/\bt="([^"]+)"/);
      const cellType = tMatch ? tMatch[1] : '';

      let value = '';
      if (cellType === 's') {
        const vMatch = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
        const idx = vMatch ? parseInt(vMatch[1].trim(), 10) : -1;
        value = idx >= 0 && idx < sharedStrings.length ? sharedStrings[idx] : '';
      } else if (cellType === 'inlineStr') {
        const isMatch = body.match(/<is\b[^>]*>([\s\S]*?)<\/is>/i);
        if (isMatch) {
          const tMatches = isMatch[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi);
          value = Array.from(tMatches).map((m) => unescapeXml(m[1])).join('');
        }
      } else if (cellType === 'b') {
        const vMatch = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
        value = vMatch && vMatch[1].trim() === '1' ? 'TRUE' : 'FALSE';
      } else {
        const vMatch = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
        value = vMatch ? unescapeXml(vMatch[1].trim()) : '';
      }

      if (rMatch) {
        const colIdx = letterToCol(rMatch[1].toUpperCase());
        while (rowCells.length < colIdx) {
          rowCells.push('');
        }
        rowCells[colIdx] = value;
      } else {
        rowCells.push(value);
      }
    }

    if (rowCells.length > 0) {
      rows.push(rowCells);
    }
  }

  return rows;
}

/**
 * Extracts worksheets from an OpenXML .xlsx file buffer.
 * 100% In-house, zero external dependencies.
 */
export async function parseXlsx(data: Uint8Array): Promise<XlsxSheet[]> {
  const entries = await readZip(data);
  const decoder = new TextDecoder();

  const getEntry = (path: string): ZipEntry | undefined => {
    const target = path.toLowerCase().replace(/^[/\\]+/, '');
    return entries.find((e) => e.name.toLowerCase().replace(/^[/\\]+/, '') === target);
  };

  // 1. Shared Strings
  const ssEntry = getEntry('xl/sharedStrings.xml');
  const sharedStrings = ssEntry ? parseSharedStrings(decoder.decode(ssEntry.data)) : [];

  // 2. Discover sheets from workbook.xml
  const wbEntry = getEntry('xl/workbook.xml');
  const sheets: XlsxSheet[] = [];

  if (wbEntry) {
    const wbXml = decoder.decode(wbEntry.data);
    const sheetTagRegex = /<sheet\b([^>]*)\/?>/gi;
    let match: RegExpExecArray | null;

    let sheetIdx = 1;
    while ((match = sheetTagRegex.exec(wbXml)) !== null) {
      const attrs = match[1];
      const nameMatch = attrs.match(/\bname="([^"]+)"/i);
      const sheetName = nameMatch ? unescapeXml(nameMatch[1]) : `Sheet ${sheetIdx}`;

      // Worksheet target usually xl/worksheets/sheet1.xml
      const sheetEntry = getEntry(`xl/worksheets/sheet${sheetIdx}.xml`);
      if (sheetEntry) {
        const rows = parseWorksheetXml(decoder.decode(sheetEntry.data), sharedStrings);
        sheets.push({ name: sheetName, rows });
      }
      sheetIdx++;
    }
  }

  // Fallback: If no sheets found through workbook.xml, scan all sheet*.xml entries
  if (sheets.length === 0) {
    let sheetCounter = 1;
    for (const entry of entries) {
      const lower = entry.name.toLowerCase().replace(/\\/g, '/');
      if (lower.startsWith('xl/worksheets/sheet') && lower.endsWith('.xml')) {
        const rows = parseWorksheetXml(decoder.decode(entry.data), sharedStrings);
        sheets.push({ name: `Sheet ${sheetCounter++}`, rows });
      }
    }
  }

  return sheets;
}

/**
 * Robust RFC 4180 compliant CSV parser.
 * Handles quoted fields, escaped quotes, multiline values, and auto-detects delimiter.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  // Auto-detect delimiter
  let delimiter = ',';
  const firstLine = text.split(/\r?\n/)[0] || '';
  if (!firstLine.includes(',') && firstLine.includes(';')) delimiter = ';';
  else if (!firstLine.includes(',') && firstLine.includes('\t')) delimiter = '\t';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      currentCell = '';
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Converts a 2D array of string cells to standard RFC 4180 CSV text.
 */
export function rowsToCsv(rows: string[][], delimiter = ','): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const val = cell ?? '';
          if (val.includes(delimiter) || val.includes('"') || val.includes('\n') || val.includes('\r')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        })
        .join(delimiter)
    )
    .join('\r\n');
}

// ==========================================
// 3. PPTX GENERATION (.pptx)
// ==========================================

export interface PptxSlide {
  title: string;
  bullets: string[];
}

export async function createPptx(slides: PptxSlide[]): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [];

  let contentTypesOverrides = '';
  let presentationRels = '';
  let presentationSlidesList = '';

  const packageRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
  entries.push({ name: '_rels/.rels', data: encoder.encode(packageRelsXml) });

  for (let i = 0; i < slides.length; i++) {
    const slideNum = i + 1;
    const relId = `rId${slideNum + 10}`;

    contentTypesOverrides += `<Override PartName="/ppt/slides/slide${slideNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>\n`;
    presentationRels += `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideNum}.xml"/>\n`;
    presentationSlidesList += `<p:sldId id="${256 + i}" r:id="${relId}"/>\n`;

    const slide = slides[i];
    const escapedTitle = escapeXml(slide.title);

    let bulletsXml = '';
    for (const b of slide.bullets) {
      bulletsXml += `
        <a:p>
          <a:pPr lvl="0"/>
          <a:r>
            <a:rPr lang="en-US" sz="2000"/>
            <a:t>${escapeXml(b)}</a:t>
          </a:r>
        </a:p>`;
    }

    const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>
      <!-- Title Box -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="685800" y="609600"/>
            <a:ext cx="7772400" cy="1143000"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="3600" b="1"/>
              <a:t>${escapedTitle}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <!-- Content Box -->
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Content"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="685800" y="1981200"/>
            <a:ext cx="7772400" cy="4572000"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          ${bulletsXml}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

    entries.push({ name: `ppt/slides/slide${slideNum}.xml`, data: encoder.encode(slideXml) });
  }

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${contentTypesOverrides}
</Types>`;
  entries.push({ name: '[Content_Types].xml', data: encoder.encode(contentTypesXml) });

  const presentationRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${presentationRels}
</Relationships>`;
  entries.push({ name: 'ppt/_rels/presentation.xml.rels', data: encoder.encode(presentationRelsXml) });

  const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    ${presentationSlidesList}
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
</p:presentation>`;
  entries.push({ name: 'ppt/presentation.xml', data: encoder.encode(presentationXml) });

  return await createZip(entries);
}
