'use client';

import { useState, useRef } from 'react';
import {
  FileUp,
  Presentation,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Plus,
  Sliders,
  Palette,
  FileText,
} from 'lucide-react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readZip } from '@/lib/zip/zip-native';

interface SlideItem {
  id: string;
  title: string;
  bullets: string[];
}

const THEMES = [
  { id: 'indigo', name: 'Docuzy Indigo', bg: [0.98, 0.98, 1.0], accent: [0.31, 0.27, 0.9], text: [0.1, 0.1, 0.15], cardBg: 'bg-indigo-50/50' },
  { id: 'slate', name: 'Classic Slate', bg: [0.97, 0.98, 0.99], accent: [0.2, 0.3, 0.45], text: [0.12, 0.15, 0.2], cardBg: 'bg-slate-50' },
  { id: 'dark', name: 'Executive Dark', bg: [0.1, 0.12, 0.16], accent: [0.38, 0.65, 0.98], text: [0.95, 0.95, 0.98], cardBg: 'bg-zinc-800' },
  { id: 'clean', name: 'Pure Minimal', bg: [1.0, 1.0, 1.0], accent: [0.1, 0.1, 0.1], text: [0.15, 0.15, 0.15], cardBg: 'bg-white' },
];

export default function PptToPdfWidget() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState('indigo');
  const [resultBlobUrl, setResultBlobUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsePptxXml = (xmlStr: string): { title: string; bullets: string[] } => {
    // Extract text elements: <a:t>...</a:t>
    const matches: string[] = [];
    const regex = /<a:t[^>]*>([^<]+)<\/a:t>/g;
    let match;
    while ((match = regex.exec(xmlStr)) !== null) {
      const text = match[1].trim();
      if (text) matches.push(text);
    }

    if (matches.length === 0) {
      return { title: 'Untitled Slide', bullets: ['(Empty slide)'] };
    }

    const title = matches[0];
    const bullets = matches.slice(1);
    return {
      title,
      bullets: bullets.length > 0 ? bullets : ['[Slide body]'],
    };
  };

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setResultBlobUrl(null);
    setIsProcessing(true);
    setStatusText('Inspecting presentation file...');

    const fileName = selectedFile.name.toLowerCase();

    try {
      if (fileName.endsWith('.pptx')) {
        setStatusText('Unpacking PowerPoint OpenXML structure...');
        const buffer = await selectedFile.arrayBuffer();
        const entries = await readZip(new Uint8Array(buffer));

        // Find slide entries: ppt/slides/slide*.xml
        const slideEntries = entries.filter((e) =>
          /^ppt\/slides\/slide\d+\.xml$/i.test(e.name)
        );

        if (slideEntries.length === 0) {
          throw new Error('No slide files found inside PowerPoint package.');
        }

        // Sort by slide index
        slideEntries.sort((a, b) => {
          const numA = parseInt(a.name.match(/\d+/)![0], 10);
          const numB = parseInt(b.name.match(/\d+/)![0], 10);
          return numA - numB;
        });

        const decoder = new TextDecoder();
        const parsedSlides: SlideItem[] = slideEntries.map((entry, idx) => {
          const xml = decoder.decode(entry.data);
          const { title, bullets } = parsePptxXml(xml);
          return {
            id: `slide-${idx + 1}`,
            title: title || `Slide ${idx + 1}`,
            bullets,
          };
        });

        setSlides(parsedSlides);
        setActiveSlideIdx(0);
      } else {
        // Plain text or Markdown outline
        setStatusText('Parsing slide outline text...');
        const text = await selectedFile.text();
        const sections = text.split(/(?:^|\n)(?:---|===|\*\*\*)\s*(?:\n|$)/);

        const parsedSlides: SlideItem[] = sections
          .filter((s) => s.trim().length > 0)
          .map((sec, idx) => {
            const lines = sec
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l.length > 0);
            const titleLine = lines[0] || `Slide ${idx + 1}`;
            const cleanTitle = titleLine.replace(/^#+\s*/, '');
            const bulletLines = lines
              .slice(1)
              .map((l) => l.replace(/^[-*•]\s*/, ''));

            return {
              id: `slide-${idx + 1}`,
              title: cleanTitle,
              bullets: bulletLines.length > 0 ? bulletLines : ['[Slide body]'],
            };
          });

        if (parsedSlides.length === 0) {
          setSlides([
            {
              id: 'slide-1',
              title: 'Presentation Slide',
              bullets: ['Key takeaway 1', 'Key takeaway 2'],
            },
          ]);
        } else {
          setSlides(parsedSlides);
        }
        setActiveSlideIdx(0);
      }
      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to read presentation file.');
      setIsProcessing(false);
    }
  };

  const handleLoadSampleDeck = () => {
    setFile(new File(['Sample'], 'Quarterly-Review-Sample.pptx'));
    setSlides([
      {
        id: 's1',
        title: 'Docuzy Product Growth Review',
        bullets: [
          'High performance, client-side PDF document processing suite',
          'Zero third-party supply chain risks with in-house native cryptography',
          'Complete coverage of 24+ professional document tools',
        ],
      },
      {
        id: 's2',
        title: 'Key Operational Milestones',
        bullets: [
          'Implemented genuine OpenXML engines for Word, Excel, and PowerPoint',
          'Instant sub-second conversion running entirely in user browsers',
          'Full privacy assurance: zero telemetry, zero cloud file storage',
        ],
      },
      {
        id: 's3',
        title: 'Strategic Roadmap Ahead',
        bullets: [
          'Expansion of OCR capabilities with multi-language layout recognition',
          'Extended batch conversion for enterprise document workflows',
          'Global release ready for high-throughput client environments',
        ],
      },
    ]);
    setActiveSlideIdx(0);
    setError(null);
  };

  const handleUpdateTitle = (newTitle: string) => {
    setSlides((prev) =>
      prev.map((s, idx) => (idx === activeSlideIdx ? { ...s, title: newTitle } : s))
    );
  };

  const handleUpdateBullet = (bulletIdx: number, newText: string) => {
    setSlides((prev) =>
      prev.map((s, idx) => {
        if (idx !== activeSlideIdx) return s;
        const newBullets = [...s.bullets];
        newBullets[bulletIdx] = newText;
        return { ...s, bullets: newBullets };
      })
    );
  };

  const handleAddBullet = () => {
    setSlides((prev) =>
      prev.map((s, idx) => {
        if (idx !== activeSlideIdx) return s;
        return { ...s, bullets: [...s.bullets, 'New bullet takeaway'] };
      })
    );
  };

  const handleDeleteBullet = (bulletIdx: number) => {
    setSlides((prev) =>
      prev.map((s, idx) => {
        if (idx !== activeSlideIdx) return s;
        return { ...s, bullets: s.bullets.filter((_, i) => i !== bulletIdx) };
      })
    );
  };

  const handleAddSlide = () => {
    const newSlide: SlideItem = {
      id: `slide-${Date.now()}`,
      title: 'New Slide Title',
      bullets: ['Key takeaway', 'Supporting information'],
    };
    setSlides((prev) => [...prev, newSlide]);
    setActiveSlideIdx(slides.length);
  };

  const handleDeleteSlide = (idxToDelete: number) => {
    if (slides.length <= 1) return;
    setSlides((prev) => prev.filter((_, idx) => idx !== idxToDelete));
    if (activeSlideIdx >= idxToDelete && activeSlideIdx > 0) {
      setActiveSlideIdx((prev) => prev - 1);
    }
  };

  const handleConvertToPdf = async () => {
    if (slides.length === 0) return;
    setIsProcessing(true);
    setStatusText('Rendering presentation PDF with vector typography...');

    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const theme = THEMES.find((t) => t.id === selectedTheme) || THEMES[0];
      const [bgR, bgG, bgB] = theme.bg;
      const [accR, accG, accB] = theme.accent;
      const [txR, txG, txB] = theme.text;

      // 16:9 Widescreen slide dimensions in points: 842 x 474 pt
      const slideWidth = 842;
      const slideHeight = 474;

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        const page = pdfDoc.addPage([slideWidth, slideHeight]);

        // Background
        page.drawRectangle({
          x: 0,
          y: 0,
          width: slideWidth,
          height: slideHeight,
          color: rgb(bgR, bgG, bgB),
        });

        // Top accent bar
        page.drawRectangle({
          x: 0,
          y: slideHeight - 6,
          width: slideWidth,
          height: 6,
          color: rgb(accR, accG, accB),
        });

        // Slide Title Box
        page.drawText(slide.title, {
          x: 54,
          y: slideHeight - 70,
          size: 26,
          font: fontBold,
          color: rgb(txR, txG, txB),
        });

        // Title underline accent line
        page.drawLine({
          start: { x: 54, y: slideHeight - 84 },
          end: { x: 180, y: slideHeight - 84 },
          thickness: 3,
          color: rgb(accR, accG, accB),
        });

        // Bullet points
        let currentY = slideHeight - 140;
        const bulletSize = 14;
        const lineHeight = 26;

        for (const bullet of slide.bullets) {
          if (currentY < 60) break; // Don't overflow bottom

          // Bullet dot
          page.drawCircle({
            x: 62,
            y: currentY + 4,
            size: 3.5,
            color: rgb(accR, accG, accB),
          });

          // Text with basic word wrapping
          const words = bullet.split(' ');
          let line = '';
          const maxLineWidth = slideWidth - 140;

          for (const word of words) {
            const testLine = line ? `${line} ${word}` : word;
            const testWidth = font.widthOfTextAtSize(testLine, bulletSize);
            if (testWidth > maxLineWidth) {
              page.drawText(line, {
                x: 78,
                y: currentY,
                size: bulletSize,
                font,
                color: rgb(txR, txG, txB),
              });
              currentY -= lineHeight;
              line = word;
            } else {
              line = testLine;
            }
          }
          if (line) {
            page.drawText(line, {
              x: 78,
              y: currentY,
              size: bulletSize,
              font,
              color: rgb(txR, txG, txB),
            });
            currentY -= lineHeight + 8;
          }
        }

        // Footer: Slide number & Docuzy branding
        const footerText = `Slide ${i + 1} of ${slides.length}`;
        page.drawText(footerText, {
          x: slideWidth - 120,
          y: 28,
          size: 10,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });

        page.drawText('Docuzy Presentation Suite', {
          x: 54,
          y: 28,
          size: 10,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      setResultBlobUrl(URL.createObjectURL(blob));
      setResultSize(blob.size);
      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to generate presentation PDF.');
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setSlides([]);
    setActiveSlideIdx(0);
    setResultBlobUrl(null);
    setResultSize(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const activeSlide = slides[activeSlideIdx];

  return (
    <div className="space-y-6">
      {/* Upload Dropzone */}
      {!file && slides.length === 0 && (
        <div className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-300 hover:border-indigo-500 rounded-2xl p-12 text-center cursor-pointer transition-colors bg-white shadow-sm"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pptx,.txt,.md"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
              className="hidden"
            />
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Presentation className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 mb-1">
              Upload PowerPoint (.pptx) or Slide Outline
            </h3>
            <p className="text-sm text-zinc-500 max-w-md mx-auto">
              Converts presentation decks into crisp, high-resolution widescreen PDF slides with vector typography.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3">
            <span className="text-xs text-zinc-400">or try an example:</span>
            <button
              onClick={handleLoadSampleDeck}
              className="text-xs font-medium text-indigo-600 hover:underline inline-flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              Load Sample 3-Slide Deck
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isProcessing && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center space-y-4 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
          <div>
            <p className="font-medium text-zinc-900">{statusText}</p>
            <p className="text-xs text-zinc-500 mt-1">
              Rendering locally in your browser. Complete privacy assured.
            </p>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            <p className="font-medium">Conversion error</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Deck Studio */}
      {slides.length > 0 && !isProcessing && !resultBlobUrl && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-zinc-200 p-4 rounded-xl shadow-sm">
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                {file?.name || 'Presentation Deck'}
              </p>
              <p className="text-xs text-zinc-500">
                {slides.length} slides • 16:9 Widescreen HD format
              </p>
            </div>

            {/* Theme Picker */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 hidden sm:inline">Theme:</span>
              <div className="flex items-center gap-1">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTheme(t.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                      selectedTheme === t.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold'
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAddSlide}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Slide
              </button>
              <button
                onClick={handleConvertToPdf}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                Render PDF Slides
              </button>
            </div>
          </div>

          {/* Slide Deck Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Slide Navigation List */}
            <div className="md:col-span-4 space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {slides.map((s, idx) => (
                <div
                  key={s.id}
                  onClick={() => setActiveSlideIdx(idx)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start justify-between gap-2 ${
                    activeSlideIdx === idx
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="text-[10px] font-semibold tracking-wider uppercase text-zinc-400">
                      Slide {idx + 1}
                    </span>
                    <p className="text-xs font-semibold text-zinc-900 truncate mt-0.5">
                      {s.title || '(Untitled Slide)'}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {s.bullets.length} bullet {s.bullets.length === 1 ? 'point' : 'points'}
                    </p>
                  </div>
                  {slides.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSlide(idx);
                      }}
                      className="text-zinc-400 hover:text-red-500 p-1"
                      title="Delete slide"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Slide Detail Editor */}
            {activeSlide && (
              <div className="md:col-span-8 bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Slide {activeSlideIdx + 1} Title
                  </label>
                  <input
                    type="text"
                    value={activeSlide.title}
                    onChange={(e) => handleUpdateTitle(e.target.value)}
                    className="w-full px-3.5 py-2 text-base font-bold bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter slide title..."
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Slide Bullets & Takeaways ({activeSlide.bullets.length})
                    </label>
                    <button
                      onClick={handleAddBullet}
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add bullet point
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {activeSlide.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} className="flex items-start gap-2">
                        <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                        <textarea
                          rows={2}
                          value={bullet}
                          onChange={(e) => handleUpdateBullet(bIdx, e.target.value)}
                          className="flex-1 p-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          onClick={() => handleDeleteBullet(bIdx)}
                          className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg"
                          title="Remove bullet"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Download Result View */}
      {resultBlobUrl && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center space-y-6 shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-zinc-900">
              Presentation PDF Ready
            </h3>
            <p className="text-sm text-zinc-500 mt-1">
              Crisp 16:9 widescreen presentation PDF compiled with vector typography.
            </p>
            {resultSize && (
              <span className="inline-block mt-2 px-3 py-1 bg-zinc-100 text-zinc-600 text-xs rounded-full">
                {(resultSize / 1024).toFixed(1)} KB • {slides.length} slides
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={resultBlobUrl}
              download={file ? file.name.replace(/\.[^/.]+$/, '') + '.pdf' : 'presentation.pdf'}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Presentation PDF
            </a>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-xl hover:bg-zinc-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Convert Another Presentation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
