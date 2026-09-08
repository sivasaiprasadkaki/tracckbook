import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Check,
  X,
  Loader2,
  AlertCircle,
  CheckSquare,
  Square,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Plus
} from 'lucide-react';
import { cn } from '../lib/utils';
import { pdfjsLib } from '../lib/pdfWorker';

export interface PdfPageSelectorModalProps {
  isOpen: boolean;
  file: File | null;
  currentCount: number;
  maxLimit?: number;
  theme: 'light' | 'dark';
  onClose: () => void;
  onAddPages: (files: File[]) => void;
}

interface PageItem {
  pageNum: number;
  thumbnail: string;
}

export default function PdfPageSelectorModal({
  isOpen,
  file,
  currentCount,
  maxLimit = 7,
  theme,
  onClose,
  onAddPages
}: PdfPageSelectorModalProps) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<string>('Reading PDF...');
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [conversionProgress, setConversionProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [limitWarning, setLimitWarning] = useState<string | null>(null);

  // Active page tracked in mobile page-by-page scroll view (1-indexed)
  const [activeMobilePage, setActiveMobilePage] = useState<number>(1);
  const mobileContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Full-screen image preview lightbox state
  const [previewPageNum, setPreviewPageNum] = useState<number | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [previewRotation, setPreviewRotation] = useState<number>(0);
  const previewTouchStartX = useRef<number | null>(null);
  const previewTouchStartY = useRef<number | null>(null);
  const previewTouchEndX = useRef<number | null>(null);

  const pdfDocRef = useRef<any>(null);
  const isCancelledRef = useRef<boolean>(false);

  const availableSlots = Math.max(0, maxLimit - currentCount);

  // Load PDF and render thumbnails when modal opens with a file
  useEffect(() => {
    if (!isOpen || !file) {
      setPages([]);
      setSelectedPages(new Set());
      setError(null);
      setLimitWarning(null);
      setIsLoading(false);
      setIsConverting(false);
      setPreviewPageNum(null);
      setActiveMobilePage(1);
      pdfDocRef.current = null;
      return;
    }

    isCancelledRef.current = false;
    setIsLoading(true);
    setError(null);
    setLimitWarning(null);
    setPreviewPageNum(null);
    setActiveMobilePage(1);
    setLoadingProgress('Reading PDF document...');

    let activePdf: any = null;

    async function loadPdf() {
      try {
        const arrayBuffer = await file!.arrayBuffer();
        if (isCancelledRef.current) return;

        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true,
        });

        activePdf = await loadingTask.promise;
        if (isCancelledRef.current) return;
        pdfDocRef.current = activePdf;

        const numPages = activePdf.numPages;
        setLoadingProgress(`Rendering ${numPages} page ${numPages === 1 ? 'thumbnail' : 'thumbnails'}...`);

        const renderedPages: PageItem[] = [];

        // Render thumbnails sequentially to manage memory
        for (let i = 1; i <= numPages; i++) {
          if (isCancelledRef.current) return;
          setLoadingProgress(`Rendering page ${i} of ${numPages}...`);

          const page = await activePdf.getPage(i);
          const initialViewport = page.getViewport({ scale: 1.0 });

          // Target thumbnail width around 320px for sharp display on mobile & desktop
          const scale = Math.min(1.2, Math.max(0.4, 320 / initialViewport.width));
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
            await page.render({
              canvasContext: context,
              viewport: viewport
            }).promise;

            const thumbnail = canvas.toDataURL('image/jpeg', 0.88);
            renderedPages.push({ pageNum: i, thumbnail });
          }
        }

        if (isCancelledRef.current) return;
        setPages(renderedPages);

        // All pages start unselected by default; user selects desired pages
        setSelectedPages(new Set());
        if (availableSlots <= 0) {
          setLimitWarning(`You already have ${currentCount} bills attached (maximum is ${maxLimit}). Remove an existing attachment to add more.`);
        }

        setIsLoading(false);
      } catch (err: any) {
        if (!isCancelledRef.current) {
          console.error('[PDF Load Error]', err);
          setError(err?.message || 'Failed to load PDF file. Please ensure it is a valid PDF document.');
          setIsLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isCancelledRef.current = true;
    };
  }, [isOpen, file, currentCount, availableSlots, maxLimit]);

  // Handle keyboard navigation for preview modal
  useEffect(() => {
    if (previewPageNum === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewPageNum(null);
      } else if (e.key === 'ArrowLeft') {
        setPreviewPageNum(prev => (prev && prev > 1 ? prev - 1 : prev));
        setPreviewZoom(1);
      } else if (e.key === 'ArrowRight') {
        setPreviewPageNum(prev => (prev && prev < pages.length ? prev + 1 : prev));
        setPreviewZoom(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewPageNum, pages.length]);

  const togglePageSelection = (pageNum: number) => {
    setLimitWarning(null);
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageNum)) {
        next.delete(pageNum);
      } else {
        if (currentCount + next.size >= maxLimit) {
          setLimitWarning(`Maximum ${maxLimit} total bills allowed. You currently have ${currentCount} existing attachments and ${next.size} pages selected.`);
          return prev;
        }
        next.add(pageNum);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setLimitWarning(null);
    if (pages.length === 0) return;

    if (currentCount >= maxLimit) {
      setLimitWarning(`Maximum ${maxLimit} total bills reached. You cannot select additional pages.`);
      return;
    }

    const maxCanSelect = Math.min(pages.length, availableSlots);
    const newSelected = new Set<number>();
    for (let i = 0; i < maxCanSelect; i++) {
      newSelected.add(pages[i].pageNum);
    }
    setSelectedPages(newSelected);

    if (pages.length > availableSlots) {
      setLimitWarning(`Selected first ${availableSlots} pages to stay within the ${maxLimit} total bill limit.`);
    }
  };

  const handleClearSelection = () => {
    setSelectedPages(new Set());
    setLimitWarning(null);
  };

  // Scroll to a specific page on mobile
  const scrollToMobilePage = (targetPageNum: number) => {
    if (targetPageNum < 1 || targetPageNum > pages.length) return;
    const targetEl = pageRefs.current[targetPageNum];
    if (targetEl && mobileContainerRef.current) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setActiveMobilePage(targetPageNum);
    }
  };

  // Monitor scrolling in mobile page-by-page view
  const handleMobileScroll = () => {
    const container = mobileContainerRef.current;
    if (!container || pages.length === 0) return;

    const containerRect = container.getBoundingClientRect();
    const containerCenterY = containerRect.top + containerRect.height / 2;

    let closestPage = 1;
    let minDistance = Infinity;

    pages.forEach(p => {
      const el = pageRefs.current[p.pageNum];
      if (el) {
        const rect = el.getBoundingClientRect();
        const elCenterY = rect.top + rect.height / 2;
        const distance = Math.abs(elCenterY - containerCenterY);
        if (distance < minDistance) {
          minDistance = distance;
          closestPage = p.pageNum;
        }
      }
    });

    if (closestPage !== activeMobilePage) {
      setActiveMobilePage(closestPage);
    }
  };

  const handleOpenPreview = (pageNum: number) => {
    setPreviewPageNum(pageNum);
    setPreviewZoom(1);
    setPreviewRotation(0);
  };

  const handleConfirmAdd = async () => {
    if (selectedPages.size === 0 || !pdfDocRef.current || !file) return;

    if (currentCount + selectedPages.size > maxLimit) {
      setLimitWarning(`Cannot exceed ${maxLimit} total bills. You have ${currentCount} existing bills and ${selectedPages.size} pages selected.`);
      return;
    }

    setIsConverting(true);
    setConversionProgress('Preparing bill images...');

    try {
      const sortedPageNums = Array.from(selectedPages).sort((a, b) => a - b);
      const convertedFiles: File[] = [];
      const pdf = pdfDocRef.current;
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[\s-]+/g, '_');

      for (let idx = 0; idx < sortedPageNums.length; idx++) {
        const pageNum = sortedPageNums[idx];
        setConversionProgress(`Converting page ${pageNum} (${idx + 1} of ${sortedPageNums.length})...`);

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) throw new Error('Canvas 2D context unavailable');

        await page.render({
          canvasContext: ctx,
          viewport: viewport
        }).promise;

        const blob = await new Promise<Blob | null>(resolve => {
          canvas.toBlob(resolve, 'image/jpeg', 0.92);
        });

        if (blob) {
          const pageFile = new File(
            [blob],
            `${baseName}_p${pageNum}.jpg`,
            { type: 'image/jpeg', lastModified: Date.now() }
          );
          convertedFiles.push(pageFile);
        }
      }

      setIsConverting(false);
      onAddPages(convertedFiles);
      onClose();
    } catch (err: any) {
      console.error('[PDF Convert Error]', err);
      setError('Failed to convert selected PDF pages into images. Please try again.');
      setIsConverting(false);
    }
  };

  if (!isOpen) return null;

  const currentPreviewItem = previewPageNum ? pages.find(p => p.pageNum === previewPageNum) : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-2 sm:p-6 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={!isConverting && previewPageNum === null ? onClose : undefined}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "relative w-full max-w-3xl h-[92vh] sm:h-[88vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden z-10",
            theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-900"
          )}
        >
          {/* Header */}
          <div className={cn(
            "px-4 sm:px-5 py-3 sm:py-4 border-b flex items-center justify-between gap-3 shrink-0",
            theme === 'dark' ? "border-zinc-800 bg-zinc-900/60" : "border-slate-100 bg-slate-50/80"
          )}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-extrabold truncate">Select PDF Pages</h3>
                  {pages.length > 0 && (
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                      theme === 'dark' ? "bg-zinc-800 text-zinc-300" : "bg-slate-200 text-slate-700"
                    )}>
                      {pages.length} {pages.length === 1 ? 'Page' : 'Pages'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-md">
                  {file?.name || 'Document.pdf'}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isConverting}
              onClick={onClose}
              className={cn(
                "p-2 rounded-xl transition-colors disabled:opacity-40 cursor-pointer",
                theme === 'dark' ? "hover:bg-zinc-800 text-zinc-400 hover:text-white" : "hover:bg-slate-200 text-slate-500 hover:text-slate-900"
              )}
            >
              <X size={20} />
            </button>
          </div>

          {/* Sub-toolbar: Selection controls and capacity */}
          {!isLoading && !error && pages.length > 0 && (
            <div className={cn(
              "px-4 sm:px-5 py-2.5 border-b flex items-center justify-between gap-2 text-xs shrink-0",
              theme === 'dark' ? "border-zinc-800/80 bg-zinc-900/30" : "border-slate-100 bg-slate-50/40"
            )}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isConverting || availableSlots === 0}
                  onClick={handleSelectAll}
                  className={cn(
                    "px-2.5 sm:px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer text-[11px] sm:text-xs",
                    theme === 'dark' ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  )}
                >
                  <CheckSquare size={13} />
                  <span>Select All</span>
                </button>
                <button
                  type="button"
                  disabled={isConverting || selectedPages.size === 0}
                  onClick={handleClearSelection}
                  className={cn(
                    "px-2.5 sm:px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer text-[11px] sm:text-xs",
                    theme === 'dark' ? "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200" : "hover:bg-slate-200 text-slate-500 hover:text-slate-800"
                  )}
                >
                  <Square size={13} />
                  <span>Clear</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-semibold">
                <span className={cn(
                  "px-2.5 py-1 rounded-lg font-mono",
                  selectedPages.size > 0
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold"
                    : "text-slate-500 dark:text-slate-400"
                )}>
                  {selectedPages.size} of {pages.length} selected
                </span>
                <span className="text-slate-400 hidden sm:inline">•</span>
                <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
                  {currentCount} attached / {maxLimit} max
                </span>
              </div>
            </div>
          )}

          {/* Mobile Page Navigator Toolbar (Visible on Mobile only) */}
          {!isLoading && !error && pages.length > 0 && (
            <div className={cn(
              "sm:hidden px-4 py-2 border-b flex items-center justify-between gap-2 text-xs shrink-0 font-bold",
              theme === 'dark' ? "bg-zinc-900/50 border-zinc-800 text-zinc-300" : "bg-slate-100/70 border-slate-200 text-slate-700"
            )}>
              <button
                type="button"
                disabled={activeMobilePage <= 1}
                onClick={() => scrollToMobilePage(activeMobilePage - 1)}
                className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-zinc-800 disabled:opacity-30 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-emerald-600 dark:text-emerald-400 font-black">Page {activeMobilePage}</span>
                <span className="text-slate-400 font-normal">of {pages.length}</span>
              </div>

              <button
                type="button"
                disabled={activeMobilePage >= pages.length}
                onClick={() => scrollToMobilePage(activeMobilePage + 1)}
                className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-zinc-800 disabled:opacity-30 flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* Warning/Notification Banner */}
          {limitWarning && (
            <div className="mx-4 sm:mx-5 mt-2.5 p-2.5 sm:p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2 shrink-0">
              <AlertCircle size={15} className="shrink-0" />
              <span>{limitWarning}</span>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden relative flex flex-col">
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
                <Loader2 size={36} className="animate-spin text-emerald-500" />
                <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">{loadingProgress}</p>
                <p className="text-xs text-slate-400">Rendering preview thumbnails...</p>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
                  <AlertCircle size={24} />
                </div>
                <h4 className="text-sm font-bold text-rose-500">Error Loading PDF</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">{error}</p>
              </div>
            ) : pages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                No pages detected in this PDF document.
              </div>
            ) : (
              <>
                {/* ========================================================= */}
                {/* 1. MOBILE VIEW: 1 Page visible, Page-by-Page snap scroll   */}
                {/* (User: 1 page ravali, scroll chesthe 2 page ravali...)    */}
                {/* Pressing on image opens preview                           */}
                {/* ========================================================= */}
                <div
                  ref={mobileContainerRef}
                  onScroll={handleMobileScroll}
                  className="sm:hidden flex-1 overflow-y-auto snap-y snap-mandatory p-3 space-y-4"
                  style={{ scrollSnapType: 'y mandatory' }}
                >
                  {pages.map((p) => {
                    const isSelected = selectedPages.has(p.pageNum);
                    return (
                      <div
                        key={p.pageNum}
                        ref={(el) => { pageRefs.current[p.pageNum] = el; }}
                        className={cn(
                          "w-full h-[calc(100%-0.5rem)] min-h-[380px] max-h-[460px] snap-center shrink-0 rounded-2xl overflow-hidden border-2 flex flex-col relative transition-all shadow-md",
                          isSelected
                            ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-500/[0.03]"
                            : theme === 'dark'
                              ? "border-zinc-800 bg-zinc-900/60"
                              : "border-slate-200 bg-slate-50/70"
                        )}
                      >
                        {/* Mobile Card Header: Page badge, Eye Preview button, and Select Checkbox */}
                        <div className={cn(
                          "px-3 py-2 border-b flex items-center justify-between shrink-0 gap-2",
                          theme === 'dark' ? "border-zinc-800 bg-zinc-900" : "border-slate-200 bg-white"
                        )}>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-xs font-black px-2.5 py-1 rounded-lg",
                              isSelected
                                ? "bg-emerald-600 text-white"
                                : theme === 'dark' ? "bg-zinc-800 text-zinc-300" : "bg-slate-200 text-slate-800"
                            )}>
                              Page {p.pageNum}
                            </span>

                            {/* Eye Icon Preview Button: Pressing THIS opens the image preview */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPreview(p.pageNum);
                              }}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs",
                                theme === 'dark'
                                  ? "bg-zinc-800 hover:bg-zinc-700 text-indigo-400 border border-zinc-700/60"
                                  : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70"
                              )}
                            >
                              <Eye size={14} className="text-indigo-500" />
                              <span>Preview</span>
                            </button>
                          </div>

                          {/* Select / Deselect Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePageSelection(p.pageNum);
                            }}
                            className={cn(
                              "px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer",
                              isSelected
                                ? "bg-emerald-600 text-white hover:bg-emerald-500"
                                : theme === 'dark'
                                  ? "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-emerald-500"
                                  : "bg-white border border-slate-300 text-slate-700 hover:border-emerald-500"
                            )}
                          >
                            {isSelected ? (
                              <>
                                <Check size={14} className="stroke-[3]" />
                                <span>Selected</span>
                              </>
                            ) : (
                              <>
                                <Plus size={14} />
                                <span>Select Page</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Mobile Image Container: Pressing image now SELECTS / UNSELECTS! */}
                        <div
                          onClick={() => togglePageSelection(p.pageNum)}
                          className={cn(
                            "relative flex-1 w-full overflow-hidden flex items-center justify-center p-2.5 cursor-pointer select-none transition-colors",
                            isSelected
                              ? theme === 'dark' ? "bg-emerald-950/20" : "bg-emerald-50/50"
                              : theme === 'dark' ? "bg-zinc-950/60" : "bg-slate-100/80"
                          )}
                        >
                          <img
                            src={p.thumbnail}
                            alt={`Page ${p.pageNum}`}
                            className={cn(
                              "w-full h-full object-contain rounded-lg drop-shadow-sm pointer-events-none transition-transform",
                              isSelected ? "scale-[0.98]" : ""
                            )}
                            loading="lazy"
                          />

                          {/* Selection Checkbox indicator badge on mobile image */}
                          <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
                            <div className={cn(
                              "w-7 h-7 rounded-xl flex items-center justify-center transition-all shadow-md",
                              isSelected
                                ? "bg-emerald-500 text-white scale-105 ring-2 ring-emerald-500/40"
                                : theme === 'dark'
                                  ? "bg-black/60 border border-zinc-700 text-transparent"
                                  : "bg-white/90 border border-slate-300 text-transparent"
                            )}>
                              <Check size={15} className="stroke-[3]" />
                            </div>
                          </div>

                          {/* Tap image hint (Select / Unselect) */}
                          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-md pointer-events-none">
                            {isSelected ? (
                              <>
                                <Check size={12} className="text-emerald-400 stroke-[3]" />
                                <span>Tap image to unselect</span>
                              </>
                            ) : (
                              <>
                                <Plus size={12} className="text-emerald-400" />
                                <span>Tap image to select</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ========================================================= */}
                {/* 2. DESKTOP VIEW: Multi-column Grid with Eye Icon button   */}
                {/* (Desktop lo kadhu, Desktop lo page medha eye icon cheyyi) */}
                {/* ========================================================= */}
                <div className="hidden sm:block flex-1 overflow-y-auto p-5">
                  <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {pages.map((p) => {
                      const isSelected = selectedPages.has(p.pageNum);
                      return (
                        <div
                          key={p.pageNum}
                          onClick={() => !isConverting && togglePageSelection(p.pageNum)}
                          className={cn(
                            "group relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer flex flex-col select-none",
                            isSelected
                              ? "border-emerald-500 ring-2 ring-emerald-500/30 shadow-md shadow-emerald-500/10"
                              : theme === 'dark'
                                ? "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                                : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                          )}
                        >
                          {/* Desktop Eye Icon Button (Top-Left) */}
                          <div className="absolute top-2 left-2 z-20">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPreview(p.pageNum);
                              }}
                              title="Preview page"
                              className={cn(
                                "p-1.5 rounded-lg backdrop-blur-md transition-all shadow-sm flex items-center gap-1 cursor-pointer",
                                theme === 'dark'
                                  ? "bg-black/60 hover:bg-black/85 text-zinc-200 hover:text-white border border-zinc-700/60"
                                  : "bg-white/85 hover:bg-white text-slate-700 hover:text-black border border-slate-200/80"
                              )}
                            >
                              <Eye size={14} className="text-indigo-500" />
                              <span className="text-[10px] font-bold pr-0.5">Preview</span>
                            </button>
                          </div>

                          {/* Checkbox indicator badge (Top-Right) */}
                          <div className="absolute top-2 right-2 z-10">
                            <div className={cn(
                              "w-6 h-6 rounded-lg flex items-center justify-center transition-all shadow-sm",
                              isSelected
                                ? "bg-emerald-500 text-white scale-105"
                                : theme === 'dark'
                                  ? "bg-black/60 border border-zinc-700 text-transparent group-hover:text-zinc-500"
                                  : "bg-white/90 border border-slate-300 text-transparent group-hover:text-slate-400"
                            )}>
                              <Check size={14} className="stroke-[3]" />
                            </div>
                          </div>

                          {/* Page number badge (Bottom-Left) */}
                          <div className="absolute bottom-2 left-2 z-10">
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm backdrop-blur-sm",
                              isSelected
                                ? "bg-emerald-600 text-white"
                                : "bg-black/70 text-white"
                            )}>
                              Page {p.pageNum}
                            </span>
                          </div>

                          {/* Thumbnail Image */}
                          <div className={cn(
                            "w-full aspect-[3/4] overflow-hidden flex items-center justify-center p-2 transition-opacity",
                            isSelected ? "opacity-100" : "opacity-90 group-hover:opacity-100",
                            theme === 'dark' ? "bg-zinc-950" : "bg-slate-100"
                          )}>
                            <img
                              src={p.thumbnail}
                              alt={`Page ${p.pageNum}`}
                              className="w-full h-full object-contain rounded shadow-xs"
                              loading="lazy"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className={cn(
            "px-4 sm:px-5 py-3 sm:py-4 border-t flex items-center justify-between gap-3 shrink-0",
            theme === 'dark' ? "border-zinc-800 bg-zinc-900/60" : "border-slate-100 bg-slate-50/80"
          )}>
            <div className="text-xs">
              <span className="font-bold text-slate-700 dark:text-zinc-300">
                {selectedPages.size} {selectedPages.size === 1 ? 'page' : 'pages'} selected
              </span>
              {selectedPages.size > 0 && (
                <span className="text-slate-400 text-[11px] block sm:inline sm:ml-2">
                  (added as individual {selectedPages.size === 1 ? 'bill' : 'bills'})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isConverting}
                onClick={onClose}
                className={cn(
                  "px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all disabled:opacity-50 cursor-pointer",
                  theme === 'dark'
                    ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                    : "border border-slate-200 hover:bg-slate-100 text-slate-700"
                )}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={selectedPages.size === 0 || isConverting || currentCount + selectedPages.size > maxLimit}
                onClick={handleConfirmAdd}
                className={cn(
                  "px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shadow-lg cursor-pointer",
                  "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                {isConverting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{conversionProgress || 'Converting...'}</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>
                      Add {selectedPages.size > 0 ? `(${selectedPages.size} ${selectedPages.size === 1 ? 'Page' : 'Pages'})` : ''}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* ========================================================= */}
        {/* Full-Screen Page Image Preview Lightbox                   */}
        {/* Opened by Eye icon (Desktop) or Image press (Mobile)      */}
        {/* ========================================================= */}
        <AnimatePresence>
          {previewPageNum !== null && currentPreviewItem && (
            <div className="fixed inset-0 z-[1100] flex flex-col bg-black/90 backdrop-blur-md select-none">
              {/* Preview Header Bar */}
              <div className="px-4 py-3 bg-zinc-950/80 border-b border-zinc-800/80 flex items-center justify-between text-white shrink-0 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-black text-sm text-emerald-400">
                    Page {previewPageNum} of {pages.length}
                  </span>
                  <span className="text-zinc-500 text-xs hidden sm:inline">•</span>
                  <span className="text-zinc-400 text-xs truncate max-w-[150px] sm:max-w-xs hidden sm:inline">
                    {file?.name}
                  </span>
                </div>

                {/* Zoom, Rotate, and Selection Controls */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(z => Math.max(0.6, z - 0.25))}
                    title="Zoom Out"
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(1)}
                    title="Reset Zoom"
                    className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono font-bold text-zinc-300 transition-colors cursor-pointer"
                  >
                    {Math.round(previewZoom * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(z => Math.min(3.0, z + 0.25))}
                    title="Zoom In"
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                  >
                    <ZoomIn size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewRotation(r => (r + 90) % 360)}
                    title="Rotate 90°"
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                  >
                    <RotateCw size={16} />
                  </button>

                  <div className="w-px h-5 bg-zinc-800 mx-1" />

                  {/* Select / Deselect page directly from preview */}
                  <button
                    type="button"
                    onClick={() => togglePageSelection(previewPageNum)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                      selectedPages.has(previewPageNum)
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                    )}
                  >
                    {selectedPages.has(previewPageNum) ? (
                      <>
                        <Check size={14} className="stroke-[3]" />
                        <span>Selected</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        <span>Select Page</span>
                      </>
                    )}
                  </button>

                  {/* Close Preview */}
                  <button
                    type="button"
                    onClick={() => setPreviewPageNum(null)}
                    className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer ml-1"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Preview Main Canvas View with Touch Swipe & Tap Navigation */}
              <div 
                className="flex-1 relative overflow-auto flex items-center justify-center p-4 touch-pan-y select-none"
                onTouchStart={(e) => {
                  if (previewZoom > 1) return;
                  previewTouchStartX.current = e.touches[0].clientX;
                  previewTouchStartY.current = e.touches[0].clientY;
                  previewTouchEndX.current = null;
                }}
                onTouchMove={(e) => {
                  if (previewZoom > 1) return;
                  previewTouchEndX.current = e.touches[0].clientX;
                }}
                onTouchEnd={(e) => {
                  if (previewZoom > 1) return;
                  if (previewTouchStartX.current === null || previewTouchEndX.current === null) return;
                  const deltaX = previewTouchStartX.current - previewTouchEndX.current;
                  const deltaY = previewTouchStartY.current ? Math.abs(previewTouchStartY.current - e.changedTouches[0].clientY) : 0;
                  if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > deltaY) {
                    if (deltaX > 0 && previewPageNum < pages.length) {
                      // Swiped left -> Next page
                      setPreviewPageNum(previewPageNum + 1);
                      setPreviewZoom(1);
                    } else if (deltaX < 0 && previewPageNum > 1) {
                      // Swiped right -> Previous page
                      setPreviewPageNum(previewPageNum - 1);
                      setPreviewZoom(1);
                    }
                  }
                  previewTouchStartX.current = null;
                  previewTouchStartY.current = null;
                  previewTouchEndX.current = null;
                }}
                onClick={(e) => {
                  if (pages.length > 1 && window.innerWidth < 640 && previewZoom <= 1) {
                    const target = e.target as HTMLElement;
                    if (target.closest('button')) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    if (clickX > rect.width * 0.65 && previewPageNum < pages.length) {
                      setPreviewPageNum(previewPageNum + 1);
                      setPreviewZoom(1);
                    } else if (clickX < rect.width * 0.35 && previewPageNum > 1) {
                      setPreviewPageNum(previewPageNum - 1);
                      setPreviewZoom(1);
                    }
                  }
                }}
              >
                {/* Navigation arrow buttons */}
                {previewPageNum > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewPageNum(previewPageNum - 1);
                      setPreviewZoom(1);
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/70 hover:bg-black/90 text-white border border-zinc-700/60 transition-all shadow-lg cursor-pointer"
                  >
                    <ChevronLeft size={24} />
                  </button>
                )}

                {previewPageNum < pages.length && (
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewPageNum(previewPageNum + 1);
                      setPreviewZoom(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/70 hover:bg-black/90 text-white border border-zinc-700/60 transition-all shadow-lg cursor-pointer"
                  >
                    <ChevronRight size={24} />
                  </button>
                )}

                {/* Preview Image with zoom & rotation transform */}
                <div
                  className="transition-transform duration-150 ease-out flex items-center justify-center max-w-full max-h-full"
                  style={{
                    transform: `scale(${previewZoom}) rotate(${previewRotation}deg)`
                  }}
                >
                  <img
                    src={currentPreviewItem.thumbnail}
                    alt={`Page ${previewPageNum}`}
                    className="max-w-[90vw] max-h-[78vh] object-contain rounded-lg shadow-2xl pointer-events-none"
                  />
                </div>

                {/* Mobile Swipe Hint Pill */}
                {pages.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md text-white/90 px-3 py-1 rounded-full text-[10px] font-medium sm:hidden pointer-events-none flex items-center gap-1.5 shadow-md">
                    <span>Swipe left/right to view next</span>
                  </div>
                )}
              </div>

              {/* Preview Bottom Bar: Quick page switcher buttons */}
              <div className="px-4 py-2.5 bg-zinc-950/80 border-t border-zinc-800/80 flex items-center justify-center gap-3 text-xs text-zinc-400 shrink-0">
                <button
                  type="button"
                  disabled={previewPageNum <= 1}
                  onClick={() => {
                    setPreviewPageNum(previewPageNum - 1);
                    setPreviewZoom(1);
                  }}
                  className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 text-white flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft size={14} />
                  <span>Previous Page</span>
                </button>

                <span className="font-mono text-zinc-300 font-bold">
                  {previewPageNum} / {pages.length}
                </span>

                <button
                  type="button"
                  disabled={previewPageNum >= pages.length}
                  onClick={() => {
                    setPreviewPageNum(previewPageNum + 1);
                    setPreviewZoom(1);
                  }}
                  className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 text-white flex items-center gap-1 cursor-pointer"
                >
                  <span>Next Page</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
