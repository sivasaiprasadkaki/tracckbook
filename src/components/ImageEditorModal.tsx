import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, RotateCw, RefreshCw, Check, X, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '../lib/utils';

interface ImageEditorModalProps {
  file: File;
  onDone: (editedFile: File) => void;
  onCancel: () => void;
  theme?: 'light' | 'dark';
}

export default function ImageEditorModal({
  file,
  onDone,
  onCancel,
  theme = 'light',
}: ImageEditorModalProps) {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Active interaction tracking
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const cropStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const activeHandleRef = useRef<string | null>(null);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);

  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [stageSize, setStageSize] = useState({ width: 600, height: 450 });

  // Load image
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    setNaturalSize(null);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Track parent stage size
  useEffect(() => {
    const updateSize = () => {
      const stage = document.getElementById('editor-stage');
      if (stage) {
        // Subtract padding (e.g. 48px)
        const computedW = Math.max(200, stage.clientWidth - 48);
        const computedH = Math.max(200, stage.clientHeight - 48);
        setStageSize({
          width: computedW,
          height: computedH,
        });
      }
    };
    
    updateSize();
    const t = setTimeout(updateSize, 100);

    window.addEventListener('resize', updateSize);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', updateSize);
    };
  }, [imgSrc]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  // Compute container dimensions dynamically
  let containerWidth = 400;
  let containerHeight = 300;

  if (naturalSize) {
    const isRotated90 = rotation === 90 || rotation === 270;
    const visualWidth = isRotated90 ? naturalSize.height : naturalSize.width;
    const visualHeight = isRotated90 ? naturalSize.width : naturalSize.height;
    const imageRatio = visualWidth / visualHeight;
    const stageRatio = stageSize.width / stageSize.height;

    if (imageRatio > stageRatio) {
      containerWidth = stageSize.width;
      containerHeight = stageSize.width / imageRatio;
    } else {
      containerHeight = stageSize.height;
      containerWidth = stageSize.height * imageRatio;
    }
  }

  const isRotated90 = rotation === 90 || rotation === 270;
  const imgStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
    width: isRotated90 ? `${containerHeight}px` : `${containerWidth}px`,
    height: isRotated90 ? `${containerWidth}px` : `${containerHeight}px`,
  };

  // Reset all changes
  const handleReset = () => {
    setRotation(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCrop({ x: 0, y: 0, width: 100, height: 100 });
  };

  // Rotation triggers
  const handleRotateLeft = () => {
    setRotation((prev) => {
      if (prev === 0) return 270;
      return (prev - 90) as 0 | 90 | 180 | 270;
    });
  };

  const handleRotateRight = () => {
    setRotation((prev) => {
      if (prev === 270) return 0;
      return (prev + 90) as 0 | 90 | 180 | 270;
    });
  };

  // Mouse / Touch interaction handlers for Crop and Pan
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, handle: string) => {
    e.preventDefault();
    e.stopPropagation();

    const clientX = e.clientX;
    const clientY = e.clientY;

    startDrag(clientX, clientY, handle);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, handle: string) => {
    if (e.touches.length === 0) return;
    e.stopPropagation();

    const clientX = e.touches[0].clientX;
    const clientY = e.touches[0].clientY;

    startDrag(clientX, clientY, handle);
  };

  const startDrag = (clientX: number, clientY: number, handle: string) => {
    if (handle === 'pan') {
      panStartRef.current = { x: clientX - pan.x, y: clientY - pan.y };
      return;
    }

    activeHandleRef.current = handle;
    dragStartRef.current = { x: clientX, y: clientY };
    cropStartRef.current = { ...crop };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      onDragMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      onDragMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleMouseUp = () => {
      endDrag();
    };

    const handleTouchEnd = () => {
      endDrag();
    };

    const onDragMove = (clientX: number, clientY: number) => {
      if (panStartRef.current) {
        setPan({
          x: clientX - panStartRef.current.x,
          y: clientY - panStartRef.current.y,
        });
        return;
      }

      if (!activeHandleRef.current || !dragStartRef.current || !cropStartRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = ((clientX - dragStartRef.current.x) / rect.width) * 100;
      const deltaY = ((clientY - dragStartRef.current.y) / rect.height) * 100;

      const start = cropStartRef.current;
      const handle = activeHandleRef.current;

      setCrop((prev) => {
        let x = prev.x;
        let y = prev.y;
        let width = prev.width;
        let height = prev.height;

        const minSize = 10; // minimum crop size of 10%

        if (handle === 'box') {
          // Move whole box
          x = Math.max(0, Math.min(100 - start.width, start.x + deltaX));
          y = Math.max(0, Math.min(100 - start.height, start.y + deltaY));
        } else {
          // Resize from corners / edges
          if (handle.includes('e') || handle.includes('w')) {
            if (handle.includes('e')) {
              width = Math.max(minSize, Math.min(100 - start.x, start.width + deltaX));
            } else if (handle.includes('w')) {
              const proposedX = start.x + deltaX;
              const proposedW = start.width - deltaX;
              if (proposedX >= 0 && proposedW >= minSize) {
                x = proposedX;
                width = proposedW;
              }
            }
          }

          if (handle.includes('n') || handle.includes('s')) {
            if (handle.includes('s')) {
              height = Math.max(minSize, Math.min(100 - start.y, start.height + deltaY));
            } else if (handle.includes('n')) {
              const proposedY = start.y + deltaY;
              const proposedH = start.height - deltaY;
              if (proposedY >= 0 && proposedH >= minSize) {
                y = proposedY;
                height = proposedH;
              }
            }
          }
        }

        return { x, y, width, height };
      });
    };

    const endDrag = () => {
      activeHandleRef.current = null;
      dragStartRef.current = null;
      cropStartRef.current = null;
      panStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [crop, pan]);

  // Handle saving edited image by drawing onto HTML5 canvas
  const handleSave = async () => {
    if (!imageRef.current) return;
    setIsProcessing(true);

    try {
      const img = imageRef.current;
      
      // Calculate original dimensions and rotated dimensions
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;
      
      const rotatedWidth = (rotation === 90 || rotation === 270) ? imgHeight : imgWidth;
      const rotatedHeight = (rotation === 90 || rotation === 270) ? imgWidth : imgHeight;

      // 1. Create a canvas for the fully rotated image
      const rotatedCanvas = document.createElement('canvas');
      rotatedCanvas.width = rotatedWidth;
      rotatedCanvas.height = rotatedHeight;
      const rCtx = rotatedCanvas.getContext('2d');
      
      if (!rCtx) throw new Error('Could not get rotated canvas context');

      // Draw rotated image centered
      rCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
      rCtx.rotate((rotation * Math.PI) / 180);
      rCtx.drawImage(img, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);

      // 2. Crop from the rotated canvas based on our crop percentages
      const cropX = (crop.x / 100) * rotatedWidth;
      const cropY = (crop.y / 100) * rotatedHeight;
      const cropW = (crop.width / 100) * rotatedWidth;
      const cropH = (crop.height / 100) * rotatedHeight;

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = cropW;
      finalCanvas.height = cropH;
      const fCtx = finalCanvas.getContext('2d');

      if (!fCtx) throw new Error('Could not get final canvas context');

      fCtx.drawImage(rotatedCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      // 3. Export cropped image as Blob & File
      finalCanvas.toBlob((blob) => {
        if (!blob) {
          setIsProcessing(false);
          return;
        }

        // Create a new file preserving the name and type
        const newFileName = file.name.replace(/\.[^/.]+$/, "") + '_edited.jpg';
        const editedFile = new File([blob], newFileName, { type: 'image/jpeg' });

        setIsProcessing(false);
        onDone(editedFile);
      }, 'image/jpeg', 0.92);

    } catch (err) {
      console.error('[ImageEditorModal] Error saving edited image:', err);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div className={cn(
        "w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[90vh] md:h-[85vh] border",
        theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-slate-100 text-slate-800"
      )}>
        {/* Header */}
        <div className={cn(
          "px-5 py-4 flex items-center justify-between border-b shrink-0",
          theme === 'dark' ? "border-zinc-800 bg-zinc-900/40" : "border-slate-100 bg-slate-50/50"
        )}>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              TrackBook Image Editor
            </h2>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium mt-0.5">
              Crop & rotate image to finalize your transaction attachment.
            </p>
          </div>
          <button 
            onClick={onCancel}
            disabled={isProcessing}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Editor Main Canvas Area */}
        <div id="editor-stage" className="flex-1 overflow-hidden relative flex items-center justify-center p-6 bg-slate-950">
          <div 
            ref={containerRef}
            className="relative select-none overflow-hidden"
            style={{
              width: `${containerWidth}px`,
              height: `${containerHeight}px`,
            }}
          >
            {/* Target Image with Rotation, Zoom, and Pan */}
            {imgSrc && (
              <img
                ref={imageRef}
                src={imgSrc}
                alt="Original"
                onLoad={handleImageLoad}
                className="pointer-events-none"
                style={imgStyle}
              />
            )}

            {/* Dark Mask Overlay around crop box */}
            <div className="absolute inset-0 pointer-events-none">
              <div 
                className="absolute inset-0 bg-black/60"
                style={{
                  clipPath: `polygon(
                    0% 0%, 0% 100%, 
                    ${crop.x}% 100%, 
                    ${crop.x}% ${crop.y}%, 
                    ${crop.x + crop.width}% ${crop.y}%, 
                    ${crop.x + crop.width}% ${crop.y + crop.height}%, 
                    ${crop.x}% ${crop.y + crop.height}%, 
                    ${crop.x}% 100%, 
                    100% 100%, 100% 0%
                  )`
                }}
              />
            </div>

            {/* Crop Overlay Area box */}
            <div 
              className="absolute border border-indigo-500 shadow-[0_0_0_4000px_rgba(0,0,0,0.1)] cursor-move"
              style={{
                left: `${crop.x}%`,
                top: `${crop.y}%`,
                width: `${crop.width}%`,
                height: `${crop.height}%`,
              }}
              onMouseDown={(e) => handleMouseDown(e, 'box')}
              onTouchStart={(e) => handleTouchStart(e, 'box')}
            >
              {/* Grid Lines */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30 pointer-events-none">
                <div className="border-r border-dashed border-white col-span-1 row-span-3" />
                <div className="border-r border-dashed border-white col-span-1 row-span-3" />
                <div className="border-b border-dashed border-white col-span-3 row-span-1" />
                <div className="border-b border-dashed border-white col-span-3 row-span-1" />
              </div>

              {/* Resize Corners */}
              {/* Top Left */}
              <div 
                className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-indigo-500 cursor-nwse-resize active:scale-125 transition-transform"
                onMouseDown={(e) => handleMouseDown(e, 'nw')}
                onTouchStart={(e) => handleTouchStart(e, 'nw')}
              />
              {/* Top Right */}
              <div 
                className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-indigo-500 cursor-nesw-resize active:scale-125 transition-transform"
                onMouseDown={(e) => handleMouseDown(e, 'ne')}
                onTouchStart={(e) => handleTouchStart(e, 'ne')}
              />
              {/* Bottom Left */}
              <div 
                className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-indigo-500 cursor-nesw-resize active:scale-125 transition-transform"
                onMouseDown={(e) => handleMouseDown(e, 'sw')}
                onTouchStart={(e) => handleTouchStart(e, 'sw')}
              />
              {/* Bottom Right */}
              <div 
                className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-indigo-500 cursor-nwse-resize active:scale-125 transition-transform"
                onMouseDown={(e) => handleMouseDown(e, 'se')}
                onTouchStart={(e) => handleTouchStart(e, 'se')}
              />

              {/* Edge Handles */}
              {/* Top */}
              <div 
                className="absolute top-0 inset-x-4 h-1.5 cursor-ns-resize"
                onMouseDown={(e) => handleMouseDown(e, 'n')}
                onTouchStart={(e) => handleTouchStart(e, 'n')}
              />
              {/* Bottom */}
              <div 
                className="absolute bottom-0 inset-x-4 h-1.5 cursor-ns-resize"
                onMouseDown={(e) => handleMouseDown(e, 's')}
                onTouchStart={(e) => handleTouchStart(e, 's')}
              />
              {/* Left */}
              <div 
                className="absolute left-0 inset-y-4 w-1.5 cursor-ew-resize"
                onMouseDown={(e) => handleMouseDown(e, 'w')}
                onTouchStart={(e) => handleTouchStart(e, 'w')}
              />
              {/* Right */}
              <div 
                className="absolute right-0 inset-y-4 w-1.5 cursor-ew-resize"
                onMouseDown={(e) => handleMouseDown(e, 'e')}
                onTouchStart={(e) => handleTouchStart(e, 'e')}
              />
            </div>
          </div>

          {/* Canvas Instructions Overlay */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl text-[10px] font-medium text-slate-200 pointer-events-none select-none tracking-wider uppercase text-center max-w-[220px] sm:max-w-none leading-snug border border-white/10 shadow-lg">
            <span>Drag to pan image</span>
            <span className="hidden sm:inline"> • </span>
            <br className="sm:hidden" />
            <span>Resize glowing box to crop</span>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className={cn(
          "px-5 py-3 flex flex-wrap gap-4 items-center justify-between border-t shrink-0 select-none",
          theme === 'dark' ? "border-zinc-800 bg-zinc-900/60" : "border-slate-100 bg-slate-50/50"
        )}>
          {/* Zoom Slider */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setZoom(prev => Math.max(1, prev - 0.25))}
              className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded text-slate-500"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <input 
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-24 accent-indigo-600 h-1 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
            <button 
              onClick={() => setZoom(prev => Math.min(3, prev + 0.25))}
              className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded text-slate-500"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <span className="text-[10px] font-mono text-slate-400 font-bold ml-1">{Math.round(zoom * 100)}%</span>
          </div>

          {/* Action buttons (Rotation and Reset) */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRotateLeft}
              className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all cursor-pointer text-slate-700 dark:text-zinc-300"
              title="Rotate Left 90°"
            >
              <RotateCcw size={13} className="stroke-[2.5]" />
              <span className="hidden sm:inline">Rotate Left</span>
            </button>
            <button
              onClick={handleRotateRight}
              className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all cursor-pointer text-slate-700 dark:text-zinc-300"
              title="Rotate Right 90°"
            >
              <RotateCw size={13} className="stroke-[2.5]" />
              <span className="hidden sm:inline">Rotate Right</span>
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all cursor-pointer border border-transparent hover:border-rose-100 dark:hover:border-rose-950/40"
              title="Reset Changes"
            >
              <RefreshCw size={13} className="stroke-[2.5]" />
              <span>Reset</span>
            </button>
          </div>

          {/* Save / Cancel CTAs */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-md shadow-indigo-100 dark:shadow-none hover:scale-102 active:scale-98 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Check size={13} className="stroke-[3]" />
              )}
              <span>Save Image</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
