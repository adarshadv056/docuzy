import { createEpub, type EpubChapter, type EpubMetadata } from '@/lib/ebook/epub-native'

/**
 * Creates a clean in-memory sample EPUB for instant testing in the E-book to PDF tool.
 */
export async function createSampleEbook(): Promise<{ data: Uint8Array; fileName: string }> {
  const metadata: EpubMetadata = {
    title: 'The Architecture of Modern Typography',
    author: 'Docuzy Press',
    publisher: 'Docuzy Publishing House',
    language: 'en',
    description:
      'A masterclass on document layout, reader ergonomics, optical rhythm, and privacy-first digital publishing.',
  }

  const chapters: EpubChapter[] = [
    {
      id: 'ch1',
      title: 'Chapter 1: The Geometry of Reading',
      contentHtml: `
        <h1>Chapter 1: The Geometry of Reading</h1>
        <p class="lead"><strong>Typography is the craft of endowing human language with a durable visual form.</strong> In printed books and digital readers alike, reading comfort depends on the harmonious relationship between line length, margin proportion, and optical line spacing.</p>
        
        <h2>The Golden Proportions</h2>
        <p>For centuries, master book designers observed that an ideal line of body text contains between 55 and 75 characters. When lines are excessively long, the eye struggles to find the start of the next line; when lines are too short, the rhythm of saccadic eye movements is repeatedly broken.</p>
        
        <blockquote>
          "A reader should never notice the type when absorbed in a great narrative. The typography must act as a crystal goblet, revealing the content without distorting its flavor."
          <footer>— Beatrice Warde, <em>The Crystal Goblet</em></footer>
        </blockquote>

        <h3>Key Principles of Book Layout</h3>
        <ul>
          <li><strong>Proportional Margins:</strong> The inner gutter margin must provide ample breathing room for binding or digital navigation bars.</li>
          <li><strong>Vertical Rhythm:</strong> Headings, blockquotes, and lists should snap to an intuitive vertical grid.</li>
          <li><strong>Contrast and Legibility:</strong> High contrast between ink and paper ensures long reading sessions without eye fatigue.</li>
        </ul>
      `,
    },
    {
      id: 'ch2',
      title: 'Chapter 2: Digital Sovereignty & In-House Architecture',
      contentHtml: `
        <h1>Chapter 2: Digital Sovereignty & In-House Architecture</h1>
        <p>In an era of ubiquitous cloud processing, our personal libraries and documents are frequently uploaded to third-party servers. True document sovereignty requires tools that execute completely within the client's local environment.</p>

        <h2>Zero-Knowledge Parsing</h2>
        <p>By leveraging native browser primitives such as <code>Web Streams</code>, <code>DecompressionStream</code>, and pure vector rendering, documents can be disassembled and reconstructed without transmitting a single byte over the public internet.</p>

        <p>Below is an overview of privacy-preserving document conversions:</p>

        <table border="1" cellpadding="8" style="width: 100%; border-collapse: collapse; margin: 1.5em 0;">
          <thead>
            <tr style="background: #f4f4f5;">
              <th style="text-align: left;">Pipeline Component</th>
              <th style="text-align: left;">Technology</th>
              <th style="text-align: left;">Security Level</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>ZIP Extraction</strong></td>
              <td>In-house RFC 1951 Deflate</td>
              <td>100% In-Browser</td>
            </tr>
            <tr>
              <td><strong>XHTML Parsing</strong></td>
              <td>Native DOMParser</td>
              <td>Zero Network Calls</td>
            </tr>
            <tr>
              <td><strong>PDF Assembly</strong></td>
              <td>Standard PDF Vector Stream</td>
              <td>Cryptographically Isolated</td>
            </tr>
          </tbody>
        </table>

        <p>When you transform an e-book into a PDF on Docuzy, your literature remains exclusively on your device, ensuring maximum confidentiality and uninhibited creative freedom.</p>
      `,
    },
    {
      id: 'ch3',
      title: 'Chapter 3: The Enduring Charm of the Printed Page',
      contentHtml: `
        <h1>Chapter 3: The Enduring Charm of the Printed Page</h1>
        <p>While digital e-readers offer convenience and infinite shelf space, the paginated PDF provides a permanent, immutable record. Whether printed on archival paper or annotated on a high-resolution tablet, a carefully formatted book stands as a testament to the author's vision.</p>
        <p>With custom running headers, numbered folios, and elegant chapter dividers, converting an e-book to PDF bridges the tactile tradition of classic Gutenberg printing with modern electronic distribution.</p>
      `,
    },
  ]

  const zipBytes = await createEpub(metadata, chapters, { theme: 'classic' })
  return {
    data: zipBytes,
    fileName: 'the-architecture-of-modern-typography.epub',
  }
}
