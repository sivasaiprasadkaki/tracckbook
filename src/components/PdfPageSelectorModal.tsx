import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, FileText, Loader2, AlertCircle, CheckSquare, Square, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}

interface PdfPageSelectorModalProps {
  isOpen: boolean;
  file: File | null;
  onClose: () => void;
  onPagesSelected: (pageFiles: File[]) => void;
  maxAllowed: number;
  theme: string;
}

interface PagePreview {
  pageNum: number;
  dataUrl: string;
  width: number;
  height: number;
}

export default function PdfPageSelectorModal({
  isOpen,
  file,
  onClose,
  onPagesSelected,
  maxAllowed = 6,
  theme
}: PdfPageSelectorModalProps) {
  const [totalPages, setTotalPages] = useState<number>(0);
  const [pagePreviews, setPagePreviews] = useState<PagePreview[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [previewZoomPage, setPreviewZoomPage] = useState<PagePreview | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [highResDataUrl, setHighResDataUrl] = useState<string | null>(null);
  const [isHighResLoading, setIsHighResLoading] = useState(false);

  const pdfDocRef = useRef<any>(null);
  const cancelLoadingRef = useRef<boolean>(false);

  // Format file size
  const formattedFileSize = file ? (
    file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${Math.round(file.size / 1024)} KB`
  ) : '';

  useEffect(() => {
    if (!isOpen || !file) {
      // Clean up previous state
      setPagePreviews([]);
      setSelectedPages(new Set());
      setTotalPages(0);
      setError(null);
      setIsLoading(false);
      setIsConverting(false);
      setPreviewZoomPage(null);
      cancelLoadingRef.current = true;
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch (e) {}
        pdfDocRef.current = null;
      }
      return;
    }

    cancelLoadingRef.current = false;
    let isCancelled = false;

    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);
      setPagePreviews([]);
      setSelectedPages(new Set());
      setLoadingProgress('Reading PDF file...');

      let blobUrl: string | null = null;
      try {
        setLoadingProgress('Reading PDF file stream...');
        blobUrl = URL.createObjectURL(file);
        if (isCancelled || cancelLoadingRef.current) return;

        setLoadingProgress('Initializing PDF engine...');
        const loadingTask = pdfjsLib.getDocument({
          url: blobUrl,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true,
          disableAutoFetch: false,
          disableStream: false,
        });

        const doc = await loadingTask.promise;
        if (isCancelled || cancelLoadingRef.current) {
          doc.destroy();
          return;
        }

        pdfDocRef.current = doc;
        const numPages = doc.numPages;
        setTotalPages(numPages);

        // Auto select page 1 by default if valid
        setSelectedPages(new Set([1]));

        // Generate thumbnails progressively
        const previews: PagePreview[] = [];
        for (let i = 1; i <= numPages; i++) {
          if (isCancelled || cancelLoadingRef.current) break;
          setLoadingProgress(`Rendering page ${i} of ${numPages}...`);

          try {
            const page = await doc.getPage(i);
            // Thumbnail scale: 0.5 to 0.7 for fast preview rendering
            const unscaledViewport = page.getViewport({ scale: 1 });
            const targetWidth = 240;
            const scale = targetWidth / unscaledViewport.width;
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            const ctx = canvas.getContext('2d', { alpha: false });

            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              await page.render({
                canvasContext: ctx,
                viewport
              }).promise;

              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              previews.push({
                pageNum: i,
                dataUrl,
                width: canvas.width,
                height: canvas.height
              });
              setPagePreviews([...previews]);
            }
          } catch (pageErr) {
            console.warn(`[PDF] Error rendering page ${i}:`, pageErr);
          }
        }

        setIsLoading(false);
        setLoadingProgress('');
      } catch (err: any) {
        console.error('[PDF] Failed to load PDF:', err);
        if (!isCancelled && !cancelLoadingRef.current) {
          setError(err.message || 'Failed to read PDF. The file may be password protected or corrupted.');
          setIsLoading(false);
        }
      } finally {
        if (blobUrl) {
          try {
            URL.revokeObjectURL(blobUrl);
          } catch (e) {}
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
      cancelLoadingRef.current = true;
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch (e) {}
        pdfDocRef.current = null;
      }
    };
  }, [isOpen, file]);

  // High-res rendering when previewing/zooming a page
  useEffect(() => {
    if (!previewZoomPage || !pdfDocRef.current) {
      setHighResDataUrl(null);
      setIsHighResLoading(false);
      return;
    }

    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    let isMounted = true;

    const renderHighRes = async () => {
      setIsHighResLoading(true);
      try {
        const page = await pdfDocRef.current.getPage(previewZoomPage.pageNum);
        if (!isMounted) return;
        const unscaledViewport = page.getViewport({ scale: 1 });
        const targetWidth = Math.min(2400, Math.max(1600, window.innerWidth * 1.5));
        const scale = Math.max(1.5, targetWidth / unscaledViewport.width);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (isMounted) {
            setHighResDataUrl(canvas.toDataURL('image/jpeg', 0.92));
          }
        }
      } catch (err) {
        console.warn('[PDF Zoom] Failed high res render:', err);
      } finally {
        if (isMounted) setIsHighResLoading(false);
      }
    };

    renderHighRes();
    return () => { isMounted = false; };
  }, [previewZoomPage]);

  // Keyboard navigation when zoom modal is open
  useEffect(() => {
    if (!previewZoomPage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPreviewZoomPage(null);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPreviewZoomPage(prev => {
          if (!prev) return null;
          const prevPageNum = prev.pageNum > 1 ? prev.pageNum - 1 : totalPages;
          const found = pagePreviews.find(p => p.pageNum === prevPageNum);
          return found || prev;
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPreviewZoomPage(prev => {
          if (!prev) return null;
          const nextPageNum = prev.pageNum < totalPages ? prev.pageNum + 1 : 1;
          const found = pagePreviews.find(p => p.pageNum === nextPageNum);
          return found || prev;
        });
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoomLevel(z => Math.min(4, z + 0.25));
      } else if (e.key === '-') {
        e.preventDefault();
        setZoomLevel(z => Math.max(0.75, z - 0.25));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewZoomPage, totalPages, pagePreviews]);

  const togglePageSelection = (pageNum: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageNum)) {
        next.delete(pageNum);
      } else {
        if (next.size >= maxAllowed) {
          return prev; // Reached maximum allowed images
        }
        next.add(pageNum);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const all = new Set<number>();
    const limit = Math.min(totalPages, maxAllowed);
    for (let i = 1; i <= limit; i++) {
      all.add(i);
    }
    setSelectedPages(all);
  };

  const handleDeselectAll = () => {
    setSelectedPages(new Set());
  };

  const handleConfirmImport = async () => {
    if (!pdfDocRef.current || selectedPages.size === 0 || !file) return;
    setIsConverting(true);

    try {
      const doc = pdfDocRef.current;
      const sortedPages = Array.from(selectedPages).sort((a, b) => a - b);
      const generatedFiles: File[] = [];

      const baseName = file.name.replace(/\.pdf$/i, '').trim() || 'document';

      for (let idx = 0; idx < sortedPages.length; idx++) {
        const pageNum = sortedPages[idx];
        const page = await doc.getPage(pageNum);

        // High resolution scale (1.5x - 2.0x) so receipt details, numbers & text are crystal clear
        const unscaledViewport = page.getViewport({ scale: 1 });
        const targetWidth = 1400; // Sharp receipt width
        const scale = Math.min(2.0, Math.max(1.2, targetWidth / unscaledViewport.width));
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d', { alpha: false });

        if (!ctx) continue;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: ctx,
          viewport
        }).promise;

        const blob = await new Promise<Blob | null>(resolve => {
          canvas.toBlob(resolve, 'image/jpeg', 0.85);
        });

        if (blob) {
          const imageFile = new File([blob], `${baseName}_p${pageNum}.jpg`, { type: 'image/jpeg' });
          generatedFiles.push(imageFile);
        }
      }

      onPagesSelected(generatedFiles);
      onClose();
    } catch (err: any) {
      console.error('[PDF Convert] Error converting pages to images:', err);
      setError(err.message || 'Failed to extract selected pages into images.');
    } finally {
      setIsConverting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-5 backdrop-blur-md bg-black/70 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className={cn(
            "w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl border transition-colors overflow-hidden",
            theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-800"
          )}
        >
          {/* Header */}
          <div className={cn(
            "p-4 sm:p-5 border-b flex items-center justify-between shrink-0",
            theme === 'dark' ? "border-zinc-800 bg-zinc-900/60" : "border-slate-100 bg-slate-50/80"
          )}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-500/20">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold truncate">
                    {file?.name || 'PDF Document'}
                  </h3>
                  {formattedFileSize && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 shrink-0">
                      {formattedFileSize}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select the pages you want to import as images (Remaining pages are discarded)
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isConverting}
              className="p-2 hover:bg-slate-200/50 dark:hover:bg-zinc-800 rounded-full transition-colors cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={20} />
            </button>
          </div>

          {/* Quick Action Toolbar */}
          <div className={cn(
            "px-4 sm:px-6 py-2.5 border-b flex items-center justify-between text-xs shrink-0 flex-wrap gap-2",
            theme === 'dark' ? "border-zinc-800/80 bg-zinc-900/30 text-slate-300" : "border-slate-100 bg-slate-50/40 text-slate-600"
          )}>
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                Pages: <strong className="text-indigo-600 dark:text-indigo-400">{totalPages || '...'}</strong>
              </span>
              <span>•</span>
              <span className="font-semibold">
                Selected: <strong className={cn(selectedPages.size > 0 ? "text-emerald-600 dark:text-emerald-400" : "")}>{selectedPages.size}</strong> / {maxAllowed} max
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={isLoading || totalPages === 0 || isConverting}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                <CheckSquare size={13} />
                <span>Select All ({Math.min(totalPages, maxAllowed)})</span>
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                disabled={isLoading || selectedPages.size === 0 || isConverting}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                <Square size={13} />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-[300px] relative">
            {error && (
              <div className="mb-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-start gap-3">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold">Error loading PDF</p>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {isLoading && pagePreviews.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
                <Loader2 size={36} className="animate-spin text-indigo-500" />
                <p className="text-sm font-bold">{loadingProgress || 'Processing PDF...'}</p>
                <p className="text-xs text-slate-400 max-w-sm">
                  Handling large PDF files smoothly. Previews will appear as each page renders.
                </p>
              </div>
            )}

            {/* Grid of Pages */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {pagePreviews.map((preview) => {
                const isSelected = selectedPages.has(preview.pageNum);
                return (
                  <div
                    key={preview.pageNum}
                    onClick={() => !isConverting && togglePageSelection(preview.pageNum)}
                    className={cn(
                      "group relative rounded-2xl border-2 transition-all overflow-hidden flex flex-col cursor-pointer select-none bg-white dark:bg-zinc-900 shadow-sm",
                      isSelected
                        ? "border-indigo-600 ring-2 ring-indigo-500/40 shadow-indigo-500/10"
                        : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
                    )}
                  >
                    {/* Page Thumbnail */}
                    <div className="relative aspect-[3/4] bg-slate-50 dark:bg-zinc-950 flex items-center justify-center overflow-hidden border-b border-slate-100 dark:border-zinc-800">
                      <img
                        src={preview.dataUrl}
                        alt={`Page ${preview.pageNum}`}
                        className="w-full h-full object-contain pointer-events-none"
                      />

                      {/* Selection Checkbox Badge */}
                      <div className="absolute top-2 right-2 z-10">
                        <div className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center transition-all shadow-md",
                          isSelected
                            ? "bg-indigo-600 text-white"
                            : "bg-black/50 text-white/70 hover:bg-black/70"
                        )}>
                          {isSelected ? <Check size={14} strokeWidth={3} /> : null}
                        </div>
                      </div>

                      {/* Zoom Preview Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewZoomPage(preview);
                        }}
                        className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        title="Zoom in page"
                      >
                        <ZoomIn size={14} />
                      </button>
                    </div>

                    {/* Page Footer Label */}
                    <div className="p-2 px-3 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        Page {preview.pageNum}
                      </span>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"
                      )}>
                        {isSelected ? "Selected" : "Tap to add"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Incremental loading notice */}
            {isLoading && pagePreviews.length > 0 && (
              <div className="mt-4 p-3 rounded-xl bg-slate-100/70 dark:bg-zinc-900/70 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 size={14} className="animate-spin text-indigo-500" />
                <span>{loadingProgress} You can already select rendered pages above!</span>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className={cn(
            "p-4 sm:p-5 border-t flex items-center justify-between gap-3 shrink-0",
            theme === 'dark' ? "border-zinc-800 bg-zinc-900/60" : "border-slate-100 bg-slate-50/80"
          )}>
            <button
              type="button"
              onClick={onClose}
              disabled={isConverting}
              className={cn(
                "py-3 px-5 border rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer",
                theme === 'dark'
                  ? "border-zinc-800 text-slate-300 hover:bg-zinc-900"
                  : "border-slate-200 text-slate-700 hover:bg-slate-100"
              )}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={selectedPages.size === 0 || isConverting}
              className={cn(
                "py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95 cursor-pointer flex items-center gap-2",
                (selectedPages.size === 0 || isConverting) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isConverting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Converting {selectedPages.size} {selectedPages.size === 1 ? 'Page' : 'Pages'} to Images...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Import {selectedPages.size} {selectedPages.size === 1 ? 'Page' : 'Pages'} as Images</span>
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Clean Fullscreen Page Zoom Modal (Only Image with Interactive Zoom & Navigation) */}
        {previewZoomPage && (
          <div 
            onClick={() => setPreviewZoomPage(null)}
            className="fixed inset-0 z-[350] bg-black/95 backdrop-blur-xl flex flex-col justify-between overflow-hidden select-none"
          >
            {/* Top Toolbar */}
            <div 
              className="p-4 sm:p-5 flex items-center justify-between text-white shrink-0 z-20 bg-gradient-to-b from-black/80 to-transparent"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm sm:text-base tracking-wide text-white">
                  Page {previewZoomPage.pageNum} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => togglePageSelection(previewZoomPage.pageNum)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm",
                    selectedPages.has(previewZoomPage.pageNum)
                      ? "bg-indigo-600 text-white"
                      : "bg-white/15 text-white/80 hover:bg-white/25"
                  )}
                >
                  <Check size={13} className={cn(!selectedPages.has(previewZoomPage.pageNum) && "opacity-0")} />
                  <span>{selectedPages.has(previewZoomPage.pageNum) ? 'Selected for Import' : 'Tap to Select'}</span>
                </button>
              </div>

              {/* Zoom & Action Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.max(0.75, prev - 0.25))}
                  className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="Zoom Out (-)"
                >
                  <ZoomOut size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
                  className="px-2.5 py-1 text-xs font-mono rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer font-bold"
                  title="Reset Zoom (0)"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.min(4, prev + 0.25))}
                  className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="Zoom In (+)"
                >
                  <ZoomIn size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoomPage(null)}
                  className="p-2 sm:p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors ml-2 cursor-pointer"
                  title="Close (Esc)"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Main Interactive Zoom Canvas Area */}
            <div 
              className="flex-1 relative w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing p-2"
              onClick={e => e.stopPropagation()}
              onWheel={(e) => {
                e.preventDefault();
                setZoomLevel(prev => Math.min(4, Math.max(0.75, prev + (e.deltaY < 0 ? 0.2 : -0.2))));
              }}
              onMouseDown={(e) => {
                setIsPanning(true);
                setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
              }}
              onMouseMove={(e) => {
                if (!isPanning) return;
                setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
              }}
              onMouseUp={() => setIsPanning(false)}
              onMouseLeave={() => setIsPanning(false)}
            >
              {isHighResLoading && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/60 text-white text-[11px] font-medium flex items-center gap-1.5 backdrop-blur-md">
                  <Loader2 size={12} className="animate-spin text-indigo-400" />
                  <span>Enhancing resolution...</span>
                </div>
              )}

              <img
                src={highResDataUrl || previewZoomPage.dataUrl}
                alt={`Page ${previewZoomPage.pageNum}`}
                style={{
                  transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                  transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                  maxHeight: '88vh',
                  maxWidth: '92vw',
                }}
                className="object-contain shadow-2xl rounded-md pointer-events-none select-none"
                draggable={false}
              />

              {/* Navigation Arrows */}
              {totalPages > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const prevPageNum = previewZoomPage.pageNum > 1 ? previewZoomPage.pageNum - 1 : totalPages;
                      const found = pagePreviews.find(p => p.pageNum === prevPageNum);
                      if (found) setPreviewZoomPage(found);
                    }}
                    className="absolute left-4 p-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all cursor-pointer z-10"
                    title="Previous Page (Left Arrow)"
                  >
                    <ChevronLeft size={28} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const nextPageNum = previewZoomPage.pageNum < totalPages ? previewZoomPage.pageNum + 1 : 1;
                      const found = pagePreviews.find(p => p.pageNum === nextPageNum);
                      if (found) setPreviewZoomPage(found);
                    }}
                    className="absolute right-4 p-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all cursor-pointer z-10"
                    title="Next Page (Right Arrow)"
                  >
                    <ChevronRight size={28} />
                  </button>
                </>
              )}
            </div>

            {/* Bottom Floating Info / Hint */}
            <div 
              className="p-3 text-center text-white/50 text-[11px] shrink-0 z-20 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"
            >
              <span>Mouse wheel or +/- to zoom • Drag to pan • Left/Right arrow keys to switch page</span>
            </div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
