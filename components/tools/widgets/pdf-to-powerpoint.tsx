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
  Eye,
  Sliders,
} from 'lucide-react';
import { createPptx, PptxSlide } from '@/lib/office/openxml-native';

interface ParsedSlide extends PptxSlide {
  id: string;
  pageNumber: number;
}

export default function PdfToPowerPointWidget() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [slides, setSlides] = useState<ParsedSlide[]>([]);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [resultBlobUrl, setResultBlobUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF file.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResultBlobUrl(null);
    setIsProcessing(true);
    setStatusText('Loading PDF engine...');

    try {
      const pdfjs = await import('pdfjs-dist');
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      }

      setStatusText('Reading document pages...');
      const buffer = await selectedFile.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;

      const extractedSlides: ParsedSlide[] = [];

      for (let i = 1; i <= numPages; i++) {
        setStatusText(`Analyzing slide content for page ${i} of ${numPages}...`);
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();

        // Sort items vertically (top to bottom), then horizontally (left to right)
        const items = (textContent.items as any[])
          .filter((item) => item.str && item.str.trim().length > 0)
          .map((item) => {
            const tx = item.transform; // [scaleX, skewY, skewX, scaleY, transX, transY]
            const y = tx[5];
            const x = tx[4];
            const fontSize = Math.hypot(tx[0], tx[1]);
            return {
              text: item.str.trim(),
              y,
              x,
              fontSize,
            };
          });

        if (items.length === 0) {
          extractedSlides.push({
            id: `slide-${i}`,
            pageNumber: i,
            title: `Slide ${i}`,
            bullets: ['(Blank page or scanned artwork)'],
          });
          continue;
        }

        // Group into lines by similar y-coordinate (within 6px)
        items.sort((a, b) => b.y - a.y || a.x - b.x);

        const lines: { text: string; fontSize: number }[] = [];
        let currentLine = '';
        let currentY = items[0].y;
        let maxFontSize = items[0].fontSize;

        for (const item of items) {
          if (Math.abs(item.y - currentY) > 6) {
            if (currentLine.trim()) {
              lines.push({ text: currentLine.trim(), fontSize: maxFontSize });
            }
            currentLine = item.text;
            currentY = item.y;
            maxFontSize = item.fontSize;
          } else {
            currentLine += (currentLine ? ' ' : '') + item.text;
            maxFontSize = Math.max(maxFontSize, item.fontSize);
          }
        }
        if (currentLine.trim()) {
          lines.push({ text: currentLine.trim(), fontSize: maxFontSize });
        }

        // Find candidate for title: highest line with largest font size
        let titleIdx = 0;
        let largestSize = 0;
        for (let l = 0; l < Math.min(lines.length, 3); l++) {
          if (lines[l].fontSize > largestSize) {
            largestSize = lines[l].fontSize;
            titleIdx = l;
          }
        }

        const title = lines[titleIdx]?.text || `Slide ${i}`;
        const bulletLines = lines
          .filter((_, idx) => idx !== titleIdx)
          .map((l) => l.text.replace(/^[-•*–—\d+.]\s*/, ''));

        extractedSlides.push({
          id: `slide-${i}`,
          pageNumber: i,
          title,
          bullets: bulletLines.length > 0 ? bulletLines : ['[Slide body text]'],
        });
      }

      setSlides(extractedSlides);
      setActiveSlideIdx(0);
      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to parse PDF presentation.');
      setIsProcessing(false);
    }
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
        return { ...s, bullets: [...s.bullets, 'New bullet point'] };
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
    const newSlide: ParsedSlide = {
      id: `slide-${Date.now()}`,
      pageNumber: slides.length + 1,
      title: 'New Slide Title',
      bullets: ['Key takeaway or point', 'Supporting information'],
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

  const handleGeneratePptx = async () => {
    if (slides.length === 0) return;
    setIsProcessing(true);
    setStatusText('Packaging Microsoft PowerPoint (.pptx) deck...');

    try {
      const pptxBytes = await createPptx(
        slides.map((s) => ({
          title: s.title,
          bullets: s.bullets,
        }))
      );

      const blob = new Blob([pptxBytes as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
      setResultBlobUrl(URL.createObjectURL(blob));
      setResultSize(blob.size);
      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to generate PowerPoint deck.');
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
      {!file && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-300 hover:border-indigo-500 rounded-2xl p-12 text-center cursor-pointer transition-colors bg-white shadow-sm"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
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
            Upload PDF to convert to PowerPoint (.pptx)
          </h3>
          <p className="text-sm text-zinc-500 max-w-md mx-auto">
            Extracts slide titles and structured bullet points into genuine editable OpenXML slides.
          </p>
        </div>
      )}

      {/* Loading state */}
      {isProcessing && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center space-y-4 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
          <div>
            <p className="font-medium text-zinc-900">{statusText}</p>
            <p className="text-xs text-zinc-500 mt-1">
              Processing 100% locally in your browser. No files are uploaded to any server.
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

      {/* Slide Deck Studio */}
      {file && !isProcessing && slides.length > 0 && !resultBlobUrl && (
        <div className="space-y-6">
          {/* Deck Controls Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-zinc-200 p-4 rounded-xl shadow-sm">
            <div>
              <p className="text-sm font-semibold text-zinc-900">{file.name}</p>
              <p className="text-xs text-zinc-500">
                {slides.length} {slides.length === 1 ? 'slide' : 'slides'} parsed • Ready for PowerPoint export
              </p>
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
                onClick={handleGeneratePptx}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
              >
                <Presentation className="w-4 h-4" />
                Build PowerPoint (.pptx)
              </button>
            </div>
          </div>

          {/* Slide Deck Grid & Editor */}
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

            {/* Slide Canvas / Detail Editor */}
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
                      Slide Content & Bullet Points ({activeSlide.bullets.length})
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
              PowerPoint Deck Ready (.pptx)
            </h3>
            <p className="text-sm text-zinc-500 mt-1">
              Clean Microsoft PowerPoint presentation generated with genuine OpenXML slide structures.
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
              download={file ? file.name.replace(/\.[^/.]+$/, '') + '.pptx' : 'presentation.pptx'}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PowerPoint (.pptx)
            </a>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-xl hover:bg-zinc-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Convert Another PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
