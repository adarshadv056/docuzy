import { createZip, type ZipEntry } from "@/lib/zip/zip-native";

export interface EpubChapter {
  id: string;
  title: string;
  contentHtml: string;
}

export interface EpubMetadata {
  title: string;
  author: string;
  language?: string;
  publisher?: string;
  identifier?: string;
  description?: string;
  coverImageBytes?: Uint8Array;
  coverImageMime?: "image/jpeg" | "image/png" | "image/webp";
}

export type EpubTheme = "classic" | "modern" | "academic";

export interface EpubOptions {
  theme?: EpubTheme;
}

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "urn:uuid:docuzy-" + Math.random().toString(36).slice(2, 11) + "-" + Date.now().toString(36);
}

function getThemeCss(theme: EpubTheme): string {
  switch (theme) {
    case "modern":
      return `/* Docuzy EPUB Modern Theme */
@charset "utf-8";
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 1em;
  line-height: 1.65;
  margin: 5%;
  color: #1e293b;
  background-color: transparent;
}
p {
  margin-top: 0;
  margin-bottom: 1em;
  text-align: left;
}
h1, h2, h3, h4, h5, h6 {
  font-family: inherit;
  font-weight: 700;
  line-height: 1.25;
  color: #0f172a;
}
h1 {
  font-size: 1.8em;
  margin-top: 1.5em;
  margin-bottom: 0.8em;
  page-break-before: always;
}
h2 {
  font-size: 1.4em;
  margin-top: 1.3em;
  margin-bottom: 0.6em;
}
h3 {
  font-size: 1.15em;
  margin-top: 1em;
  margin-bottom: 0.5em;
}
blockquote {
  margin: 1.2em 0;
  padding: 0.6em 1.2em;
  border-left: 3px solid #6366f1;
  background-color: rgba(99, 102, 241, 0.05);
  font-style: italic;
  color: #334155;
}
ul, ol {
  margin: 0 0 1em 1.5em;
  padding: 0;
}
li {
  margin-bottom: 0.4em;
}
hr {
  border: 0;
  height: 1px;
  background-color: #cbd5e1;
  margin: 2em auto;
  width: 50%;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
}
th, td {
  border: 1px solid #e2e8f0;
  padding: 0.5em 0.75em;
  text-align: left;
}
th {
  background-color: #f8fafc;
  font-weight: 600;
}
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1em auto;
}
`;

    case "academic":
      return `/* Docuzy EPUB Academic Theme */
@charset "utf-8";
body {
  font-family: "Times New Roman", Times, "Liberation Serif", serif;
  font-size: 1em;
  line-height: 1.5;
  margin: 6%;
  color: #111827;
  background-color: transparent;
}
p {
  text-indent: 2em;
  margin-top: 0;
  margin-bottom: 0;
  text-align: justify;
}
p.first, h1 + p, h2 + p, h3 + p, hr + p {
  text-indent: 0;
}
h1, h2, h3, h4 {
  font-family: inherit;
  text-align: center;
  color: #000;
}
h1 {
  font-size: 1.6em;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 2.5em;
  margin-bottom: 1.2em;
  page-break-before: always;
}
h2 {
  font-size: 1.3em;
  font-weight: bold;
  margin-top: 1.8em;
  margin-bottom: 0.8em;
}
h3 {
  font-size: 1.1em;
  font-style: italic;
  margin-top: 1.2em;
  margin-bottom: 0.5em;
}
blockquote {
  margin: 1.2em 2.5em;
  font-style: italic;
  font-size: 0.95em;
  line-height: 1.45;
}
ul, ol {
  margin: 0.8em 0 0.8em 2em;
}
li {
  margin-bottom: 0.3em;
}
hr {
  border: none;
  text-align: center;
  margin: 2em 0;
}
hr::after {
  content: "* * *";
  letter-spacing: 0.4em;
  font-size: 0.9em;
  color: #4b5563;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
  font-size: 0.9em;
}
th, td {
  border-top: 1px solid #111;
  border-bottom: 1px solid #111;
  padding: 0.4em 0.6em;
}
th {
  font-weight: bold;
  border-bottom: 2px solid #111;
}
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1em auto;
}
`;

    case "classic":
    default:
      return `/* Docuzy EPUB Classic Book Theme */
@charset "utf-8";
body {
  font-family: Georgia, "Palatino Linotype", "Book Antiqua", Palatino, serif;
  font-size: 1em;
  line-height: 1.6;
  margin: 5%;
  color: #27272a;
  background-color: transparent;
}
p {
  text-indent: 1.5em;
  margin-top: 0;
  margin-bottom: 0;
  text-align: justify;
}
p.first, h1 + p, h2 + p, h3 + p, hr + p {
  text-indent: 0;
}
h1, h2, h3, h4 {
  font-family: inherit;
  font-weight: normal;
  color: #18181b;
}
h1 {
  font-size: 1.8em;
  text-align: center;
  margin-top: 2.2em;
  margin-bottom: 1.2em;
  page-break-before: always;
}
h2 {
  font-size: 1.35em;
  font-style: italic;
  margin-top: 1.6em;
  margin-bottom: 0.8em;
}
h3 {
  font-size: 1.1em;
  margin-top: 1.2em;
  margin-bottom: 0.5em;
}
blockquote {
  margin: 1.2em 2em;
  padding-left: 1em;
  border-left: 2px solid #a1a1aa;
  font-style: italic;
  color: #3f3f46;
}
ul, ol {
  margin: 0.8em 0 0.8em 1.8em;
}
li {
  margin-bottom: 0.35em;
}
hr {
  border: 0;
  height: 1px;
  background-color: #d4d4d8;
  margin: 2em auto;
  width: 40%;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
}
th, td {
  border: 1px solid #d4d4d8;
  padding: 0.4em 0.6em;
}
th {
  background-color: #f4f4f5;
  font-weight: bold;
}
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1em auto;
}
`;
  }
}

/**
 * Creates a standard EPUB 3.0 archive with EPUB 2 NCX fallback.
 * 100% In-house, zero external dependencies.
 */
export async function createEpub(
  metadata: EpubMetadata,
  chapters: EpubChapter[],
  options: EpubOptions = {}
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const entries: ZipEntry[] = [];

  const theme = options.theme || "classic";
  const lang = metadata.language || "en";
  const identifier = metadata.identifier || generateUuid();
  const title = metadata.title || "Untitled Document";
  const author = metadata.author || "Unknown Author";
  const isoDate = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const hasCover = Boolean(metadata.coverImageBytes && metadata.coverImageBytes.length > 0);
  const coverExt = metadata.coverImageMime === "image/png" ? "png" : "jpg";
  const coverMime = metadata.coverImageMime || "image/jpeg";
  const coverFileName = `cover.${coverExt}`;

  // 1. mimetype: MUST be stored first and uncompressed
  entries.push({
    name: "mimetype",
    data: enc.encode("application/epub+zip"),
    store: true,
  });

  // 2. META-INF/container.xml
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  entries.push({
    name: "META-INF/container.xml",
    data: enc.encode(containerXml),
  });

  // 3. OEBPS/style.css
  entries.push({
    name: "OEBPS/style.css",
    data: enc.encode(getThemeCss(theme)),
  });

  // 4. Cover Image & Cover Page (if present)
  if (hasCover && metadata.coverImageBytes) {
    entries.push({
      name: `OEBPS/${coverFileName}`,
      data: metadata.coverImageBytes,
    });

    const coverXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head>
  <title>Cover</title>
  <style type="text/css">
    body {
      margin: 0;
      padding: 0;
      text-align: center;
      background-color: #09090b;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img {
      max-width: 100%;
      max-height: 100%;
      height: auto;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <div>
    <img src="${coverFileName}" alt="Book Cover" />
  </div>
</body>
</html>`;
    entries.push({
      name: "OEBPS/cover.xhtml",
      data: enc.encode(coverXhtml),
    });
  }

  // 5. Chapter XHTML documents
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const chId = ch.id || `chapter-${i + 1}`;
    const chTitle = ch.title || `Chapter ${i + 1}`;
    const fileName = `${chId}.xhtml`;

    const chapterXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head>
  <title>${xmlEscape(chTitle)}</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
  <section epub:type="chapter" role="doc-chapter">
    <h1 class="chapter-title">${xmlEscape(chTitle)}</h1>
    <div class="chapter-body">
      ${ch.contentHtml}
    </div>
  </section>
</body>
</html>`;

    entries.push({
      name: `OEBPS/${fileName}`,
      data: enc.encode(chapterXhtml),
    });
  }

  // 6. OEBPS/toc.xhtml (EPUB 3 Navigation Document)
  const navListHtml = chapters
    .map(
      (ch, idx) =>
        `      <li><a href="${ch.id || `chapter-${idx + 1}`}.xhtml">${xmlEscape(ch.title || `Chapter ${idx + 1}`)}</a></li>`
    )
    .join("\n");

  const tocXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head>
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="style.css" />
  <style type="text/css">
    nav#toc ol { list-style-type: none; padding-left: 0; }
    nav#toc li { margin-bottom: 0.6em; }
    nav#toc a { text-decoration: none; color: inherit; font-size: 1.1em; }
    nav#toc a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <nav epub:type="toc" id="toc" role="doc-toc">
    <h1>Table of Contents</h1>
    <ol>
${navListHtml}
    </ol>
  </nav>
</body>
</html>`;
  entries.push({
    name: "OEBPS/toc.xhtml",
    data: enc.encode(tocXhtml),
  });

  // 7. OEBPS/toc.ncx (EPUB 2 NCX for older e-readers & Kindle fallback)
  const navPoints = chapters
    .map((ch, idx) => {
      const playOrder = idx + 1;
      const chId = ch.id || `chapter-${idx + 1}`;
      const chTitle = ch.title || `Chapter ${idx + 1}`;
      return `    <navPoint id="navPoint-${playOrder}" playOrder="${playOrder}">
      <navLabel><text>${xmlEscape(chTitle)}</text></navLabel>
      <content src="${chId}.xhtml"/>
    </navPoint>`;
    })
    .join("\n");

  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${identifier}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${xmlEscape(title)}</text>
  </docTitle>
  <docAuthor>
    <text>${xmlEscape(author)}</text>
  </docAuthor>
  <navMap>
${navPoints}
  </navMap>
</ncx>`;
  entries.push({
    name: "OEBPS/toc.ncx",
    data: enc.encode(tocNcx),
  });

  // 8. OEBPS/content.opf (The Package Document)
  const publisherXml = metadata.publisher ? `\n    <dc:publisher>${xmlEscape(metadata.publisher)}</dc:publisher>` : "";
  const descriptionXml = metadata.description
    ? `\n    <dc:description>${xmlEscape(metadata.description)}</dc:description>`
    : "";
  const coverMetaXml = hasCover ? `\n    <meta name="cover" content="cover-image"/>` : "";

  let manifestItems = `    <item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="style" href="style.css" media-type="text/css"/>`;

  if (hasCover) {
    manifestItems += `\n    <item id="cover-image" href="${coverFileName}" media-type="${coverMime}" properties="cover-image"/>`;
    manifestItems += `\n    <item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>`;
  }

  for (let i = 0; i < chapters.length; i++) {
    const chId = chapters[i].id || `chapter-${i + 1}`;
    manifestItems += `\n    <item id="${chId}" href="${chId}.xhtml" media-type="application/xhtml+xml"/>`;
  }

  let spineItems = "";
  if (hasCover) {
    spineItems += `    <itemref idref="cover-page" linear="no"/>\n`;
  }
  spineItems += chapters.map((ch, idx) => `    <itemref idref="${ch.id || `chapter-${idx + 1}`}"/>`).join("\n");

  const contentOpf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="${lang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${identifier}</dc:identifier>
    <dc:title>${xmlEscape(title)}</dc:title>
    <dc:creator id="creator">${xmlEscape(author)}</dc:creator>
    <dc:language>${lang}</dc:language>
    <meta property="dcterms:modified">${isoDate}</meta>${publisherXml}${descriptionXml}${coverMetaXml}
  </metadata>
  <manifest>
${manifestItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`;

  entries.push({
    name: "OEBPS/content.opf",
    data: enc.encode(contentOpf),
  });

  return await createZip(entries);
}
