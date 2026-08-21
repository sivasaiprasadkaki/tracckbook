/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Plus, 
  Minus, 
  Upload, 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  History, 
  BookOpen, 
  Loader2,
  X,
  Image as ImageIcon,
  Search,
  User,
  Clock,
  Settings,
  LogOut,
  LayoutGrid,
  Key,
  List,
  Download,
  RotateCw,
  RotateCcw,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Check,
  CheckSquare,
  Sparkles,
  Square,
  Trash,
  Share,
  Copy,
  ChevronDown,
  ArrowLeft,
  Pencil,
  Trash2,
  ArrowRight,
  FileText,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  DownloadCloud,
  FileSpreadsheet,
  AlertCircle,
  CloudOff,
  Menu,
  HelpCircle,
  MessageSquare,
  Sun,
  Moon,
  Palette,
  ArrowUp,
  ArrowUpDown,
  MoreVertical,
  Users,
  UserPlus,
  ShieldCheck,
  Shield,
  KeyRound,
  Camera,
  ImagePlus,
  Phone,
  Crop,
  CheckCircle2,
  Mail,
  Lock,
  Merge,
  Eye,
  Fingerprint,
  ScanFace
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn, formatCurrency, vibrate } from '../lib/utils';
import { parseReceipt, parseMultipleReceipts } from '../services/gemini';
import { processAndOcrImage } from '../services/ocrService';
import { supabase } from '../lib/supabase';
import { uploadToCloudinary, getOptimizedCloudinaryUrl, getExportOptimizedCloudinaryUrl, getUserCloudinaryFolder, getUserProfileCloudinaryFolder, resolveAttachmentUrl } from '../services/cloudinary';
import imageCompression from 'browser-image-compression';
import XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { backgroundExportManager } from '../services/exportManager';
import { syncManager, offlineDb } from '../services/syncManager';
import DownloadCenter, { DownloadCenterTrigger } from '../components/DownloadCenter';
import NotificationBell from '../components/NotificationBell';
import MembersAccessManagement from '../components/MembersAccessManagement';
import RolesPermissionsModal from '../components/RolesPermissionsModal';
import { canAddEntries, canEditEntries, canDeleteEntries, canDeleteBook, canManageMembers, canAccessBookSettings, ALL_ROLES, Role } from '../lib/rbac';
import MediaPickerSheet from '../components/MediaPickerSheet';
import ImageEditorModal from '../components/ImageEditorModal';
import { CountryCodePicker, COUNTRIES, Country } from '../components/CountryCodePicker';
import { PhoneComingSoonModal } from '../components/PhoneComingSoonModal';
import { useMpinSecurity } from '../components/MpinManager';
import { clearSessionUnlocked } from '../services/mpinSecurityService';
import { ShareWhatsAppModal } from '../components/ShareWhatsAppModal';
import { addPdfBrandingFooter } from '../utils/pdfBranding';

interface TimelineStep {
  id: string;
  label: string;
}

const TIMELINE_STEPS: TimelineStep[] = [
  { id: 'receipt_uploaded', label: 'Uploading receipt' },
  { id: 'uploaded_cloud', label: 'Uploading to TrackBook Cloud' },
  { id: 'ocr_completed', label: 'Reading receipt' },
  { id: 'merchant_detected', label: 'Extracting merchant' },
  { id: 'amount_extracted', label: 'Extracting amount' },
  { id: 'date_parsed', label: 'Detecting bill category' },
  { id: 'ai_verification', label: 'Verifying with AI TrackBook' },
  { id: 'creating_transaction', label: 'Creating transaction' },
  { id: 'transaction_saved', label: 'Saving to ledger' },
];

function ProcessingTimeline({ 
  currentStepId, 
  completedSteps = [], 
  theme = 'light' 
}: { 
  currentStepId: string; 
  completedSteps: string[]; 
  theme: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  return (
    <div 
      ref={containerRef}
      className={cn(
        "max-h-[170px] overflow-y-auto py-2.5 pr-1.5 space-y-3.5 scroll-smooth",
        "scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-800 scrollbar-track-transparent"
      )}
    >
      {TIMELINE_STEPS.map((step, idx) => {
        const isCompleted = completedSteps.includes(step.id) || (step.id === 'transaction_saved' && currentStepId === 'transaction_saved');
        const isActive = step.id === currentStepId;
        const isPending = !isCompleted && !isActive;

        // Determine icon & colors
        let iconContent;
        let textColorClass;
        let iconBgClass;

        if (isCompleted) {
          iconContent = (
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", duration: 0.35 }}
              className="text-emerald-500"
            >
              <Check size={11} strokeWidth={4} />
            </motion.div>
          );
          textColorClass = "text-emerald-600 dark:text-emerald-400 font-semibold";
          iconBgClass = "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/30";
        } else if (isActive) {
          iconContent = (
            <div className="relative flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
              <span className="absolute w-4 h-4 rounded-full bg-indigo-500/20 dark:bg-indigo-400/20 animate-ping" />
            </div>
          );
          textColorClass = "text-indigo-600 dark:text-indigo-400 font-bold";
          iconBgClass = "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500";
        } else {
          iconContent = <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-zinc-700" />;
          textColorClass = "text-slate-400 dark:text-zinc-600 font-medium";
          iconBgClass = "bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800";
        }

        const isLast = idx === TIMELINE_STEPS.length - 1;

        return (
          <motion.div
            key={step.id}
            ref={isActive ? (el => {
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }) : undefined}
            initial={isActive ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-start gap-3 relative"
          >
            {/* Left Connecting Line */}
            {!isLast && (
              <div 
                className={cn(
                  "absolute left-[9px] top-[20px] w-[2px] h-[calc(100%+6px)] -z-10",
                  isCompleted 
                    ? "bg-emerald-200 dark:bg-emerald-900/40" 
                    : "bg-slate-100 dark:bg-zinc-900"
                )}
              />
            )}

            {/* Icon circle */}
            <div 
              className={cn(
                "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 z-10 transition-all duration-300",
                iconBgClass
              )}
            >
              {iconContent}
            </div>

            {/* Label */}
            <span className={cn("text-xs transition-colors duration-300 leading-none self-center", textColorClass)}>
              {step.label}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

interface Transaction {
  id: string;
  amount: number;
  type: 'in' | 'out';
  description: string;
  category: string;
  mode: string;
  date: Date;
  images?: string[];
  imageLayout?: 'split' | 'merge';
  isAi?: boolean;
  imported_from_share_code?: string;
  is_imported?: boolean;
  import_batch_id?: string;
  source?: 'AI' | 'Imported' | 'Manual' | string;
  user_name?: string;
  created_at?: string;
  attachment_details?: any[];
}

function getTransactionSource(t: any): 'AI' | 'Imported' | 'Manual' {
  if (t?.source === 'AI') return 'AI';
  if (t?.source === 'Imported') return 'Imported';
  if (t?.source === 'Manual') return 'Manual';
  
  // Backward compatibility
  if (t?.isAi) return 'AI';
  if (t?.is_imported || t?.imported_from_share_code) return 'Imported';
  return 'Manual';
}

interface Cashbook {
  id: string;
  name: string;
  transactions: Transaction[];
  createdAt: Date;
  user_name?: string;
}

function formatDateTime12h(dateVal: any): string {
  if (!dateVal) return 'N/A';
  try {
    const d = typeof dateVal === 'string' || typeof dateVal === 'number' ? new Date(dateVal) : dateVal;
    if (d instanceof Date && !isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const formattedHours = String(hours).padStart(2, '0');

      return `${day}-${month}-${year} ${formattedHours}:${minutes} ${ampm}`;
    }
  } catch (e) {
    console.error(e);
  }
  return 'N/A';
}

function safeFormatDate(dateVal: any, options?: Intl.DateTimeFormatOptions, locales: string = 'en-IN'): string {
  if (!dateVal) return 'N/A';
  try {
    const d = typeof dateVal === 'string' || typeof dateVal === 'number' ? new Date(dateVal) : dateVal;
    if (d instanceof Date && !isNaN(d.getTime())) {
      return d.toLocaleDateString(locales, options);
    }
  } catch (e) {
    console.error(e);
  }
  return 'N/A';
}

function safeFormatTime(dateVal: any, options?: Intl.DateTimeFormatOptions, locales: string = 'en-IN'): string {
  if (!dateVal) return 'N/A';
  try {
    const d = typeof dateVal === 'string' || typeof dateVal === 'number' ? new Date(dateVal) : dateVal;
    if (d instanceof Date && !isNaN(d.getTime())) {
      return d.toLocaleTimeString(locales, options);
    }
  } catch (e) {
    console.error(e);
  }
  return 'N/A';
}

// Compress image before client-side direct upload using browser-image-compression
async function compressImage(file: File): Promise<Blob | File> {
  const sizeKB = file.size / 1024;
  if (file.size < 150 * 1024) {
    console.log(`[Compression] Image ${file.name} is ${sizeKB.toFixed(1)} KB (below 150 KB threshold). Skipping compression.`);
    return file;
  }

  const options = {
    maxSizeMB: 1.0, // Increased target size to avoid slow multi-pass iteration cycles
    maxWidthOrHeight: 1200, // Fast single-pass resize width/height
    useWebWorker: true,
    maxIteration: 2 // Guarantee it finishes in maximum 2 iterations for speed
  };

  try {
    console.log(`[Compression] Compressing ${file.name} (${sizeKB.toFixed(1)} KB) automatically...`);
    const compressedBlob = await imageCompression(file, options);
    console.log(`[Compression] Success: Compressed to ${(compressedBlob.size / 1024).toFixed(1)} KB`);
    return compressedBlob;
  } catch (err) {
    console.error('[Compression] browser-image-compression failed, falling back to original file:', err);
    return file;
  }
}

// Generate lightweight thumbnail URL for Cloudinary images (w_200,q_auto,f_auto)
function getCloudinaryThumbnail(url: string): string {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('blob:')) return url; // Let blob URLs render directly
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    if (!url.includes('/w_200')) {
      return url.replace('/upload/', '/upload/w_200,q_auto,f_auto/');
    }
  }
  return url;
}

// Ensure base64 string never lands in custom Supabase columns/attachments tables
async function validateAndResolveCloudinaryUrl(url: string, user: any = null): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:')) {
    console.warn('[Validation] Base64 string detected! Uploading to Cloudinary first...');
    const folder = await getUserCloudinaryFolder(user);
    const uploadedUrl = await uploadToCloudinary(url, folder);
    return uploadedUrl;
  }
  return url;
}

// Persistent caching for cashbooks list
let cachedCashbooks: any[] | null = null;
// Persistent caching for transaction entries: cashbook_id -> Transaction[]
const entriesCache = new Map<string, any[]>();
// Persistent caching for entry fetch timers: cashbook_id -> timestamp
const lastFetchTimeCache = new Map<string, number>();
// Persistent caching for attachments (images): entry_id -> { images: string[], isAi: boolean }
const attachmentCache = new Map<string, { images: string[], isAi: boolean }>();
const revalidatedEntries = new Set<string>();
const inFlightAttachmentQueries = new Map<string, Promise<{ attachments: any[], aiAttachments: any[] }>>();

// Load from localStorage on startup under a namespace like 'trackbook_attachments_metadata_v2'
try {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const savedTimestamp = localStorage.getItem('trackbook_attachments_metadata_v2_timestamp');
  let loadedMeta = true;
  if (savedTimestamp) {
    const timestamp = parseInt(savedTimestamp, 10);
    if (!isNaN(timestamp) && (Date.now() - timestamp > SEVEN_DAYS_MS)) {
      console.log('[Cache] Clearing legacy attachments cache older than 7 days...');
      localStorage.removeItem('trackbook_attachments_metadata_v2');
      localStorage.removeItem('trackbook_attachments_metadata_v2_timestamp');
      loadedMeta = false;
    }
  }

  if (loadedMeta) {
    const savedMeta = localStorage.getItem('trackbook_attachments_metadata_v2');
    if (savedMeta) {
      const parsed = JSON.parse(savedMeta);
      Object.entries(parsed).forEach(([id, val]: [string, any]) => {
        if (val && Array.isArray(val.images)) {
          attachmentCache.set(id, { images: val.images, isAi: !!val.isAi });
        }
      });
      console.log(`[Cache] Preloaded ${attachmentCache.size} item attachment metadata keys from localStorage.`);
    }
  }
  
  if (!localStorage.getItem('trackbook_attachments_metadata_v2_timestamp')) {
    localStorage.setItem('trackbook_attachments_metadata_v2_timestamp', Date.now().toString());
  }
} catch (e) {
  console.error('[Cache] Error loading attachment cache from localStorage:', e);
}

// Helper to save attachmentCache to localStorage
function persistAttachmentCacheToStorage() {
  try {
    const obj: { [key: string]: { images: string[], isAi: boolean } } = {};
    let count = 0;
    attachmentCache.forEach((val, key) => {
      // Limit to 400 keys to avoid hitting localStorage limit of ~5MB
      if (count < 400) {
        obj[key] = val;
        count++;
      }
    });
    localStorage.setItem('trackbook_attachments_metadata_v2', JSON.stringify(obj));
  } catch (e) {
    console.error('[Cache] Error saving attachment cache to localStorage:', e);
  }
}

/**
 * Optimized, memoized, viewport-prefetching and lazy-loaded Image component
 */
const OptimizedImage = React.memo(({
  src,
  alt,
  className,
  type = 'preview',
  onClick,
  ...props
}: {
  src: string;
  alt: string;
  className?: string;
  type?: 'preview' | 'fullscreen';
  onClick?: () => void;
  [key: string]: any;
}) => {
  const isFullscreen = type === 'fullscreen';
  const [isInView, setIsInView] = React.useState(isFullscreen);
  const [retryCount, setRetryCount] = React.useState(0);
  const [hasError, setHasError] = React.useState(false);
  const [localBase64, setLocalBase64] = React.useState<string>('');
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const imgRef = React.useRef<HTMLImageElement | null>(null);

  const metadata = React.useMemo(() => {
    const res = { rotate: 0, fit: 'original' };
    if (!src) return res;
    const hashIdx = src.indexOf('#');
    if (hashIdx === -1) return res;
    const hash = src.substring(hashIdx + 1);
    const params = new URLSearchParams(hash);
    res.rotate = parseInt(params.get('rotate') || '0', 10);
    res.fit = (params.get('fit') || 'original') as 'width' | 'height' | 'original';
    return res;
  }, [src]);

  const isRotated90or270 = metadata.rotate === 90 || metadata.rotate === 270;
  
  const contentStyle: React.CSSProperties = {
    ...props.style,
    transform: `rotate(${metadata.rotate}deg)${isRotated90or270 ? ' scale(0.72)' : ''}`,
    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), object-fit 0.2s ease',
    objectFit: metadata.fit === 'width' ? 'contain' : metadata.fit === 'height' ? 'contain' : (props.style?.objectFit || 'cover')
  };

  React.useEffect(() => {
    setIsLoaded(false);
    setProgress(0);
    if (isFullscreen) {
      setIsInView(true);
    }
  }, [src, isFullscreen]);

  React.useEffect(() => {
    if (src && src.startsWith('local-img-')) {
      let active = true;
      offlineDb.getLocalImage(src).then(img => {
        if (active && img && img.data) {
          setLocalBase64(img.data as string);
        }
      });
      return () => {
        active = false;
      };
    } else {
      setLocalBase64('');
    }
  }, [src]);

  React.useEffect(() => {
    if (!src) return;
    if (isFullscreen) return;
    
    // Fallback if IntersectionObserver is not supported
    if (!('IntersectionObserver' in window)) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // Prefetch when within 200px of viewport
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [src, isFullscreen]);

  React.useEffect(() => {
    if (!isFullscreen || isLoaded || !src) return;

    let intervalId: any;
    intervalId = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) {
          return prev + 1 >= 99 ? 98 : prev + 1;
        }
        const inc = Math.floor(Math.random() * 8) + 4;
        return Math.min(prev + inc, 95);
      });
    }, 45);

    return () => clearInterval(intervalId);
  }, [isFullscreen, isLoaded, src]);

  const optimizedUrl = React.useMemo(() => {
    if (!isInView || hasError) return ''; 
    if (src && src.startsWith('local-img-')) {
      return localBase64;
    }
    const baseUrl = getOptimizedCloudinaryUrl(src, type);
    if (!baseUrl) return '';
    if (retryCount > 0) {
      // Append a retry parameter to bypass cached load attempts that might have failed
      const sep = baseUrl.includes('?') ? '&' : '?';
      return `${baseUrl}${sep}retry=${retryCount}`;
    }
    return baseUrl;
  }, [src, type, isInView, retryCount, hasError, localBase64]);

  const handleError = () => {
    console.warn(`[ImageLoad] Failed to load ${src}. Attempt ${retryCount}/3`);
    if (!navigator.onLine) {
      setHasError(true);
      return;
    }

    if (retryCount < 3) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
      }, (retryCount + 1) * 1500); // 1.5s, 3s, 4.5s backoff
    } else {
      setHasError(true);
    }
  };

  const handleLoad = () => {
    if (isFullscreen) {
      setProgress(100);
      setTimeout(() => {
        setIsLoaded(true);
      }, 100);
    } else {
      setIsLoaded(true);
    }
  };

  // Safe offline / failed visual fallback
  if (hasError || (!src && isInView)) {
    return (
      <div 
        className={cn(
          "flex flex-col items-center justify-center bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-slate-600 p-2 text-center rounded-lg min-h-[100px] select-none",
          className
        )}
        onClick={() => {
          // Allow clicks to re-attempt loader when connection resumes
          setHasError(false);
          setRetryCount(0);
          if (onClick) onClick();
        }}
      >
        <ImageIcon size={20} className="mb-1 text-slate-400 dark:text-zinc-500 opacity-60" />
        <span className="font-bold text-[9px] uppercase tracking-wider">Failed / Offline</span>
        <span className="text-[7px] text-slate-400/80 dark:text-slate-600 mt-0.5">Click to retry</span>
      </div>
    );
  }

  const showLoader = isFullscreen && !isLoaded && optimizedUrl;

  const content = (
    <img
      ref={imgRef}
      src={optimizedUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'}
      alt={alt}
      className={cn(className, isFullscreen && !isLoaded && "opacity-0 invisible")}
      loading={isFullscreen ? "eager" : "lazy"}
      decoding="async"
      onError={handleError}
      onLoad={handleLoad}
      onClick={onClick}
      style={contentStyle}
      {...props}
    />
  );

  if (isFullscreen) {
    return (
      <div className="relative flex items-center justify-center max-w-full max-h-full">
        {content}
        {showLoader && (
          <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-md z-50 animate-fade-in">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="24"
                  className="text-white/10"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="transparent"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="24"
                  className="text-indigo-500 transition-all duration-100 ease-out"
                  strokeWidth="3.5"
                  strokeDasharray={2 * Math.PI * 24}
                  strokeDashoffset={2 * Math.PI * 24 - (progress / 100) * (2 * Math.PI * 24)}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                />
              </svg>
              <span className="absolute text-xs font-black text-white font-mono">{progress}%</span>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-slate-300 font-bold mt-3 animate-pulse">Loading Attachment...</span>
          </div>
        )}
      </div>
    );
  }

  return content;
});
OptimizedImage.displayName = 'OptimizedImage';

// Per-cashbook cached computed balances map: cashbook_id -> Map<transaction_id, number>
const computedBalancesCache = new Map<string, Map<string, number>>();
// Track the transaction keys/IDs list to see if the structure matches: cashbook_id -> string signature
const computedBalancesSignatureCache = new Map<string, string>();

interface CustomVirtualResult {
  startIndex: number;
  endIndex: number;
  paddingTop: number;
  paddingBottom: number;
}

function useVirtualWindow({
  itemsCount,
  itemHeight,
  containerRef,
}: {
  itemsCount: number;
  itemHeight: number;
  containerRef: React.RefObject<HTMLElement | null>;
}): CustomVirtualResult {
  const [scrollY, setScrollY] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);

  useEffect(() => {
    let scrollTicked = false;
    let resizeTicked = false;

    const handleScroll = () => {
      if (!scrollTicked) {
        window.requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          scrollTicked = false;
        });
        scrollTicked = true;
      }
    };

    const handleResize = () => {
      if (!resizeTicked) {
        window.requestAnimationFrame(() => {
          setViewportHeight(window.innerHeight);
          resizeTicked = false;
        });
        resizeTicked = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    // Initial values
    setScrollY(window.scrollY);
    setViewportHeight(window.innerHeight);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const { startIndex, endIndex, paddingTop, paddingBottom } = useMemo(() => {
    const el = containerRef.current;
    if (!el || itemsCount === 0) {
      return { startIndex: 0, endIndex: Math.min(itemsCount - 1, 10), paddingTop: 0, paddingBottom: 0 };
    }

    const rect = el.getBoundingClientRect();
    const containerTop = rect.top + window.scrollY;
    const offset = Math.max(0, scrollY - containerTop);

    // Buffer of 6 elements before and after
    const startIndex = Math.max(0, Math.floor(offset / itemHeight) - 6);
    const endIndex = Math.min(itemsCount - 1, Math.floor((offset + viewportHeight) / itemHeight) + 6);

    const paddingTop = startIndex * itemHeight;
    const paddingBottom = Math.max(0, (itemsCount - 1 - endIndex) * itemHeight);

    return { startIndex, endIndex, paddingTop, paddingBottom };
  }, [scrollY, viewportHeight, itemsCount, itemHeight, containerRef]);

  return {
    startIndex,
    endIndex,
    paddingTop,
    paddingBottom,
  };
}

// Core micro-elements and memoized sub-components
const AttachmentCell = React.memo(({
  images,
  transactionId,
  uploadStatuses,
  handleRetryUpload,
  setPreviewImages,
  setPreviewIndex,
  setPreviewRotation,
  setPreviewZoom,
  theme
}: {
  images: string[] | undefined;
  transactionId: string;
  uploadStatuses: any;
  handleRetryUpload: (blobUrl: string, transactionId: string) => void;
  setPreviewImages: (imgs: string[], transactionId?: string) => void;
  setPreviewIndex: (idx: number) => void;
  setPreviewRotation: (deg: number) => void;
  setPreviewZoom: (zoom: number) => void;
  theme: string;
}) => {
  if (!images || images.length === 0) return null;
  
  const isUploading = images.some(img => {
    const status = uploadStatuses[img]?.status;
    return status === 'uploading' || (img.startsWith('blob:') && status !== 'failed' && status !== 'success');
  });
  
  const isFailed = images.some(img => uploadStatuses[img]?.status === 'failed');
  
  return (
    <div className="relative inline-block group/desktop-attach py-1">
      {isFailed ? (
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            images.forEach(img => {
              if (uploadStatuses[img]?.status === 'failed') {
                handleRetryUpload(img, transactionId);
              }
            });
          }}
          className="flex items-center gap-1.5 text-[10px] font-black tracking-wider text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
        >
          <RotateCw size={11} className="animate-pulse" />
          <div className="text-left">
            <p className="text-[10px] font-black leading-none">RETRY UPLOAD</p>
            <p className="text-[8px] font-bold text-rose-400 mt-0.5">Some uploads failed</p>
          </div>
        </button>
      ) : (
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!isUploading) {
              setPreviewImages(images, transactionId);
              setPreviewIndex(0);
              setPreviewRotation(0);
              setPreviewZoom(1);
            }
          }}
          disabled={isUploading}
          className={cn(
            "flex items-center gap-2 text-left transition-all cursor-pointer group/bill",
            isUploading 
              ? "text-emerald-500 dark:text-emerald-400 animate-pulse pointer-events-none" 
              : "text-slate-500 hover:text-indigo-600"
          )}
        >
          <Paperclip size={14} className={isUploading ? "animate-bounce" : ""} />
          <div className="text-left">
            <p className="text-[10px] font-black leading-none">
              {isUploading ? "Syncing..." : images.length}
            </p>
            <p className={cn(
              "text-[10px] font-bold transition-colors mt-0.5",
              isUploading ? "text-emerald-400" : "text-slate-400 group-hover/bill:text-indigo-400"
            )}>
              {isUploading ? "Uploading attachments..." : `${images.length === 1 ? 'Attachment' : 'Attachments'}`}
            </p>
          </div>
        </button>
      )}
      
      {isUploading && (
        <div className="absolute left-0 right-0 bottom-0 h-[2px] bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
          <div className="absolute top-0 bottom-0 w-[40%] bg-emerald-500 rounded-full animate-progress-smooth" />
        </div>
      )}
    </div>
  );
});
AttachmentCell.displayName = 'AttachmentCell';

const MobileTransactionRow = React.memo(({
  t,
  runningBalance,
  selected,
  isCurrentlyDeleting,
  onTouchStart,
  onTouchEnd,
  onClick,
  uploadStatuses,
  handleRetryUpload,
  setPreviewImages,
  setPreviewIndex,
  setPreviewRotation,
  setPreviewZoom,
  handleEditTransaction,
  handleDeleteTransaction,
  theme,
  index,
  isJustEdited,
  canEdit = true,
  canDelete = true,
  canSelect = true
}: {
  t: Transaction;
  runningBalance: number;
  selected: boolean;
  isCurrentlyDeleting: boolean;
  onTouchStart: (id: string) => void;
  onTouchEnd: () => void;
  onClick: (id: string) => void;
  uploadStatuses: any;
  handleRetryUpload: (blobUrl: string, transactionId: string) => void;
  setPreviewImages: (imgs: string[], transactionId?: string) => void;
  setPreviewIndex: (idx: number) => void;
  setPreviewRotation: (deg: number) => void;
  setPreviewZoom: (zoom: number) => void;
  handleEditTransaction: (t: Transaction) => void;
  handleDeleteTransaction: (id: string) => void;
  theme: string;
  index: number;
  isJustEdited?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canSelect?: boolean;
}) => {
  return (
    <motion.div
      id={`entry-${t.id}`}
      initial={false}
      animate={
        isCurrentlyDeleting 
          ? { opacity: 0, x: -100, scale: 0.9, height: 0, margin: 0, padding: 0 } 
          : isJustEdited
            ? { scale: [1, 1.08, 1.08, 1], y: 0, opacity: 1 }
            : { opacity: 1, y: 0, scale: 1 }
      }
      transition={
        isJustEdited
          ? { duration: 1.5, times: [0, 0.2, 0.8, 1], ease: "easeInOut" }
          : { duration: 0.2, ease: "easeOut" }
      }
      onMouseDown={() => canSelect && onTouchStart(t.id)}
      onMouseUp={canSelect ? onTouchEnd : undefined}
      onTouchStart={() => canSelect && onTouchStart(t.id)}
      onTouchEnd={canSelect ? onTouchEnd : undefined}
      onClick={() => canSelect && onClick(t.id)}
      className={cn(
        "rounded-[20px] border shadow-sm relative transition-all select-none overflow-hidden duration-200",
        canSelect ? "hover:scale-[1.005] cursor-pointer" : "cursor-default",
        isCurrentlyDeleting ? "border-transparent bg-transparent" : "p-4.5 sm:p-5",
        isJustEdited
          ? (theme === 'dark' ? "border-indigo-500 ring-4 ring-indigo-500/40 bg-indigo-950/30 font-bold" : "border-indigo-500 ring-4 ring-indigo-500/30 bg-indigo-50/40 shadow-xl font-bold")
          : selected
            ? (theme === 'dark' ? "border-indigo-500 ring-2 ring-indigo-500/40 bg-indigo-950/20" : "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 shadow-md") 
            : (theme === 'dark' ? "bg-zinc-950 border-zinc-900 hover:border-zinc-800" : "bg-white border-slate-100 hover:border-slate-200")
      )}
    >
      <div className="flex justify-between items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn(
            "px-2.5 py-1 text-[10px] font-black tracking-wider uppercase rounded-lg transition-colors duration-300",
            theme === 'dark' ? "bg-indigo-950 text-indigo-400 border border-indigo-900/30" : "bg-indigo-50 text-indigo-600 border border-indigo-100/30"
          )}>
            {t.category}
          </span>
          <span className={cn(
            "px-2.5 py-1 text-[10px] font-black tracking-wider uppercase rounded-lg transition-colors duration-300",
            theme === 'dark' ? "bg-zinc-900 text-slate-300 border border-zinc-800" : "bg-slate-50 text-slate-500 border border-slate-100"
          )}>
            {t.mode}
          </span>
          {getTransactionSource(t) === 'Imported' && (
            <span className={cn(
              "px-2.5 py-1 text-[10px] font-black tracking-wider uppercase rounded-lg transition-colors shrink-0",
              theme === 'dark' ? "bg-sky-950 text-sky-400 border border-sky-900/30" : "bg-sky-50 text-sky-700 border border-sky-100"
            )}>
              Imported
            </span>
          )}
        </div>
        <div className="text-right flex flex-col items-end">
          <p className={cn(
            "text-base font-black tracking-tight",
            t.type === 'in' ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-450"
          )}>
            {t.type === 'in' ? '+' : '-'}{formatCurrency(t.amount)}
          </p>
          <p className={cn(
            "text-[10px] font-bold tracking-tight mt-0.5 transition-colors duration-300",
            theme === 'dark' ? "text-zinc-500" : "text-slate-400"
          )}>
            Bal: {formatCurrency(runningBalance)}
          </p>
        </div>
      </div>

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <p className={cn(
          "text-[13px] font-semibold leading-relaxed line-clamp-2 transition-colors duration-300 flex-1 min-w-[120px]",
          theme === 'dark' ? "text-slate-200" : "text-slate-850"
        )}>
          {t.description || 'No details provided'}
        </p>
        
        <div className="flex items-center gap-1.5">
          {getTransactionSource(t) === 'AI' && (
            <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-extrabold tracking-wide uppercase px-2 py-0.5 rounded-md flex items-center gap-0.5 shadow-sm border border-amber-500/15">
              <Sparkles size={10} />
              AI
            </div>
          )}
          {t.imageLayout && (
            <div className={cn(
              "text-[9px] font-black px-2 py-0.5 rounded-md shadow-sm uppercase border",
              t.imageLayout === 'merge' 
                ? (theme === 'dark' ? "bg-indigo-950/45 text-indigo-400 border-indigo-900/30" : "bg-indigo-50 text-indigo-600 border-indigo-100")
                : (theme === 'dark' ? "bg-zinc-900 text-slate-400 border-zinc-800" : "bg-slate-50 text-slate-500 border-slate-100")
            )}>
              {t.imageLayout}
            </div>
          )}
        </div>
      </div>

      <div className={cn(
        "flex items-center justify-between pt-3 border-t transition-colors duration-300",
        theme === 'dark' ? "border-zinc-900/60" : "border-slate-100/80"
      )}>
        <div className="flex items-center gap-2">
          {t.images && t.images.length > 0 ? (() => {
            const isUploading = t.images.some(img => {
              const status = uploadStatuses[img]?.status;
              return status === 'uploading' || (img.startsWith('blob:') && status !== 'failed' && status !== 'success');
            });
            const isFailed = t.images.some(img => uploadStatuses[img]?.status === 'failed');
            
            return (
              <div className="relative inline-block py-1">
                {isFailed ? (
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      t.images!.forEach(img => {
                        if (uploadStatuses[img]?.status === 'failed') {
                          handleRetryUpload(img, t.id);
                        }
                      });
                    }}
                    className="flex items-center gap-1 text-[10px] font-extrabold tracking-wide text-rose-500 hover:text-rose-650 transition-colors cursor-pointer"
                  >
                    <RotateCw size={10} className="animate-pulse" />
                    <span>RETRY UPLOAD</span>
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isUploading) {
                        setPreviewImages(t.images!, t.id);
                        setPreviewIndex(0);
                        setPreviewRotation(0);
                        setPreviewZoom(1);
                      }
                    }}
                    disabled={isUploading}
                    className={cn(
                      "flex items-center gap-1 transition-colors duration-300 text-[10px] font-bold cursor-pointer py-0.5 px-2 rounded-lg border",
                      isUploading 
                        ? "text-emerald-500 border-emerald-100/30 bg-emerald-500/5 dark:text-emerald-400 animate-pulse pointer-events-none" 
                        : (theme === 'dark' ? "text-indigo-400 border-indigo-950 bg-indigo-950/10 hover:text-indigo-300" : "text-indigo-650 border-indigo-100 bg-indigo-50/10 hover:text-indigo-700")
                    )}
                  >
                    <Paperclip size={11} className={isUploading ? "animate-bounce" : ""} />
                    <span>
                      {isUploading 
                        ? "Syncing..." 
                        : `${t.images.length} ${t.images.length === 1 ? 'Attachment' : 'Attachments'}`}
                    </span>
                  </button>
                )}
                
                {isUploading && (
                  <div className="absolute left-0 right-0 bottom-0 h-[1.5px] bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-0.5">
                    <div className="absolute top-0 bottom-0 w-[40%] bg-emerald-500 rounded-full animate-progress-smooth" />
                  </div>
                )}
              </div>
            );
          })() : (
            <div className={cn(
              "flex items-center gap-1 transition-colors duration-300",
              theme === 'dark' ? "text-zinc-700" : "text-slate-250"
            )}>
              <Paperclip size={11} />
              <span className="text-[10px] font-black">0</span>
            </div>
          )}
          <span className={cn(
            "transition-colors duration-300",
            theme === 'dark' ? "text-zinc-800" : "text-slate-150"
          )}>•</span>
          <span className={cn(
            "text-[10px] font-bold tracking-tight transition-colors duration-300",
            theme === 'dark' ? "text-zinc-500" : "text-slate-400"
          )}>
            {formatDateTime12h(t.date || t.created_at)}
          </span>
        </div>

        {(canEdit || canDelete) && (
          <div className="flex items-center gap-1.5 shrink-0">
            {canEdit && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleEditTransaction(t); }}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer hover:scale-105 active:scale-90 border shadow-sm",
                  theme === 'dark' ? "bg-zinc-900 border-zinc-850/60 text-slate-400 hover:text-indigo-400" : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100 hover:text-indigo-650"
                )}
                aria-label="Edit Transaction"
              >
                <Pencil size={12.5} />
              </button>
            )}
            {canDelete && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(t.id); }}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer hover:scale-105 active:scale-90 border shadow-sm",
                  theme === 'dark' ? "bg-zinc-900 border-zinc-850/60 text-rose-400 hover:text-rose-500" : "bg-rose-50 border-rose-150 text-rose-500 hover:bg-rose-100 hover:text-rose-650"
                )}
                aria-label="Delete Transaction"
              >
                <Trash2 size={12.5} />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
});
MobileTransactionRow.displayName = 'MobileTransactionRow';

const DesktopTransactionRow = React.memo(({
  t,
  runningBalance,
  selected,
  isCurrentlyDeleting,
  toggleSelectTransaction,
  handleEditTransaction,
  handleDeleteTransaction,
  handleRetryUpload,
  uploadStatuses,
  setPreviewImages,
  setPreviewIndex,
  setPreviewRotation,
  setPreviewZoom,
  theme,
  index,
  isJustEdited,
  canEdit = true,
  canDelete = true,
  canSelect = true
}: {
  t: Transaction;
  runningBalance: number;
  selected: boolean;
  isCurrentlyDeleting: boolean;
  toggleSelectTransaction: (id: string) => void;
  handleEditTransaction: (t: any) => void;
  handleDeleteTransaction: (id: string) => void;
  handleRetryUpload: (blobUrl: string, transactionId: string) => void;
  uploadStatuses: any;
  setPreviewImages: (imgs: string[], transactionId?: string) => void;
  setPreviewIndex: (idx: number) => void;
  setPreviewRotation: (deg: number) => void;
  setPreviewZoom: (zoom: number) => void;
  theme: string;
  index: number;
  isJustEdited?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canSelect?: boolean;
}) => {
  return (
    <motion.tr 
      id={`entry-${t.id}`}
      initial={false}
      animate={
        isCurrentlyDeleting 
          ? { opacity: 0, x: -50, scale: 0.95 } 
          : isJustEdited
            ? { scale: [1, 1.05, 1.05, 1], y: 0, opacity: 1 }
            : { opacity: 1, x: 0, scale: 1, y: 0 }
      }
      transition={
        isJustEdited
          ? { duration: 1.5, times: [0, 0.2, 0.8, 1], ease: "easeInOut" }
          : { duration: 0.2, ease: "easeOut" }
      }
      className={cn(
        "group transition-all",
        isJustEdited
          ? (theme === 'dark' ? "bg-indigo-950/40 border-l-4 border-indigo-500 font-bold" : "bg-indigo-50/50 border-l-4 border-indigo-500 font-bold")
          : theme === 'dark' ? "hover:bg-slate-800/30" : "hover:bg-slate-50/50",
        selected && (theme === 'dark' ? "bg-indigo-900/10" : "bg-indigo-50/50"),
        isCurrentlyDeleting && "pointer-events-none opacity-50"
      )}
    >
      {canSelect && (
        <td className="px-3 sm:px-6 py-4">
          <button 
            type="button"
            onClick={() => toggleSelectTransaction(t.id)}
            className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
              selected
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "border-slate-300 dark:border-slate-700 group-hover:border-indigo-500"
            )}
          >
            {selected && <CheckSquare size={14} />}
          </button>
        </td>
      )}
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
        <p className={cn(
          "font-bold text-sm",
          theme === 'dark' ? "text-slate-200" : "text-slate-800"
        )}>
          {formatDateTime12h(t.date || t.created_at)}
        </p>
      </td>
      <td className="px-3 sm:px-6 py-4 min-w-[120px]">
        <div className="flex items-center gap-2 flex-wrap">
          <div>
            <p className={cn(
              "text-sm font-bold transition-colors duration-300",
              theme === 'dark' ? "text-slate-300" : "text-black"
            )}>{t.description || '--'}</p>
            {/* User name display removed for privacy/clutter reduction */}
          </div>
          {getTransactionSource(t) === 'Imported' && (
            <span className={cn(
              "px-1.5 py-0.5 text-[9px] font-black rounded-full border uppercase shrink-0 transition-all",
              theme === 'dark' ? "bg-sky-950/40 text-sky-400 border-sky-800/40" : "bg-sky-50 text-sky-600 border-sky-200"
            )}>
              Imported
            </span>
          )}
          {getTransactionSource(t) === 'AI' && (
            <span className={cn(
              "px-1.5 py-0.5 text-[9px] font-black rounded-full flex items-center gap-0.5 border",
              theme === 'dark' ? "bg-amber-900/40 text-amber-400 border-amber-800" : "bg-amber-50 text-amber-600 border-amber-200"
            )}>
              <Sparkles size={10} />
              AI
            </span>
          )}
          {t.imageLayout && (
            <span className={cn(
              "px-1.5 py-0.5 text-[9px] font-black rounded-full border uppercase",
              t.imageLayout === 'merge'
                ? (theme === 'dark' ? "bg-indigo-900/40 text-indigo-400" : "bg-indigo-50 text-indigo-600 border-indigo-200")
                : (theme === 'dark' ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-slate-50 text-slate-500 border-slate-200")
            )}>
              {t.imageLayout}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
        <p className={cn(
          "text-sm font-bold transition-colors duration-300",
          theme === 'dark' ? "text-slate-300" : "text-black"
        )}>{t.category}</p>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
        <p className={cn(
          "text-sm font-bold transition-colors duration-300",
          theme === 'dark' ? "text-slate-300" : "text-black"
        )}>{t.mode}</p>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
        <AttachmentCell
          images={t.images}
          transactionId={t.id}
          uploadStatuses={uploadStatuses}
          handleRetryUpload={handleRetryUpload}
          setPreviewImages={setPreviewImages}
          setPreviewIndex={setPreviewIndex}
          setPreviewRotation={setPreviewRotation}
          setPreviewZoom={setPreviewZoom}
          theme={theme}
        />
      </td>
      <td className={cn(
        "px-3 sm:px-6 py-4 text-right font-black whitespace-nowrap tabular-nums",
        t.type === 'in' ? "text-emerald-600" : "text-rose-600",
        "text-xs sm:text-sm"
      )}>
        {formatCurrency(t.amount)}
      </td>
      <td className={cn(
        "px-3 sm:px-6 py-4 text-right font-black transition-colors duration-300 whitespace-nowrap tabular-nums",
        theme === 'dark' ? "text-slate-100" : "text-black",
        "text-xs sm:text-sm"
      )}>
        <span>{formatCurrency(runningBalance)}</span>
      </td>
      <td className="px-3 sm:px-6 py-4">
        {(canEdit || canDelete) ? (
          <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {canEdit && (
              <button 
                type="button"
                onClick={() => handleEditTransaction(t)}
                className={cn(
                  "p-1.5 text-slate-400 rounded-lg transition-all cursor-pointer",
                  theme === 'dark' ? "hover:text-indigo-400 hover:bg-indigo-900/20" : "hover:text-indigo-600 hover:bg-indigo-50"
                )}
                aria-label="Edit Transaction"
              >
                <Pencil size={16} />
              </button>
            )}
            {canDelete && (
              <button 
                type="button"
                onClick={() => handleDeleteTransaction(t.id)}
                className={cn(
                  "p-1.5 text-slate-400 rounded-lg transition-all cursor-pointer",
                  theme === 'dark' ? "hover:text-rose-400 hover:bg-rose-900/20" : "hover:text-rose-600 hover:bg-rose-50"
                )}
                aria-label="Delete Transaction"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ) : (
          <div className="text-center text-slate-300 dark:text-zinc-700 text-xs font-mono">-</div>
        )}
      </td>
    </motion.tr>
  );
});
DesktopTransactionRow.displayName = 'DesktopTransactionRow';

const SummaryCards = React.memo(({ totals, theme }: { totals: { in: number; out: number; net: number }; theme: string }) => {
  return (
    <>
      {/* Mobile Summary Card (Reference Image Style) */}
      <div className={cn(
        "lg:hidden rounded-2xl border shadow-sm overflow-hidden transition-colors duration-300",
        theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-100"
      )}>
        <div className="p-3 px-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className={cn(
              "text-sm font-bold transition-colors duration-300",
              theme === 'dark' ? "text-slate-100" : "text-black"
            )}>Net Balance</h3>
            <p className={cn(
              "font-black transition-colors duration-300",
              theme === 'dark' ? "text-slate-100" : "text-black",
              "text-sm"
            )}>
              {formatCurrency(totals.net)}
            </p>
          </div>
          
          <div className={cn(
            "space-y-1.5 pt-1.5 border-t transition-colors duration-300",
            theme === 'dark' ? "border-zinc-800" : "border-slate-50"
          )}>
            <div className="flex items-center justify-between">
              <p className={cn(
                "text-xs font-bold transition-colors duration-300",
                theme === 'dark' ? "text-slate-400" : "text-slate-500"
              )}>Total In (+)</p>
              <p className={cn(
                "font-black text-emerald-600",
                "text-xs"
              )}>{formatCurrency(totals.in)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className={cn(
                "text-xs font-bold transition-colors duration-300",
                theme === 'dark' ? "text-slate-400" : "text-slate-500"
              )}>Total Out (-)</p>
              <p className={cn(
                "font-black text-rose-600",
                "text-xs"
              )}>{formatCurrency(totals.out)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Balance Cards Row (Desktop Only) */}
      <div className="hidden lg:grid lg:grid-cols-3 w-full gap-4 sm:gap-6">
        <div className={cn(
          "p-6 rounded-3xl border flex items-center gap-4 shadow-sm transition-colors duration-300",
          theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
        )}>
          <div className={cn(
            "p-3 rounded-2xl",
            theme === 'dark' ? "bg-emerald-900/20 text-emerald-400" : "bg-emerald-50 text-emerald-600"
          )}>
            <Plus size={24} />
          </div>
          <div>
            <p className={cn(
              "text-sm font-bold uppercase tracking-wider",
              theme === 'dark' ? "text-slate-400" : "text-slate-500"
            )}>Cash In</p>
            <p className={cn(
              "font-black text-emerald-600 dark:text-emerald-400",
              "text-xl"
            )}>
              {formatCurrency(totals.in)}
            </p>
          </div>
        </div>

        <div className={cn(
          "p-6 rounded-3xl border flex items-center gap-4 shadow-sm transition-colors duration-300",
          theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
        )}>
          <div className={cn(
            "p-3 rounded-2xl",
            theme === 'dark' ? "bg-rose-900/20 text-rose-400" : "bg-rose-50 text-rose-600"
          )}>
            <Minus size={24} />
          </div>
          <div>
            <p className={cn(
              "text-sm font-bold uppercase tracking-wider",
              theme === 'dark' ? "text-slate-400" : "text-slate-500"
            )}>Cash Out</p>
            <p className={cn(
              "font-black text-rose-600 dark:text-rose-400",
              "text-xl"
            )}>
              {formatCurrency(totals.out)}
            </p>
          </div>
        </div>

        <div className={cn(
          "p-6 rounded-3xl border flex items-center gap-4 shadow-sm transition-colors duration-300",
          theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
        )}>
          <div className={cn(
            "p-3 rounded-2xl",
            theme === 'dark' ? "bg-indigo-900/20 text-indigo-400" : "bg-indigo-50 text-indigo-600"
          )}>
            <Wallet size={24} />
          </div>
          <div>
            <p className={cn(
              "text-sm font-bold uppercase tracking-wider",
              theme === 'dark' ? "text-slate-400" : "text-slate-500"
            )}>Net Balance</p>
            <p className={cn(
              "font-black text-indigo-600 dark:text-indigo-400",
              "text-xl"
            )}>
              {formatCurrency(totals.net)}
            </p>
          </div>
        </div>
      </div>
    </>
  );
});
SummaryCards.displayName = 'SummaryCards';

async function fetchAttachmentsDeduplicated(entryIds: string[]): Promise<{ attachments: any[], aiAttachments: any[] }> {
  const sortedIds = [...entryIds].sort();
  const batchKey = sortedIds.join(',');
  
  if (inFlightAttachmentQueries.has(batchKey)) {
    console.log(`[Deduplication] Reusing in-flight attachments query promise for ${entryIds.length} entries.`);
    return inFlightAttachmentQueries.get(batchKey)!;
  }
  
  const queryPromise = (async () => {
    try {
      const startTime = performance.now();
      const [attachmentsRes, aiAttachmentsRes] = await Promise.all([
        supabase.from('attachments').select('entry_id, file_url, created_at, user_name, user_email').in('entry_id', entryIds),
        supabase.from('ai_attachments').select('entry_id, file_url, created_at, user_name, user_email').in('entry_id', entryIds)
      ]);
      const duration = performance.now() - startTime;
      console.log(`[Performance] Attachments load timing: fetched from db in ${duration.toFixed(2)}ms for ${entryIds.length} entries`);
      
      return {
        attachments: attachmentsRes.data || [],
        aiAttachments: aiAttachmentsRes.data || []
      };
    } finally {
      inFlightAttachmentQueries.delete(batchKey);
    }
  })();
  
  inFlightAttachmentQueries.set(batchKey, queryPromise);
  return queryPromise;
}

// Helper to normalize strings for comparison (lower-case, trim, remove double-spaces)
const normalizeString = (str: any): string => {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
};

// Helper to normalize date to YYYY-MM-DD
const normalizeDate = (dateVal: any): string => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (err) {
    return '';
  }
};

// Generator for deterministic entry signature
const getEntrySignature = (t: any): string => {
  const amt = (parseFloat(t.amount) || 0).toFixed(2);
  const type = normalizeString(t.type || 'out');
  const desc = normalizeString(t.description || '');
  const cat = normalizeString(t.category || 'Food');
  const mode = normalizeString(t.mode || 'Cash');
  const dateStr = normalizeDate(t.date);
  const membersCount = t.members_count !== undefined 
    ? t.members_count 
    : (t.member_count !== undefined 
        ? t.member_count 
        : (t.membersCount !== undefined ? t.membersCount : 0));
  return `${amt}_${type}_${desc}_${cat}_${mode}_${dateStr}_${membersCount}`;
};

// Helper to generate deterministic entry signatures
const generateEntriesSignature = (entryIds: string[]): string => {
  const sortedIds = [...entryIds].sort();
  return sortedIds.join('-');
};

// Caching of optimized variants using unified Promises to prevent redundant fetches
const optimizedImageCache = new Map<string, Promise<HTMLImageElement | string>>();

const getOptimizedImage = async (
  imgUrl: string, 
  isCompressedMode: boolean, 
  isStrongCompression: boolean = false
): Promise<HTMLImageElement | string> => {
  // 1. Skip canvas compression if already a lightweight Cloudinary optimized URL
  // "3. ZERO CANVAS RECOMPRESSION FOR ALREADY-OPTIMIZED IMAGES: Skip expensive loop"
  if (imgUrl.includes('cloudinary.com')) {
    return new Promise<HTMLImageElement | string>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(imgUrl);
      img.src = imgUrl;
    });
  }

  // Small local / base64 images under 150KB - skip compression
  if (imgUrl.startsWith('data:image/') && imgUrl.length < 150 * 1024 * 1.33) {
    return new Promise<HTMLImageElement | string>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(imgUrl);
      img.src = imgUrl;
    });
  }

  if (!isCompressedMode) {
    return new Promise<HTMLImageElement | string>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(imgUrl);
      img.src = imgUrl;
    });
  }

  return new Promise<HTMLImageElement | string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        
        if (width <= 0 || height <= 0) {
          resolve(imgUrl);
          return;
        }

        // Resolution Downscaling
        const maxDim = isStrongCompression ? 800 : 900;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imgUrl);
          return;
        }

        // Convert PNG to JPEG & strip EXIF/orientation metadata
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Quality optimization
        const quality = isStrongCompression ? 0.35 : 0.40;

        // 8. REMOVE ALL BASE64 EXPORT PATHS - strictly construct Object URLs
        canvas.toBlob((blob) => {
          if (blob) {
            const blobUrl = URL.createObjectURL(blob);
            const optImg = new Image();
            optImg.onload = () => resolve(optImg);
            optImg.onerror = () => resolve(blobUrl);
            optImg.src = blobUrl;
          } else {
            resolve(imgUrl);
          }
        }, 'image/jpeg', quality);

      } catch (err) {
        console.warn('[PDFCompress] Canvas processing failed, falling back:', err);
        resolve(imgUrl);
      }
    };
    img.onerror = () => {
      resolve(imgUrl);
    };
    img.src = imgUrl;
  });
};

const getCachedOptimizedImage = (
  imgUrl: string, 
  isCompressedMode: boolean, 
  isStrongCompression: boolean,
  onProgress: () => void
): Promise<HTMLImageElement | string> => {
  if (optimizedImageCache.has(imgUrl)) {
    onProgress();
    return optimizedImageCache.get(imgUrl)!;
  }
  
  const promise = (async () => {
    try {
      // 1. Pre-generate lightweight Cloudinary URL representing our aggressive transform choice
      const isHuge = isStrongCompression;
      const preOptimizedUrl = getExportOptimizedCloudinaryUrl(imgUrl, isCompressedMode, isHuge);
      
      const optimized = await getOptimizedImage(preOptimizedUrl, isCompressedMode, isStrongCompression);
      return optimized;
    } catch (err) {
      console.warn('[PDF] Cache loading error fallback:', err);
      return imgUrl;
    }
  })();
  
  optimizedImageCache.set(imgUrl, promise);
  onProgress();
  return promise;
};

const CATEGORIES = ['Food', 'Travel', 'Accommodation', 'Advance', 'Shopping', 'Custom'];
const MODES = ['Card', 'UPI', 'Cash', 'Custom'];
const DURATIONS = ['All', 'Today', 'Yesterday', 'Last Week', 'Custom'];

export function getBookSlug(name: string, id: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug || id;
}

export default function Dashboard({ session, theme, setTheme }: { session: any, theme: 'light' | 'dark', setTheme: React.Dispatch<React.SetStateAction<'light' | 'dark'>> }) {
  const shouldReduceMotion = useReducedMotion();
  // Routing Hooks
  const { bookSlug, tabName } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const bookSlugRef = React.useRef(bookSlug);
  React.useEffect(() => {
    bookSlugRef.current = bookSlug;
  }, [bookSlug]);

  React.useEffect(() => {
    console.log('[DEBUG] DASHBOARD MOUNTED');
    return () => {
      console.log('[DEBUG] DASHBOARD UNMOUNTED');
    };
  }, []);

  const currentTabName = tabName || 'entries';

  // Global State
  const currentUserId = session?.user?.id;
  const initialUserName = session?.user?.user_metadata?.full_name || 
                          session?.user?.user_metadata?.name || 
                          session?.user?.email?.split('@')[0] || 
                          '';

  const [userName, setUserName] = useState(initialUserName);
  const [books, setBooks] = useState<Cashbook[]>(() => {
    try {
      localStorage.removeItem('trackbook_cached_books'); // Purge legacy unscoped cache
      if (currentUserId) {
        const saved = localStorage.getItem(`trackbook_cached_books_${currentUserId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {}
    return [];
  });
  
  const booksLengthRef = useRef(books.length);
  const initialLoadedRef = useRef(false);
  useEffect(() => {
    booksLengthRef.current = books.length;
  }, [books.length]);

  const prevUserIdRef = useRef<string | null>(currentUserId || null);
  useEffect(() => {
    if (currentUserId !== prevUserIdRef.current) {
      prevUserIdRef.current = currentUserId || null;
      if (currentUserId) {
        let cached: Cashbook[] = [];
        try {
          const saved = localStorage.getItem(`trackbook_cached_books_${currentUserId}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) cached = parsed;
          }
        } catch (e) {}
        setBooks(cached);
        setIsLoading(cached.length === 0);
      } else {
        setBooks([]);
        setIsLoading(false);
      }
    }
  }, [currentUserId]);

  const resolveUserDataForAttachments = async () => {
    if (!session?.user) return { id: null, name: "Unknown User", email: "" };
    
    const userId = session.user.id;
    const userEmail = session.user.email || "";
    
    let resolvedName = "";
    
    // 1. Authenticated Profile Name
    try {
      if (supabase) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .maybeSingle();
        if (profile?.full_name) {
          resolvedName = profile.full_name;
        }
      }
    } catch (err) {
      console.warn('[resolveUserDataForAttachments] Failed to fetch profile:', err);
    }
    
    // 2. Google Display Name
    if (!resolvedName) {
      resolvedName = session.user.user_metadata?.full_name || 
                     session.user.user_metadata?.name || 
                     session.user.user_metadata?.display_name || "";
    }
    
    // 3. Email Prefix
    if (!resolvedName && userEmail) {
      resolvedName = userEmail.split('@')[0];
    }
    
    // 4. "Unknown User"
    if (!resolvedName) {
      resolvedName = "Unknown User";
    }
    
    return {
      id: userId,
      name: resolvedName,
      email: userEmail
    };
  };

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpQuery, setHelpQuery] = useState('');
  const [helpResponse, setHelpResponse] = useState('');
  const [isHelpLoading, setIsHelpLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(() => {
    try {
      if (currentUserId) {
        const saved = localStorage.getItem(`trackbook_cached_books_${currentUserId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return false;
        }
      }
    } catch (e) {}
    return true;
  });
  const [activeBookId, setActiveBookIdState] = useState<string | null>(() => {
    if (bookSlug && books.length > 0) {
      const foundBook = books.find(b => getBookSlug(b.name, b.id) === bookSlug || b.id === bookSlug);
      if (foundBook) return foundBook.id;
    }
    return null;
  });
  const [isEntriesLoading, setIsEntriesLoading] = useState(false);
  const [showOfflineDialog, setShowOfflineDialog] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  // Mobile MPIN Security
  const { 
    hasMpin: hasUserMpin, 
    isMobile: isMobileSecurityActive, 
    openCreateModal: openMpinCreateModal, 
    openChangeModal: openMpinChangeModal, 
    openForgotModal: openMpinForgotModal 
  } = useMpinSecurity();

  // Network state observer
  useEffect(() => {
    const handleNetworkChange = (state: any) => {
      const offline = state === 'offline';
      setIsOffline(offline);
      if (offline && booksLengthRef.current === 0) {
        setShowOfflineDialog(true);
      }
    };
    const unsubscribe = syncManager.network.subscribe(handleNetworkChange);
    return () => unsubscribe();
  }, []);

  const setActiveBookId = (id: string | null) => {
    setActiveBookIdState(id);
    if (id) {
      if (!entriesCache.has(id)) {
        setIsEntriesLoading(true);
      } else {
        setIsEntriesLoading(false);
      }
    } else {
      setIsEntriesLoading(false);
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [searchQueryInput, setSearchQueryInput] = useState('');

  // Routing synchronization wrapper
  const handleSelectBook = (id: string | null) => {
    setActiveBookId(id);
    if (id === null) {
      navigate('/cashbooks');
    } else {
      const book = books.find(b => b.id === id);
      if (book) {
        const slug = getBookSlug(book.name, book.id);
        navigate(`/cashbooks/${slug}/entries`);
      } else {
        navigate('/cashbooks');
      }
    }
  };

  // Synchronize route with activeBookId & tabName
  useEffect(() => {
    if (isLoading && books.length === 0) return;

    if (bookSlug && books.length > 0) {
      const foundBook = books.find(b => getBookSlug(b.name, b.id) === bookSlug || b.id === bookSlug);
      if (foundBook) {
        if (activeBookId !== foundBook.id) {
          setActiveBookId(foundBook.id);
        }
      } else {
        // Redirect if slug is invalid
        navigate('/cashbooks', { replace: true });
      }
    } else if (!bookSlug) {
      if (activeBookId !== null) {
        setActiveBookId(null);
      }
      // Redirect home root / to /cashbooks if authenticated
      if (location.pathname === '/') {
        navigate('/cashbooks', { replace: true });
      }
    }
  }, [bookSlug, books, activeBookId, isLoading, location.pathname]);

  // Performance timers
  const lastBookOpenStart = useRef<number | null>(null);
  const initialRenderStart = useRef<number>(performance.now());

  // Debounce logic for general book search
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchQueryInput);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQueryInput]);

  useEffect(() => {
    if (searchQuery === '') {
      setSearchQueryInput('');
    }
  }, [searchQuery]);

  // Initial Render Performance Log
  useEffect(() => {
    const duration = performance.now() - initialRenderStart.current;
    console.log(`[Performance] Initial render completed in ${duration.toFixed(2)}ms`);
  }, []);

  // Set book opening start on selection change
  useEffect(() => {
    if (activeBookId) {
      lastBookOpenStart.current = performance.now();
      console.log(`[Performance] Opening cashbook ID: ${activeBookId}...`);
    } else {
      lastBookOpenStart.current = null;
    }
  }, [activeBookId]);

  // Register backgroundExportManager onReviewAiScan handler
  useEffect(() => {
    backgroundExportManager.onReviewAiScan = (results: any[]) => {
      // Commit any pending deletions immediately before review
      if (pendingActionRef.current) {
        commitPendingDeletion(pendingActionRef.current);
        setUndoAction(null);
        setShowUndoToast(false);
      }

      if (results && results.length > 0) {
        // Map the results to handwrittenQueue structure
        const mappedQueue = results.map(item => ({
          file: item.file,
          result: item.result,
          previewUrl: item.result.cloudinaryUrl || (item.file && item.file.type.startsWith('image/') ? URL.createObjectURL(item.file) : '')
        }));
        
        setHandwrittenQueue(mappedQueue);
        setCurrentQueueIndex(0);
        
        const firstItem = mappedQueue[0];
        setAiAmount(String(firstItem.result.amount));
        setAiMerchant(firstItem.result.merchant || 'Unknown Vendor');
        setAiBillType(firstItem.result.billType || 'Food');
        setAiCategory(firstItem.result.category || 'Food');
        setAiDate(firstItem.result.date || '27-05-2026');
        setAiTime(firstItem.result.time || '12:00 PM');
        setAiMealType(firstItem.result.mealType || '');
        setAiDescription(firstItem.result.description || 'Food Expense');
        setAiOcrConfidence(firstItem.result.ocr_confidence ?? 100);
        setAiOcrDuration(firstItem.result.ocr_duration_ms ?? 0);
        setAiAnalytics(firstItem.result.analytics || null);
        setAiCloudinaryUrl(firstItem.result.cloudinaryUrl || '');
        setAiFile(firstItem.file);
        setAiFilePreviewUrl(firstItem.previewUrl);
        
        setAiWorkflowStep('confirmation');
        setAiConstructionModal('upload');
      }
    };
    
    return () => {
      backgroundExportManager.onReviewAiScan = undefined;
    };
  }, []);


  // Quick Add State and Refs
  const [submitAndAddNew, setSubmitAndAddNew] = useState(false);
  const [quickAddSuccess, setQuickAddSuccess] = useState(false);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  
  // UI State
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showDownloadCenter, setShowDownloadCenter] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isCreatingBook, setIsCreatingBook] = useState(false);

  // Phone linking states
  const [phoneNumberToLink, setPhoneNumberToLink] = useState('');
  const [linkingOtp, setLinkingOtp] = useState('');
  const [linkingOtpSent, setLinkingOtpSent] = useState(false);
  const [linkingMode, setLinkingMode] = useState<'view' | 'link' | 'change'>('view');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(() => {
    try {
      if (currentUserId) {
        const saved = localStorage.getItem(`trackbook_avatar_${currentUserId}`);
        if (saved) return saved;
      }
      return session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture || null;
    } catch (e) {
      return null;
    }
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [userPhoneVerified, setUserPhoneVerified] = useState(false);
  const [userPhoneLinkedAt, setUserPhoneLinkedAt] = useState<string | null>(null);
  const [showPhoneSecurityModal, setShowPhoneSecurityModal] = useState(false);
  const [showPhoneLinkingComingSoon, setShowPhoneLinkingComingSoon] = useState(false);
  const [isAutomationMailConfirmOpen, setIsAutomationMailConfirmOpen] = useState(false);
  const [linkingSelectedCountry, setLinkingSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [profileSandboxMode, setProfileSandboxMode] = useState(false);
  const [isEditingBook, setIsEditingBook] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressModal, setProgressModal] = useState<{
    isOpen: boolean;
    type: 'create' | 'edit';
    progress: number;
    steps: Array<{ label: string; status: 'pending' | 'loading' | 'success' | 'error' }>;
    statusText: string;
    errorMsg: string | null;
    success: boolean;
  } | null>(null);
  const [submittingMessage, setSubmittingMessage] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkTransactionDeleteConfirm, setShowBulkTransactionDeleteConfirm] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [showMergeConfirmDialog, setShowMergeConfirmDialog] = useState(false);
  const [mergeDescription, setMergeDescription] = useState('');
  const [mergeCategory, setMergeCategory] = useState('General');
  const [mergeType, setMergeType] = useState<'in' | 'out'>('out');
  const [isMerging, setIsMerging] = useState(false);
  const [newBookName, setNewBookName] = useState('');
  const [editBookName, setEditBookName] = useState('');
  const [createBookError, setCreateBookError] = useState<string | null>(null);
  const [editBookError, setEditBookError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<'in' | 'out' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingMessage, setUploadingMessage] = useState('Detecting bill...');
  const [showAiWarning, setShowAiWarning] = useState(false);
  const [aiWarningChecked, setAiWarningChecked] = useState(false);
  const [aiConstructionModal, setAiConstructionModal] = useState<'upload' | 'ask' | null>(null);
  const [showDropZone, setShowDropZone] = useState(false);
  const [aiMode, setAiMode] = useState<'split' | 'merge'>('split');
  const [error, setError] = useState<string | null>(null);
  const cancelScanRef = useRef<boolean>(false);
  const [backgroundScanResult, setBackgroundScanResult] = useState<string | null>(null);

  // Intelligent AI TrackBook Upload states
  const [aiWorkflowStep, setAiWorkflowStep] = useState<'group' | 'upload' | 'scanning' | 'confirmation' | 'completion'>('group');
  const [activeAiTaskId, setActiveAiTaskId] = useState<string | null>(null);
  const lastProcessedRef = useRef<number>(0);
  const [aiGroupSize, setAiGroupSize] = useState<number>(1);
  const [showGroupSizeModal, setShowGroupSizeModal] = useState(false);
  const [aiScanStatus, setAiScanStatus] = useState<string>('Analyzing bill...');
  const [aiCurrentStepId, setAiCurrentStepId] = useState<string>('receipt_uploaded');
  const [aiCompletedSteps, setAiCompletedSteps] = useState<string[]>([]);
  const [aiProgress, setAiProgress] = useState<number>(0);
  const [aiTimeRemaining, setAiTimeRemaining] = useState<string>('Updating...');
  const [aiNetworkState, setAiNetworkState] = useState<'good' | 'slow' | 'offline'>('good');
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [aiFilePreviewUrl, setAiFilePreviewUrl] = useState<string>('');
  const [isHandwritten, setIsHandwritten] = useState<boolean>(false);
  const [handwrittenTime, setHandwrittenTime] = useState<string>('12:00 PM');
  const [handwrittenIsFood, setHandwrittenIsFood] = useState<boolean>(true);

  // Handwritten verification queue
  const [handwrittenQueue, setHandwrittenQueue] = useState<Array<{ file: File; result: any; previewUrl: string }>>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(0);
  const [showFullScreenPreview, setShowFullScreenPreview] = useState<boolean>(false);

  // AI Extracted variables for Preview Screen
  const [aiAmount, setAiAmount] = useState<string>('');
  const [aiMerchant, setAiMerchant] = useState<string>('');
  const [aiBillType, setAiBillType] = useState<string>('Food');
  const [aiCategory, setAiCategory] = useState<string>('Food');
  const [aiDate, setAiDate] = useState<string>('');
  const [aiTime, setAiTime] = useState<string>('');
  const [aiMealType, setAiMealType] = useState<string>('');
  const [aiDescription, setAiDescription] = useState<string>('');
  const [aiOcrConfidence, setAiOcrConfidence] = useState<number>(100);
  const [aiOcrDuration, setAiOcrDuration] = useState<number>(0);
  const [aiCloudinaryUrl, setAiCloudinaryUrl] = useState<string>('');

  const [aiAnalytics, setAiAnalytics] = useState<{
    upload_duration_ms?: number;
    ocr_duration_ms?: number;
    ai_duration_ms?: number;
    total_duration_ms?: number;
  } | null>(null);

  const [uploadedCount, setUploadedCount] = useState<number>(() => {
    try {
      const todayKey = `uploaded_count_${new Date().toISOString().split('T')[0]}`;
      return parseInt(localStorage.getItem(todayKey) || '0', 10);
    } catch {
      return 0;
    }
  });

  const [processedCount, setProcessedCount] = useState<number>(() => {
    try {
      const todayKey = `processed_count_${new Date().toISOString().split('T')[0]}`;
      return parseInt(localStorage.getItem(todayKey) || '0', 10);
    } catch {
      return 0;
    }
  });

  const incrementUploadedCount = () => {
    setUploadedCount(prev => {
      const newVal = prev + 1;
      try {
        const todayKey = `uploaded_count_${new Date().toISOString().split('T')[0]}`;
        localStorage.setItem(todayKey, String(newVal));
      } catch (e) {}
      return newVal;
    });
  };

  const incrementProcessedCount = (by: number = 1) => {
    setProcessedCount(prev => {
      const newVal = prev + by;
      try {
        const todayKey = `processed_count_${new Date().toISOString().split('T')[0]}`;
        localStorage.setItem(todayKey, String(newVal));
      } catch (e) {}
      return newVal;
    });
  };

  // Listen to background progress of active AI task
  useEffect(() => {
    if (!activeAiTaskId) return;
    
    lastProcessedRef.current = 0;
    
    const unsubscribe = backgroundExportManager.subscribe(() => {
      const task = backgroundExportManager.getTaskList().find(t => t.id === activeAiTaskId);
      if (task) {
        setAiProgress(task.progress);
        setAiScanStatus(task.message || 'Scanning bill...');
        setAiTimeRemaining(task.aiTimeRemaining || 'Updating...');
        setAiNetworkState(task.networkState || 'good');
        setAiCurrentStepId(task.aiCurrentStepId || 'receipt_uploaded');
        setAiCompletedSteps(task.aiCompletedSteps || []);
        
        if (task.aiProcessedCount !== undefined) {
          const diff = task.aiProcessedCount - lastProcessedRef.current;
          if (diff > 0) {
            incrementProcessedCount(diff);
            lastProcessedRef.current = task.aiProcessedCount;
          }
        }
        
        if (task.status === 'completed') {
          backgroundExportManager.getAiScanResults(activeAiTaskId).then(results => {
            if (results && results.length > 0) {
              if (backgroundExportManager.onReviewAiScan) {
                backgroundExportManager.onReviewAiScan(results);
              }
            } else {
              setAiConstructionModal(null);
            }
            setActiveAiTaskId(null);
          });
        } else if (task.status === 'failed') {
          setAiScanStatus('Scanning failed: ' + (task.error || 'Please try again.'));
          setActiveAiTaskId(null);
          setTimeout(() => {
            setAiConstructionModal(null);
          }, 3500);
        }
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [activeAiTaskId]);

  // Share Entries states
  const [showShareModal, setShowShareModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareError, setShareError] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareExpiryTime, setShareExpiryTime] = useState<number | null>(null);
  const [countdownText, setCountdownText] = useState('');

  // Import Shared Entries states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [importSummary, setImportSummary] = useState('');
  const [transactionSearchQuery, setTransactionSearchQuery] = useState('');
  const [transactionSearchQueryInput, setTransactionSearchQueryInput] = useState('');

  // Highlights and Undo manager states
  const [justEditedTransactionId, setJustEditedTransactionId] = useState<string | null>(null);
  const [justEditedBookId, setJustEditedBookId] = useState<string | null>(null);
  const [undoAction, setUndoAction] = useState<{
    type: 'book' | 'transaction' | 'bulk_books' | 'bulk_transactions';
    data: any;
    originalIndex?: number;
    originalIndexes?: number[];
    parentBookId?: string;
  } | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [undoTimeLeft, setUndoTimeLeft] = useState(8);

  // Keep a ref of undoAction to commit on unmount
  const pendingActionRef = useRef<any>(null);
  useEffect(() => {
    pendingActionRef.current = undoAction;
  }, [undoAction]);

  const commitPendingDeletion = async (action: {
    type: 'book' | 'transaction' | 'bulk_books' | 'bulk_transactions';
    data: any;
    originalIndex?: number;
    originalIndexes?: number[];
    parentBookId?: string;
  }) => {
    if (!supabase || !session) return;
    try {
      if (action.type === 'book') {
        const bookId = action.data.book?.id || action.data.id;
        console.log('[DelayedDelete] Committing book deletion to database:', bookId);
        const { error } = await supabase
          .from('cashbooks')
          .delete()
          .eq('id', bookId)
          .eq('user_id', session.user.id);
        if (error) throw error;
      } else if (action.type === 'bulk_books') {
        const ids = action.data.map((item: any) => item.book.id);
        console.log('[DelayedDelete] Committing bulk book deletion to database:', ids);
        const { error } = await supabase
          .from('cashbooks')
          .delete()
          .in('id', ids)
          .eq('user_id', session.user.id);
        if (error) throw error;
      } else if (action.type === 'transaction') {
        console.log('[DelayedDelete] Committing transaction deletion to database:', action.data.id);
        const { error } = await supabase
          .from('entries')
          .delete()
          .eq('id', action.data.id)
          .eq('user_id', session.user.id);
        if (error) throw error;
      } else if (action.type === 'bulk_transactions') {
        const ids = action.data.map((t: any) => t.id);
        console.log('[DelayedDelete] Committing bulk transaction deletion to database:', ids);
        const { error } = await supabase
          .from('entries')
          .delete()
          .in('id', ids)
          .eq('user_id', session.user.id);
        if (error) throw error;
      }
    } catch (err) {
      console.error('[DelayedDelete] Failure committing database deletion:', err);
    }
  };

  const handleStartUndoableDelete = async (newAction: {
    type: 'book' | 'transaction' | 'bulk_books' | 'bulk_transactions';
    data: any;
    originalIndex?: number;
    originalIndexes?: number[];
    parentBookId?: string;
  }) => {
    // If there is an existing pending deletion, commit it now!
    if (pendingActionRef.current) {
      await commitPendingDeletion(pendingActionRef.current);
    }
    setUndoAction(newAction);
    setUndoTimeLeft(8);
    setShowUndoToast(true);
  };

  // Commit on unmount
  useEffect(() => {
    return () => {
      if (pendingActionRef.current) {
        commitPendingDeletion(pendingActionRef.current);
      }
    };
  }, []);

  // Lock body scroll when transaction form is visible (prevents underlying scroll)
  useEffect(() => {
    if (showForm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showForm]);

  // Undo Timer Countdown logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showUndoToast && undoTimeLeft > 0) {
      timer = setTimeout(() => {
        setUndoTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (showUndoToast && undoTimeLeft === 0) {
      if (undoAction) {
        commitPendingDeletion(undoAction);
      }
      setShowUndoToast(false);
      setUndoAction(null);
    }
    return () => clearTimeout(timer);
  }, [showUndoToast, undoTimeLeft, undoAction]);

  // Debounce logic for active book transaction search
  useEffect(() => {
    const handler = setTimeout(() => {
      setTransactionSearchQuery(transactionSearchQueryInput);
    }, 250);
    return () => clearTimeout(handler);
  }, [transactionSearchQueryInput]);

  useEffect(() => {
    if (transactionSearchQuery === '') {
      setTransactionSearchQueryInput('');
    }
  }, [transactionSearchQuery]);

  // Periodic db cleanup of expired share entries and countdown state timer
  useEffect(() => {
    if (!supabase || !session) return;
    
    const runCleanup = async () => {
      try {
        const { error } = await supabase
          .from('shared_entries')
          .delete()
          .lt('expires_at', new Date().toISOString());
        if (error) {
          console.warn('[Cleanup] Failed to clean up expired share codes:', error);
        } else {
          console.log('[Cleanup] Expired share codes cleaned up successfully.');
        }
      } catch (err) {
        console.error('[Cleanup] Error in cleanupExpiredShareCodes:', err);
      }
    };

    runCleanup();
    const intervalId = setInterval(runCleanup, 60000); // Check and delete expired codes every minute
    return () => clearInterval(intervalId);
  }, [session]);

  const [restoredMessage, setRestoredMessage] = useState('');

  // Active share session restoration and sync
  useEffect(() => {
    if (!activeBookId) {
      setGeneratedCode('');
      setShareExpiryTime(null);
      setCountdownText('');
      return;
    }
    
    const savedSessionStr = localStorage.getItem(`trackbook_share_session_${activeBookId}`);
    if (savedSessionStr) {
      try {
        const savedSession = JSON.parse(savedSessionStr);
        if (savedSession && savedSession.code && savedSession.expiry) {
          const expiryNum = parseInt(savedSession.expiry, 10);
          if (expiryNum > Date.now()) {
            setGeneratedCode(savedSession.code);
            setShareExpiryTime(expiryNum);
            setRestoredMessage("Active share session restored");
            const timer = setTimeout(() => setRestoredMessage(''), 20000);
            return () => clearTimeout(timer);
          } else {
            localStorage.removeItem(`trackbook_share_session_${activeBookId}`);
          }
        }
      } catch (e) {
        console.error('Error parsing saved share session', e);
      }
    }
    
    setGeneratedCode('');
    setShareExpiryTime(null);
    setCountdownText('');
  }, [activeBookId]);

  // Clean up import states when showImportModal toggles
  useEffect(() => {
    if (!showImportModal) {
      setImportCode('');
      setImportError('');
      setImportSummary('');
      setImportSuccess(false);
    }
  }, [showImportModal]);

  useEffect(() => {
    if (!shareExpiryTime) {
      setCountdownText('');
      return;
    }
    
    const updateCountdown = () => {
      const remaining = shareExpiryTime - Date.now();
      if (remaining <= 0) {
        setCountdownText('Share code expired');
        if (activeBookId) {
          localStorage.removeItem(`trackbook_share_session_${activeBookId}`);
        }
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setCountdownText(`Code expires in ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      }
    };
    
    updateCountdown();
    const intervalId = setInterval(updateCountdown, 1000);
    return () => clearInterval(intervalId);
  }, [shareExpiryTime, activeBookId]);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<'all' | 'in' | 'out'>('all');
  const [transactionDurationFilter, setTransactionDurationFilter] = useState('All');
  const getTodayDateString = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const [customFilterDate, setCustomFilterDate] = useState<string>(getTodayDateString());
  const [transactionCategoryFilter, setTransactionCategoryFilter] = useState('All');
  const [sortColumn, setSortColumn] = useState<'date' | 'category' | 'amount'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showReportsMenu, setShowReportsMenu] = useState(false);
  const [showBookMenu, setShowBookMenu] = useState(false);
  const bookMenuRef = useRef<HTMLDivElement>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [showDuplicateAiWarning, setShowDuplicateAiWarning] = useState<{ onConfirm: () => void; onCancel: () => void } | null>(null);
  const [currentSection, setCurrentSection] = useState<'dashboard' | 'cashbooks' | 'processing-center' | 'ai-upload' | 'exports' | 'imports' | 'shared-entries' | 'settings'>('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [exportTasks, setExportTasks] = useState<any[]>(backgroundExportManager.getTaskList());

  useEffect(() => {
    const unsubscribe = backgroundExportManager.subscribe(() => {
      setExportTasks(backgroundExportManager.getTaskList());
    });
    return () => unsubscribe();
  }, []);

  const handleClearData = async () => {
    try {
      await backgroundExportManager.clearAllData();
      await syncManager.db.clearAllData();
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    } catch (e) {
      console.error('Error clearing data:', e);
    }
  };

  const handleSaveProfileName = async () => {
    if (!supabase || !session?.user) return;
    try {
      await supabase.auth.updateUser({
        data: { full_name: userName, avatar_url: userAvatarUrl }
      });
      try {
        await supabase.from('profiles').upsert({
          id: session.user.id,
          email: session.user.email || null,
          full_name: userName,
          avatar_url: userAvatarUrl,
          phone: session.user.phone || null,
          phone_verified: session.user.phone_confirmed_at ? true : false,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      } catch (dbErr) {
        console.warn('Profiles table sync failed:', dbErr);
      }
    } catch (err) {
      console.error('Error saving profile name:', err);
    }
  };

  const handleLinkPhoneStub = async (phone: string) => {
    setUserPhone(phone);
    setShowPhoneLinkingComingSoon(true);
    return true;
  };

  const handleVerifyOtpStub = async (otp: string) => {
    setUserPhoneVerified(true);
    return true;
  };
  const [previewTransactionId, setPreviewTransactionId] = useState<string | null>(null);
  const [animatingDeleteId, setAnimatingDeleteId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, {
    status: 'uploading' | 'success' | 'failed';
    error?: string;
    progress?: number;
  }>>({});
  const imageFilesRef = useRef<Record<string, File>>({});
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const bookLongPressTimer = useRef<NodeJS.Timeout | null>(null);
  
  const toggleSort = (column: 'date' | 'category' | 'amount') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    vibrate(30);
  };

  // Set isEntriesLoading to true immediately on activeBookId changes only if cache is missing
  useEffect(() => {
    if (activeBookId) {
      if (!entriesCache.has(activeBookId)) {
        setIsEntriesLoading(true);
      } else {
        setIsEntriesLoading(false);
      }
    } else {
      setIsEntriesLoading(false);
    }
  }, [activeBookId]);

  const handleTransactionPress = (id: string) => {
    if (selectedTransactions.size > 0) {
      toggleSelectTransaction(id);
    }
  };

  const handleTransactionLongPress = (id: string) => {
    if (selectedTransactions.size === 0) {
      toggleSelectTransaction(id);
      vibrate(50);
    }
  };

  const onTouchStart = (id: string) => {
    longPressTimer.current = setTimeout(() => {
      handleTransactionLongPress(id);
    }, 1200); // 1.2 seconds (or 1200ms) for long press on mobile/touch devices
  };

  const onTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const toggleSelectBook = (id: string) => {
    const newSelected = new Set(selectedBooks);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedBooks(newSelected);
  };

  const handleBookPress = (id: string) => {
    if (selectedBooks.size > 0) {
      toggleSelectBook(id);
    } else {
      handleSelectBook(id);
    }
  };

  const handleBookLongPress = (id: string) => {
    if (selectedBooks.size === 0) {
      toggleSelectBook(id);
      vibrate(50);
    }
  };

  const onTouchStartBook = (id: string) => {
    bookLongPressTimer.current = setTimeout(() => {
      handleBookLongPress(id);
    }, 500);
  };

  const onTouchEndBook = () => {
    if (bookLongPressTimer.current) {
      clearTimeout(bookLongPressTimer.current);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    let lastKey = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input or textarea
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA' || (activeElement as HTMLElement)?.isContentEditable;
      if (isInput && e.key !== 'Escape') return;

      const key = e.key.toUpperCase();
      const now = Date.now();

      // Handle Escape key to close forms/modals
      if (e.key === 'Escape') {
        setShowForm(null);
        setIsCreatingBook(false);
        setIsEditingName(false);
        setIsHelpOpen(false);
        setShowAiWarning(false);
        setAiConstructionModal(null);
        setShowReportsMenu(false);
        setShowBulkDeleteConfirm(false);
        setShowExitConfirm(false);
        setEditingTransaction(null);
        setPreviewImages(null);
        setShowImportModal(false);
        lastKey = '';
        return;
      }

      // Clear last key if too much time passed (e.g. 1 second)
      if (now - lastKeyTime > 1000) {
        lastKey = '';
      }

      if (lastKey === 'C') {
        if (key === 'B') {
          e.preventDefault();
          setIsCreatingBook(true);
          lastKey = '';
        } else if (key === 'I' && activeBookId && canAddEntries(currentUserRole)) {
          e.preventDefault();
          setShowForm('in');
          setTransactionDate(safeToDateTimeLocal(new Date()));
          lastKey = '';
        } else if (key === 'O' && activeBookId && canAddEntries(currentUserRole)) {
          e.preventDefault();
          setShowForm('out');
          setTransactionDate(safeToDateTimeLocal(new Date()));
          lastKey = '';
        }
      } else if (lastKey === 'A') {
        if (key === 'U' && activeBookId && canAddEntries(currentUserRole)) {
          e.preventDefault();
          setShowAiWarning(true);
          lastKey = '';
        }
      } else if (lastKey === 'I') {
        if (key === 'M' && canAddEntries(currentUserRole)) {
          e.preventDefault();
          setShowImportModal(true);
          setImportCode('');
          setImportError('');
          setImportSuccess(false);
          lastKey = '';
        }
      }

      lastKey = key;
      lastKeyTime = now;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeBookId]);

  const toggleTheme = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };



  const moveImage = (index: number, direction: 'up' | 'down') => {
    const newImages = [...selectedImages];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newImages.length) return;
    
    const temp = newImages[index];
    newImages[index] = newImages[newIndex];
    newImages[newIndex] = temp;
    setSelectedImages(newImages);
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [previewImages, setPreviewImages] = useState<string[] | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewRotation, setPreviewRotation] = useState(0);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewOriginalUrls, setPreviewOriginalUrls] = useState<string[]>([]);
  const [previewValidationStatus, setPreviewValidationStatus] = useState<boolean[]>([]);
  const [isPreviewValidating, setIsPreviewValidating] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const getTransactionSeqNumber = (txId: string) => {
    if (!activeBook || !activeBook.transactions) return 1;
    // Sort transactions chronologically (oldest to newest)
    const sorted = [...activeBook.transactions].sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    });
    const index = sorted.findIndex(t => t.id === txId);
    return index !== -1 ? index + 1 : 1;
  };

  const getExtensionFromUrl = (url: string) => {
    if (!url) return 'png';
    const cleanUrl = url.split('?')[0].split('#')[0];
    const parts = cleanUrl.split('.');
    if (parts.length > 1) {
      const ext = parts[parts.length - 1].toLowerCase();
      if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf'].includes(ext)) {
        return ext;
      }
    }
    return 'png';
  };

  const getDownloadFileName = () => {
    const url = previewOriginalUrls[previewIndex] || previewImages?.[previewIndex] || '';
    const ext = getExtensionFromUrl(url);
    if (previewTransactionId) {
      const seqNum = getTransactionSeqNumber(previewTransactionId);
      return `attachment_${seqNum}.${ext}`;
    }
    return `attachment_${previewIndex + 1}.${ext}`;
  };

  const handleDownloadAttachment = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const url = previewOriginalUrls[previewIndex] || previewImages?.[previewIndex];
    if (!url) return;
    
    const filename = getDownloadFileName();
    
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Fetch download failed, falling back to direct link download attribute", err);
      const link = document.createElement('a');
      link.href = url;
      link.target = "_blank";
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleOpenPreview = async (originalUrls: string[], transactionId?: string) => {
    if (!originalUrls || originalUrls.length === 0) return;
    
    setIsPreviewValidating(true);
    setPreviewError(null);
    setPreviewOriginalUrls(originalUrls);
    setPreviewTransactionId(transactionId || null);
    
    const resolvedUrls = originalUrls.map(url => resolveAttachmentUrl(url, 'fullscreen'));
    setPreviewImages(resolvedUrls);
    setPreviewIndex(0);
    setPreviewRotation(0);
    setPreviewZoom(1);

    const statuses = await Promise.all(
      resolvedUrls.map(async (url) => {
        if (!url) return false;
        if (url.startsWith('data:') || url.startsWith('blob:')) return true;
        return new Promise<boolean>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.referrerPolicy = 'no-referrer';
          const timeout = setTimeout(() => {
            img.onload = null;
            img.onerror = null;
            resolve(false);
          }, 8000);
          img.onload = () => {
            clearTimeout(timeout);
            resolve(true);
          };
          img.onerror = () => {
            clearTimeout(timeout);
            resolve(false);
          };
          img.src = url;
        });
      })
    );

    setPreviewValidationStatus(statuses);
    setIsPreviewValidating(false);

    const someFailed = statuses.some(s => !s);
    if (someFailed) {
      setPreviewError("This receipt couldn't be previewed.");
    }
  };

  const handleClosePreview = () => {
    setPreviewImages(null);
    setPreviewOriginalUrls([]);
    setPreviewValidationStatus([]);
    setIsPreviewValidating(false);
    setPreviewError(null);
    setPreviewTransactionId(null);
  };

  const handleRetryPreview = async (index: number) => {
    setIsPreviewValidating(true);
    const originalUrl = previewOriginalUrls[index];
    const resolvedUrl = resolveAttachmentUrl(originalUrl, 'fullscreen');

    const isValid = await new Promise<boolean>((resolve) => {
      if (!resolvedUrl) return resolve(false);
      if (resolvedUrl.startsWith('data:') || resolvedUrl.startsWith('blob:')) return resolve(true);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      const timeout = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        resolve(false);
      }, 8000);
      img.onload = () => {
        clearTimeout(timeout);
        resolve(true);
      };
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
      img.src = resolvedUrl;
    });

    setPreviewValidationStatus(prev => {
      const copy = [...prev];
      copy[index] = isValid;
      return copy;
    });
    setIsPreviewValidating(false);

    const anyFailed = previewValidationStatus.some((s, idx) => idx === index ? !isValid : !s);
    if (!anyFailed) {
      setPreviewError(null);
    } else {
      setPreviewError("This receipt couldn't be previewed.");
    }
  };

  const handleOpenOriginal = (index: number) => {
    const originalUrl = previewOriginalUrls[index];
    if (originalUrl) {
      window.open(originalUrl, '_blank');
    }
  };
  const [reportLoading, setReportLoading] = useState<{ type: 'excel' | 'pdf', progress: number, message?: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiOcrFileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [activeUploadTarget, setActiveUploadTarget] = useState<'ai' | 'transaction' | null>(null);

  const handleAiOcrFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).slice(0, 5);
      setSelectedFiles(files);
      startAiUploadReceiptParsing(files);
    }
    if (e.target) e.target.value = '';
  };

  const triggerUploadSelector = (target: 'ai' | 'transaction') => {
    if (window.innerWidth < 768) {
      setActiveUploadTarget(target);
      setIsMediaPickerOpen(true);
    } else {
      if (target === 'ai') {
        fileInputRef.current?.click();
      } else {
        multiFileInputRef.current?.click();
      }
    }
  };
  const dropdownRef = useRef<HTMLDivElement>(null);
  const reportsRef = useRef<HTMLDivElement>(null);

  const desktopTableRef = useRef<HTMLTableSectionElement | null>(null);
  const mobileContainerRef = useRef<HTMLDivElement | null>(null);



  // Form states for transaction
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food');
  const [customCategory, setCustomCategory] = useState('');
  const [mode, setMode] = useState('Cash');
  const [customMode, setCustomMode] = useState('');
  const safeToISOString = (date: Date | string | number) => {
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return new Date().toISOString();
      return d.toISOString();
    } catch (e) {
      return new Date().toISOString();
    }
  };

  const parseAIDate = (dateStr: string | undefined): Date => {
    if (!dateStr) return new Date();
    
    // Handle DD-MM-YYYY
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
      const year = parseInt(parts[2]);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    
    // Fallback to standard parsing
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const safeToDateTimeLocal = (date: Date | string | number) => {
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        const now = new Date();
        const offset = now.getTimezoneOffset();
        const localized = new Date(now.getTime() - offset * 60 * 1000);
        return localized.toISOString().slice(0, 16);
      }
      const offset = d.getTimezoneOffset();
      const localized = new Date(d.getTime() - offset * 60 * 1000);
      return localized.toISOString().slice(0, 16);
    } catch (e) {
      const now = new Date();
      const offset = now.getTimezoneOffset();
      const localized = new Date(now.getTime() - offset * 60 * 1000);
      return localized.toISOString().slice(0, 16);
    }
  };

  const safeUUID = () => {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
    } catch (e) {}
    // RFC4122 v4 compliant UUID generator fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const [transactionDate, setTransactionDate] = useState(safeToDateTimeLocal(new Date()));
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [imageLayout, setImageLayout] = useState<'split' | 'merge'>('split');
  const [selectedFormatIndex, setSelectedFormatIndex] = useState<number>(0);

  const [editorState, setEditorState] = useState<{
    file: File;
    onDone: (editedFile: File) => void;
    onCancel: () => void;
  } | null>(null);

  const editImagesIfNeeded = async (files: File[]): Promise<File[]> => {
    const editedFiles: File[] = [];
    for (const file of files) {
      if (file.type && file.type.startsWith('image/')) {
        const edited = await new Promise<File | null>((resolve) => {
          setEditorState({
            file,
            onDone: (newFile) => resolve(newFile),
            onCancel: () => resolve(null),
          });
        });
        if (edited) {
          editedFiles.push(edited);
        }
      } else {
        editedFiles.push(file);
      }
    }
    return editedFiles;
  };

  const [isEditingLoading, setIsEditingLoading] = useState<boolean>(false);

  const handleReeditImage = async () => {
    if (selectedImages.length === 0 || selectedFormatIndex < 0 || selectedFormatIndex >= selectedImages.length) return;
    const url = selectedImages[selectedFormatIndex];
    let fileToEdit: File | null = null;
    
    const cleanUrl = url.includes('#') ? url.substring(0, url.indexOf('#')) : url;
    
    if (cleanUrl.startsWith('blob:') && imageFilesRef.current[cleanUrl]) {
      fileToEdit = imageFilesRef.current[cleanUrl];
    } else {
      setIsEditingLoading(true);
      try {
        const resolvedUrl = resolveAttachmentUrl ? resolveAttachmentUrl(cleanUrl, 'fullscreen') : cleanUrl;
        const response = await fetch(resolvedUrl);
        const blob = await response.blob();
        const filename = cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1) || 'attachment.jpg';
        fileToEdit = new File([blob], filename, { type: blob.type || 'image/jpeg' });
      } catch (err) {
        console.error("Error downloading image for editing:", err);
      } finally {
        setIsEditingLoading(false);
      }
    }

    if (fileToEdit) {
      setEditorState({
        file: fileToEdit,
        onDone: (editedFile) => {
          const newUrl = URL.createObjectURL(editedFile);
          imageFilesRef.current[newUrl] = editedFile;
          
          setSelectedImages(prev => {
            const updated = [...prev];
            updated[selectedFormatIndex] = newUrl;
            return updated;
          });
        },
        onCancel: () => {}
      });
    }
  };

  // Keep selectedFormatIndex in bounds
  useEffect(() => {
    if (selectedImages.length === 0) {
      setSelectedFormatIndex(0);
    } else if (selectedFormatIndex >= selectedImages.length) {
      setSelectedFormatIndex(selectedImages.length - 1);
    }
  }, [selectedImages, selectedFormatIndex]);

  const updateImageMetadata = (index: number, rotateOffset: number, fitMode?: 'width' | 'height' | 'original', reset?: boolean) => {
    if (index < 0 || index >= selectedImages.length) return;
    const currentUrl = selectedImages[index];
    const hashIdx = currentUrl.indexOf('#');
    const hash = hashIdx !== -1 ? currentUrl.substring(hashIdx + 1) : '';
    const baseUrl = hashIdx !== -1 ? currentUrl.substring(0, hashIdx) : currentUrl;
    
    const params = new URLSearchParams(hash);
    let currentRotate = parseInt(params.get('rotate') || '0', 10);
    let currentFit = params.get('fit') || 'original';
    
    if (reset) {
      currentRotate = 0;
      currentFit = 'original';
    } else {
      if (rotateOffset !== 0) {
        currentRotate = (currentRotate + rotateOffset + 360) % 360;
      }
      if (fitMode) {
        currentFit = fitMode;
      }
    }
    
    const newParams = new URLSearchParams();
    if (currentRotate !== 0) {
      newParams.set('rotate', currentRotate.toString());
    }
    if (currentFit !== 'original') {
      newParams.set('fit', currentFit);
    }
    
    const newHash = newParams.toString();
    const newUrl = baseUrl + (newHash ? '#' + newHash : '');
    
    setSelectedImages(prev => {
      const copy = [...prev];
      copy[index] = newUrl;
      return copy;
    });
  };

  // Restrict merge layout - automatically fallback to split if there are less than 2 images and we aren't currently editing an existing transaction
  useEffect(() => {
    if (editingTransaction) return; // Prevent overwriting stored imageLayout when opening edit details!
    if (selectedImages.length < 2 && imageLayout === 'merge') {
      setImageLayout('split');
    }
  }, [selectedImages, imageLayout, editingTransaction]);

  // Clear selected transactions when exiting a book to avoid leaking selection bar onto book homepage
  useEffect(() => {
    if (!activeBookId) {
      setSelectedTransactions(new Set());
    }
  }, [activeBookId]);

  // Set user name, phone and avatar from session & profiles database
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!supabase || !session?.user) return;
      try {
        let avatarFromMeta = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null;
        
        const { data, error } = await supabase
          .from('profiles')
          .select('phone, full_name, phone_verified, phone_linked_at, avatar_url')
          .eq('id', session.user.id)
          .maybeSingle();
        
        if (data) {
          if (data.phone) {
            setUserPhone(data.phone);
          } else {
            setUserPhone(session.user.phone || null);
          }
          setUserPhoneVerified(!!data.phone_verified);
          setUserPhoneLinkedAt(data.phone_linked_at || null);
          if (data.full_name) {
            setUserName(data.full_name);
          } else if (session.user.user_metadata?.full_name) {
            setUserName(session.user.user_metadata.full_name);
          }
          if (data.avatar_url) {
            setUserAvatarUrl(data.avatar_url);
            try { 
              localStorage.setItem(`trackbook_avatar_${session.user.id}`, data.avatar_url);
              localStorage.removeItem('trackbook_avatar');
            } catch (e) {}
          } else if (avatarFromMeta) {
            setUserAvatarUrl(avatarFromMeta);
            try { 
              localStorage.setItem(`trackbook_avatar_${session.user.id}`, avatarFromMeta);
              localStorage.removeItem('trackbook_avatar');
            } catch (e) {}
          }
        } else {
          setUserPhone(session.user.phone || null);
          setUserPhoneVerified(!!session.user.phone_confirmed_at);
          setUserPhoneLinkedAt(session.user.phone_confirmed_at || null);
          if (session.user.user_metadata?.full_name) {
            setUserName(session.user.user_metadata.full_name);
          }
          if (avatarFromMeta) {
            setUserAvatarUrl(avatarFromMeta);
            try { 
              localStorage.setItem(`trackbook_avatar_${session.user.id}`, avatarFromMeta);
              localStorage.removeItem('trackbook_avatar');
            } catch (e) {}
          }
        }
      } catch (err) {
        console.error('Error fetching profile in useEffect:', err);
        setUserPhone(session.user.phone || null);
        setUserPhoneVerified(!!session.user.phone_confirmed_at);
        setUserPhoneLinkedAt(session.user.phone_confirmed_at || null);
        if (session.user.user_metadata?.full_name) {
          setUserName(session.user.user_metadata.full_name);
        }
        const avatarFromMeta = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null;
        if (avatarFromMeta) {
          setUserAvatarUrl(avatarFromMeta);
          try {
            localStorage.setItem(`trackbook_avatar_${session.user.id}`, avatarFromMeta);
            localStorage.removeItem('trackbook_avatar');
          } catch (e) {}
        }
      }
    };
    
    if (session) {
      fetchProfileData();
    }
  }, [session]);

  // Stable component-level data fetch and sync function
  const fetchData = useCallback(async (force: boolean = false) => {
    if (!session || !supabase) {
      setBooks([]);
      setIsLoading(false);
      return;
    }

    if (force) {
      console.log('[DEBUG] QUERY INVALIDATED');
    }

    // Only trigger full-screen loading spinner on very initial load if no cached books
    if (!initialLoadedRef.current && booksLengthRef.current === 0) {
      setIsLoading(true);
    }
    try {
      console.log('[fetchData] Loading cashbooks and entries...');
      const userEmail = session.user.email ? session.user.email.toLowerCase() : '';
      let rawCashbooksList: any[] = [];

      // 1. Fetch all user cashbooks (owned + member/joined) via RBAC Service Backend
      try {
        const rbacRes = await fetch(`/api/rbac/user-cashbooks?userId=${session.user.id}&userEmail=${encodeURIComponent(userEmail)}`);
        if (rbacRes.ok) {
          const rbacJson = await rbacRes.json();
          if (rbacJson.success && Array.isArray(rbacJson.cashbooks)) {
            rawCashbooksList = rbacJson.cashbooks;
          }
        }
      } catch (rbacErr) {
        console.warn('[Dashboard] Error calling rbac user-cashbooks:', rbacErr);
      }

      // 2. Direct Supabase fallback / merge for owned cashbooks
      try {
        const { data: rawOwnedCashbooks } = await supabase
          .from('cashbooks')
          .select('*')
          .eq('user_id', session.user.id);

        if (rawOwnedCashbooks && rawOwnedCashbooks.length > 0) {
          const existingIds = new Set(rawCashbooksList.map(c => c.id));
          for (const cb of rawOwnedCashbooks) {
            if (!existingIds.has(cb.id)) {
              rawCashbooksList.push(cb);
            }
          }
        }
      } catch (cbErr) {
        console.warn('[Dashboard] Direct owned cashbooks query note:', cbErr);
      }

      // 3. Direct Supabase query for cashbook_members in case there are additional member cashbooks
      try {
        const { data: memberRows } = await supabase
          .from('cashbook_members')
          .select('cashbook_id')
          .or(`user_id.eq.${session.user.id},email.ilike.${userEmail}`)
          .in('status', ['Active', 'active', 'Accepted', 'accepted']);

        if (memberRows && memberRows.length > 0) {
          const existingIds = new Set(rawCashbooksList.map(c => c.id));
          const missingIds = memberRows.map(m => m.cashbook_id).filter(id => id && !existingIds.has(id));

          if (missingIds.length > 0) {
            const { data: memberCashbooks } = await supabase
              .from('cashbooks')
              .select('*')
              .in('id', missingIds);

            if (memberCashbooks && memberCashbooks.length > 0) {
              rawCashbooksList = [...rawCashbooksList, ...memberCashbooks];
            }
          }
        }
      } catch (memFetchErr) {
        console.warn('[Dashboard] Direct cashbook_members query note:', memFetchErr);
      }

      // Extract pending undo deletion IDs to prevent deleted items from reappearing before commit
      const pending = pendingActionRef.current;
      const pendingBookIds = new Set<string>();
      const pendingEntryIds = new Set<string>();

      if (pending) {
        if (pending.type === 'book') {
          const id = pending.data?.book?.id || pending.data?.id;
          if (id) pendingBookIds.add(id);
        } else if (pending.type === 'bulk_books') {
          if (Array.isArray(pending.data)) {
            pending.data.forEach((item: any) => {
              const id = item?.book?.id || item?.id;
              if (id) pendingBookIds.add(id);
            });
          }
        } else if (pending.type === 'transaction') {
          const id = pending.data?.id;
          if (id) pendingEntryIds.add(id);
        } else if (pending.type === 'bulk_transactions') {
          if (Array.isArray(pending.data)) {
            pending.data.forEach((item: any) => {
              if (item?.id) pendingEntryIds.add(item.id);
            });
          }
        }
      }

      const cashbooks = (rawCashbooksList || []).filter(cb => cb && cb.id && !pendingBookIds.has(cb.id));

      if (cashbooks && cashbooks.length > 0) {
        // Fetch all entries for these cashbooks in a single query
        const cashbookIds = cashbooks.map(cb => cb.id);
        let entries: any[] = [];
        try {
          const { data: dbEntries, error: entErr } = await supabase
            .from('entries')
            .select('*')
            .in('cashbook_id', cashbookIds)
            .order('date', { ascending: false });

          if (!entErr && dbEntries) {
            entries = dbEntries;
          } else if (entErr) {
            console.warn('[Dashboard] Direct entries select warning, will check RBAC endpoint:', entErr.message);
          }
        } catch (e: any) {
          console.warn('[Dashboard] Direct entries select exception:', e.message);
        }

        // Secondary fallback / augmentation via RBAC Service Backend to ensure member entries are fully loaded
        try {
          const rbacEntRes = await fetch('/api/rbac/cashbook-entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cashbookIds, cashbookId: cashbookIds })
          });

          if (rbacEntRes.ok) {
            const rbacEntJson = await rbacEntRes.json();
            if (rbacEntJson.success && Array.isArray(rbacEntJson.entries)) {
              const existingEntryIds = new Set(entries.map(e => e.id));
              for (const re of rbacEntJson.entries) {
                if (re && re.id && !existingEntryIds.has(re.id)) {
                  entries.push(re);
                }
              }
            }
          }
        } catch (rbacEntErr) {
          console.warn('[Dashboard] RBAC entries fallback note:', rbacEntErr);
        }

        const entriesMapByCashbook = new Map<string, any[]>();
        const allEntryIds: string[] = [];
        if (entries) {
          for (const e of entries) {
            if (e && e.id && pendingEntryIds.has(e.id)) continue;
            allEntryIds.push(e.id);
            if (!entriesMapByCashbook.has(e.cashbook_id)) {
              entriesMapByCashbook.set(e.cashbook_id, []);
            }
            entriesMapByCashbook.get(e.cashbook_id)!.push(e);
          }
        }

        // Fetch attachments for all entries in a single step
        let attachmentsMap = new Map<string, string[]>();
        let attachmentsDetailsMap = new Map<string, any[]>();
        let aiEntryIds = new Set<string>();
        if (allEntryIds.length > 0) {
          const { attachments, aiAttachments } = await fetchAttachmentsDeduplicated(allEntryIds);
          if (attachments) {
            for (const att of attachments) {
              if (att && att.entry_id && att.file_url) {
                if (!attachmentsMap.has(att.entry_id)) {
                  attachmentsMap.set(att.entry_id, []);
                }
                attachmentsMap.get(att.entry_id)!.push(att.file_url);

                if (!attachmentsDetailsMap.has(att.entry_id)) {
                  attachmentsDetailsMap.set(att.entry_id, []);
                }
                attachmentsDetailsMap.get(att.entry_id)!.push(att);
              }
            }
          }
          if (aiAttachments) {
            for (const att of aiAttachments) {
              if (att && att.entry_id && att.file_url) {
                aiEntryIds.add(att.entry_id);
                if (!attachmentsMap.has(att.entry_id)) {
                  attachmentsMap.set(att.entry_id, []);
                }
                attachmentsMap.get(att.entry_id)!.push(att.file_url);

                if (!attachmentsDetailsMap.has(att.entry_id)) {
                  attachmentsDetailsMap.set(att.entry_id, []);
                }
                attachmentsDetailsMap.get(att.entry_id)!.push(att);
              }
            }
          }
        }

        const mappedBooks = cashbooks.map(cb => {
          const rawEntries = entriesMapByCashbook.get(cb.id) || [];
          const entryList = rawEntries.map(t => {
            const images = attachmentsMap.get(t.id) || [];
            const details = attachmentsDetailsMap.get(t.id) || [];
            const isMerged = t.image_layout === 'merge' || t.bill_type === 'MERGE' || t.billType === 'MERGE';
            const isAi = aiEntryIds.has(t.id) || !!t.isAi || t.source === 'AI';
            return {
              ...t,
              imageLayout: isMerged ? 'merge' : (t.image_layout || 'split'),
              date: t.date ? new Date(t.date) : new Date(),
              images,
              attachment_details: details,
              isAi,
              source: t.source || (isAi ? 'AI' : ((t.is_imported || t.imported_from_share_code) ? 'Imported' : 'Manual')),
              user_name: t.user_name,
              created_at: t.created_at
            };
          });

          // Update memory cache
          entriesCache.set(cb.id, entryList);
          lastFetchTimeCache.set(cb.id, Date.now());

          return {
            ...cb,
            transactions: entryList,
            createdAt: cb.created_at ? new Date(cb.created_at) : new Date(),
            user_name: cb.user_name
          };
        });

        setBooks(mappedBooks);
        try {
          if (session?.user?.id) {
            localStorage.setItem(`trackbook_cached_books_${session.user.id}`, JSON.stringify(mappedBooks));
          }
          localStorage.removeItem('trackbook_cached_books');
        } catch (e) {}

        // Solve loading delay by resolving activeBookId immediately if not set
        if (bookSlugRef.current) {
          const foundBook = mappedBooks.find(b => getBookSlug(b.name, b.id) === bookSlugRef.current || b.id === bookSlugRef.current);
          if (foundBook) {
            setActiveBookIdState(foundBook.id);
          }
        }
      } else {
        setBooks([]);
      }
    } catch (error: any) {
      console.error('Error fetching data from Supabase:', error);
    } finally {
      initialLoadedRef.current = true;
      setIsLoading(false);
      setIsEntriesLoading(false);
    }
  }, [session]);

  // Fetch data from Supabase init, on invitation accepted, and periodic background refresh
  useEffect(() => {
    fetchData();

    const handleCashbookRefresh = () => {
      fetchData(true);
    };

    window.addEventListener('trackbook_refresh_cashbooks', handleCashbookRefresh);
    window.addEventListener('cashbook_updated', handleCashbookRefresh);

    // Periodic sync check every 12 seconds so entries added by other members sync live
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData(true);
      }
    }, 12000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('trackbook_refresh_cashbooks', handleCashbookRefresh);
      window.removeEventListener('cashbook_updated', handleCashbookRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session, fetchData]);

  // Automatic migration utility for legacy base64 images in database tables
  useEffect(() => {
    if (!supabase || !session) return;

    let isSubscribed = true;

    async function runDatabaseMigration() {
      try {
        console.log('[Migration] Checking for legacy base64 image rows in Supabase...');

        // 1. Query attachments table where file_url starts with data:
        const { data: legacyAttachments, error: error1 } = await supabase
          .from('attachments')
          .select('*')
          .like('file_url', 'data:%');

        if (error1) {
          console.warn('[Migration] Warning checking legacy attachments:', error1);
        } else if (legacyAttachments && legacyAttachments.length > 0) {
          console.log(`[Migration] Found ${legacyAttachments.length} base64 attachment rows to migrate.`);
          for (const row of legacyAttachments) {
            if (!isSubscribed) return;
            try {
              console.log(`[Migration] Migrating attachment item ${row.id}...`);
              const cloudinaryFolder = await getUserCloudinaryFolder(session?.user);
              const cloudinaryUrl = await uploadToCloudinary(row.file_url, cloudinaryFolder);
              
              if (cloudinaryUrl) {
                const { error: updateError } = await supabase
                  .from('attachments')
                  .update({ file_url: cloudinaryUrl })
                  .eq('id', row.id);
                  
                if (updateError) {
                  throw updateError;
                }
                console.log(`[Migration] successfully migrated attachment row ${row.id} to Cloudinary.`);
              }
            } catch (err) {
              console.warn(`[Migration] Warning: Failed to migrate attachment row ${row.id}:`, err);
            }
          }
        }

        // 2. Query ai_attachments table where file_url starts with data:
        const { data: legacyAiAttachments, error: error2 } = await supabase
          .from('ai_attachments')
          .select('*')
          .like('file_url', 'data:%');

        if (error2) {
          console.warn('[Migration] Warning checking legacy ai_attachments:', error2);
        } else if (legacyAiAttachments && legacyAiAttachments.length > 0) {
          console.log(`[Migration] Found ${legacyAiAttachments.length} base64 AI attachment rows to migrate.`);
          for (const row of legacyAiAttachments) {
            if (!isSubscribed) return;
            try {
              console.log(`[Migration] Migrating AI attachment item ${row.id}...`);
              const cloudinaryFolder = await getUserCloudinaryFolder(session?.user);
              const cloudinaryUrl = await uploadToCloudinary(row.file_url, cloudinaryFolder);
              
              if (cloudinaryUrl) {
                const { error: updateError } = await supabase
                  .from('ai_attachments')
                  .update({ file_url: cloudinaryUrl })
                  .eq('id', row.id);
                  
                if (updateError) {
                  throw updateError;
                }
                console.log(`[Migration] successfully migrated AI attachment row ${row.id} to Cloudinary.`);
              }
            } catch (err) {
              console.error(`[Migration] Failed to migrate AI attachment row ${row.id}:`, err);
            }
          }
        }

        // 3. Try "images" table with "image_url" column if applicable
        try {
          const { data: legacyImages, error: error3 } = await supabase
            .from('images')
            .select('*')
            .like('image_url', 'data:%');

          if (!error3 && legacyImages && legacyImages.length > 0) {
            console.log(`[Migration] Found ${legacyImages.length} base64 images rows to migrate.`);
            for (const row of legacyImages) {
              if (!isSubscribed) return;
              try {
                console.log(`[Migration] Migrating image item ${row.id}...`);
                const cloudinaryFolder = await getUserCloudinaryFolder(session?.user);
                const cloudinaryUrl = await uploadToCloudinary(row.image_url, cloudinaryFolder);
                
                if (cloudinaryUrl) {
                  const { error: updateError } = await supabase
                    .from('images')
                    .update({ image_url: cloudinaryUrl })
                    .eq('id', row.id);
                    
                  if (updateError) {
                    throw updateError;
                  }
                  console.log(`[Migration] successfully migrated images row ${row.id} to Cloudinary.`);
                }
              } catch (err) {
                console.log(`[Migration] Failed on images row ${row.id}:`, err);
              }
            }
          }
        } catch (e) {
          // Ignore, expected if images table doesn't exist
        }

        // If any migrations were done, trigger refresh of current books
        if (isSubscribed) {
          fetchData(true);
        }

      } catch (err) {
        console.error('[Migration] Failed migration checks:', err);
      }
    }

    const timer = setTimeout(() => {
      runDatabaseMigration();
    }, 4000);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [session, supabase]);

  // Autofocus amount when form is shown
  useEffect(() => {
    if (showForm) {
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 120);
    }
  }, [showForm]);

  // Save to localStorage as fallback (without heavy images to avoid quota errors)
  useEffect(() => {
    if (books.length > 0 && session) {
      try {
        const booksToSave = books.map(book => ({
          ...book,
          transactions: book.transactions.map(t => {
            const { images, ...rest } = t;
            return rest;
          })
        }));
        localStorage.setItem(`cashbooks_${session.user.id}`, JSON.stringify(booksToSave));
      } catch (e) {
        console.warn('Failed to save to localStorage (Quota likely exceeded):', e);
      }
    }
  }, [books, session]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (reportsRef.current && !reportsRef.current.contains(event.target as Node)) {
        setShowReportsMenu(false);
      }
      if (bookMenuRef.current && !bookMenuRef.current.contains(event.target as Node)) {
        setShowBookMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeBook = useMemo(() => {
    const found = books.find(b => b.id === activeBookId);
    if (!found) return undefined;
    const uniques = new Map<string, typeof found.transactions[0]>();
    (found.transactions || []).forEach(t => {
      if (t && t.id && !uniques.has(t.id)) {
        uniques.set(t.id, t);
      }
    });
    return {
      ...found,
      transactions: Array.from(uniques.values())
    };
  }, [books, activeBookId]);

  const currentUserRole: Role = useMemo(() => {
    if (!activeBook) return 'Primary Admin';
    if ((activeBook as any).user_id === session?.user?.id || (activeBook as any).userId === session?.user?.id || (activeBook as any).isOwner === true) {
      return 'Primary Admin';
    }
    const r = (activeBook as any).userRole || (activeBook as any).role || (activeBook as any).member_role;
    if (r && ALL_ROLES.includes(r as Role)) {
      return r as Role;
    }
    return 'Viewer';
  }, [activeBook, session]);

  const filteredBooks = useMemo(() => {
    const uniques = new Map<string, typeof books[0]>();
    books.forEach(b => {
      if (b && b.id && !uniques.has(b.id)) {
        uniques.set(b.id, b);
      }
    });
    return Array.from(uniques.values()).filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [books, searchQuery]);

  const totals = useMemo(() => {
    if (!activeBook) return { in: 0, out: 0, net: 0 };
    const cashIn = activeBook.transactions
      .filter(t => t.type === 'in')
      .reduce((sum, t) => sum + t.amount, 0);
    const cashOut = activeBook.transactions
      .filter(t => t.type === 'out')
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      in: cashIn,
      out: cashOut,
      net: cashIn - cashOut
    };
  }, [activeBook]);

  const filteredTransactions = useMemo(() => {
    if (!activeBook) return [];
    const filtered = activeBook.transactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(transactionSearchQuery.toLowerCase()) || 
                            t.amount.toString().includes(transactionSearchQuery) ||
                            t.category.toLowerCase().includes(transactionSearchQuery.toLowerCase()) ||
                            t.mode.toLowerCase().includes(transactionSearchQuery.toLowerCase());
      const matchesType = transactionTypeFilter === 'all' || t.type === transactionTypeFilter;
      
      // Category Filter
      const matchesCategory = transactionCategoryFilter === 'All' || t.category === transactionCategoryFilter;

      // Duration Filter
      let matchesDuration = true;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      const tDate = t.date instanceof Date 
        ? t.date 
        : new Date(t.date || t.created_at || 0);

      if (transactionDurationFilter === 'Today') {
        matchesDuration = tDate >= today;
      } else if (transactionDurationFilter === 'Yesterday') {
        matchesDuration = tDate >= yesterday && tDate < today;
      } else if (transactionDurationFilter === 'Last Week') {
        matchesDuration = tDate >= lastWeek;
      } else if (transactionDurationFilter === 'Custom' && customFilterDate) {
        // Parse custom date string "YYYY-MM-DD"
        const [cy, cm, cd] = customFilterDate.split('-').map(Number);
        const filterDateStart = new Date(cy, cm - 1, cd);
        const filterDateEnd = new Date(cy, cm - 1, cd + 1);
        matchesDuration = tDate >= filterDateStart && tDate < filterDateEnd;
      }

      return matchesSearch && matchesType && matchesCategory && matchesDuration;
    });

    // Apply Dynamic Sorting
    return [...filtered].sort((a, b) => {
      const timeA = a.date instanceof Date ? a.date.getTime() : new Date(a.date || a.created_at || 0).getTime() || 0;
      const timeB = b.date instanceof Date ? b.date.getTime() : new Date(b.date || b.created_at || 0).getTime() || 0;

      let comparison = 0;
      if (sortColumn === 'category') {
        // Primary: Category, Secondary: Date (newest first)
        comparison = (a.category || '').localeCompare(b.category || '');
        if (comparison === 0) {
          comparison = timeB - timeA;
        }
      } else {
        // Primary: Date (newest first), Secondary: Category
        comparison = timeB - timeA;
        if (comparison === 0) {
          comparison = (a.category || '').localeCompare(b.category || '');
        }
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [activeBook, transactionSearchQuery, transactionTypeFilter, transactionCategoryFilter, transactionDurationFilter, customFilterDate, sortColumn, sortDirection]);

  // Reset visibleCount whenever the selected book or filters change to keep viewport neat and clean
  useEffect(() => {
    setVisibleCount(20);
  }, [activeBookId, transactionSearchQuery, transactionTypeFilter, transactionCategoryFilter, transactionDurationFilter, customFilterDate]);

  // Pre-calculate running balances chronologically for active cashbook
  const runningBalancesMap = useMemo(() => {
    if (!activeBook || !activeBookId) return new Map<string, number>();
    
    const sig = activeBook.transactions.map(t => {
      const tTime = t.date instanceof Date ? t.date.getTime() : new Date(t.date || t.created_at || 0).getTime() || 0;
      return `${t.id}_${t.amount}_${t.type}_${tTime}`;
    }).join('|');
    const cachedSig = computedBalancesSignatureCache.get(activeBookId);
    if (cachedSig === sig && computedBalancesCache.has(activeBookId)) {
      return computedBalancesCache.get(activeBookId)!;
    }
    
    // Sort all transactions in active book chronologically (oldest date first)
    const chronological = [...activeBook.transactions].sort((a, b) => {
      const timeA = a.date instanceof Date ? a.date.getTime() : new Date(a.date || a.created_at || 0).getTime() || 0;
      const timeB = b.date instanceof Date ? b.date.getTime() : new Date(b.date || b.created_at || 0).getTime() || 0;
      return timeA - timeB;
    });
    
    const map = new Map<string, number>();
    let current = 0;
    for (const t of chronological) {
      current += (t.type === 'in' ? t.amount : -t.amount);
      map.set(t.id, current);
    }
    
    computedBalancesCache.set(activeBookId, map);
    computedBalancesSignatureCache.set(activeBookId, sig);
    return map;
  }, [activeBook, activeBookId]);

  // Sliced set of transactions currently visible in the UI viewport
  const pagedTransactions = useMemo(() => {
    return filteredTransactions.slice(0, visibleCount);
  }, [filteredTransactions, visibleCount]);

  const selectedList = useMemo(() => {
    return filteredTransactions.filter(t => selectedTransactions.has(t.id));
  }, [filteredTransactions, selectedTransactions]);

  const selectedTotals = useMemo(() => {
    let cashIn = 0;
    let cashOut = 0;
    selectedList.forEach(t => {
      if (t.type === 'in') {
        cashIn += Number(t.amount);
      } else {
        cashOut += Number(t.amount);
      }
    });
    return { in: cashIn, out: cashOut };
  }, [selectedList]);

  const {
    startIndex: desktopStart,
    endIndex: desktopEnd,
    paddingTop: desktopPaddingTop,
    paddingBottom: desktopPaddingBottom,
  } = useVirtualWindow({
    itemsCount: pagedTransactions.length,
    itemHeight: 64,
    containerRef: desktopTableRef,
  });

  const {
    startIndex: mobileStart,
    endIndex: mobileEnd,
    paddingTop: mobilePaddingTop,
    paddingBottom: mobilePaddingBottom,
  } = useVirtualWindow({
    itemsCount: pagedTransactions.length,
    itemHeight: 132,
    containerRef: mobileContainerRef,
  });

  // Auto load more while scrolling (Infinite scrolling)
  useEffect(() => {
    const handleScrollForInfinite = () => {
      if (filteredTransactions.length <= visibleCount) return;
      
      const threshold = 450; // px from bottom of the page
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      const scrollPos = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      
      if (scrollHeight - clientHeight - scrollPos < threshold) {
        setVisibleCount(prev => prev + 20);
      }
    };
    
    window.addEventListener('scroll', handleScrollForInfinite, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScrollForInfinite);
    };
  }, [filteredTransactions.length, visibleCount]);

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!newBookName.trim() || !session) return;
    
    // Prevent creating duplicate book names (case-insensitive, trimmed)
    const normalizedNewName = newBookName.trim().toLowerCase();
    const isDuplicate = books.some(b => b.name.trim().toLowerCase() === normalizedNewName);
    if (isDuplicate) {
      setCreateBookError("A book with this name already exists. Please choose a different name.");
      return;
    }
    
    // Optimization: Don't show submitting overlay for simple book creation if it's too slow
    // Or just make it very quick.
    setIsSubmitting(true);
    setSubmittingMessage('Creating new book...');
    
    const newBook: Cashbook = {
      id: safeUUID(),
      name: newBookName.trim(),
      transactions: [],
      createdAt: new Date()
    };

    // Update local state immediately for perceived speed
    setBooks(prev => [...prev, newBook]);
    setNewBookName('');
    setCreateBookError(null);
    setIsCreatingBook(false);
    setIsSubmitting(false);

    // Then handle Supabase in background
    if (supabase) {
      try {
        const resolvedUser = await resolveUserDataForAttachments();
        const payload: any = { 
          id: newBook.id, 
          name: newBook.name, 
          created_at: safeToISOString(newBook.createdAt),
          user_id: session.user.id,
          user_name: resolvedUser.name
        };
        const { error } = await supabase
          .from('cashbooks')
          .insert([payload]);
        if (error) {
          if (error.code === '42703' || error.message?.toLowerCase().includes('column')) {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.user_name;
            const { error: retryError } = await supabase
              .from('cashbooks')
              .insert([fallbackPayload]);
            if (retryError) throw retryError;
          } else {
            throw error;
          }
        }
      } catch (error) {
        console.error('Error creating book in Supabase:', error);
        // If it fails, we might want to revert local state, but usually it's fine
      }
    }
  };

  const handleUpdateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBookName.trim() || !isEditingBook || !session) return;

    // Prevent renaming to a duplicate book name (case-insensitive, trimmed)
    const normalizedEditName = editBookName.trim().toLowerCase();
    const isDuplicate = books.some(b => b.id !== isEditingBook && b.name.trim().toLowerCase() === normalizedEditName);
    if (isDuplicate) {
      setEditBookError("A book with this name already exists. Please choose a different name.");
      return;
    }

    const savedId = isEditingBook;

    if (supabase) {
      try {
        const { error } = await supabase
          .from('cashbooks')
          .update({ name: editBookName.trim() })
          .eq('id', isEditingBook)
          .eq('user_id', session.user.id);
        if (error) throw error;
      } catch (error) {
        console.error('Error updating book in Supabase:', error);
      }
    }

    setBooks(books.map(b => b.id === isEditingBook ? { ...b, name: editBookName.trim() } : b));
    setIsEditingBook(null);
    setEditBookName('');
    setEditBookError(null);

    setJustEditedBookId(savedId);
    setTimeout(() => {
      setJustEditedBookId(null);
    }, 2000);
  };

  const handleDuplicateBook = async (bookId: string) => {
    vibrate(15);
    const bookToDup = books.find(b => b.id === bookId);
    if (!bookToDup || !session) return;
    
    const newName = `${bookToDup.name} (Copy)`;
    const newBookId = 'book_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    
    if (supabase) {
      try {
        const resolvedUser = await resolveUserDataForAttachments();
        const payload: any = {
          id: newBookId,
          name: newName,
          user_id: session.user.id,
          user_name: resolvedUser.name
        };
        const { error } = await supabase.from('cashbooks').insert(payload);
        if (error) {
          if (error.code === '42703' || error.message?.toLowerCase().includes('column')) {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.user_name;
            await supabase.from('cashbooks').insert(fallbackPayload);
          } else {
            throw error;
          }
        }
      } catch (err) {
        console.error('Error duplicating book in Supabase:', err);
      }
    }
    
    const sourceEntries = entriesCache.get(bookId) || bookToDup.transactions || [];
    const dupTransactions = sourceEntries.map((t: any) => ({
      ...t,
      id: 'tx_' + Math.random().toString(36).substring(2, 11),
      cashbook_id: newBookId,
    }));
    
    if (supabase && dupTransactions.length > 0) {
      try {
        await supabase.from('transactions').insert(
          dupTransactions.map((t: any) => ({
            id: t.id,
            cashbook_id: newBookId,
            amount: t.amount,
            type: t.type,
            description: t.description,
            category: t.category,
            mode: t.mode,
            date: t.date,
            images: t.images || [],
            image_layout: t.imageLayout || 'split',
            is_ai: !!t.isAi,
            source: t.source || 'Manual'
          }))
        );
      } catch (err) {
        console.error('Error duplicating transactions in Supabase:', err);
      }
    }
    
    const newBook = {
      id: newBookId,
      name: newName,
      transactions: dupTransactions,
      createdAt: new Date()
    };
    
    entriesCache.set(newBookId, dupTransactions);
    setBooks([newBook, ...books]);
  };

  const handleExportBookFromList = async (bookId: string, format: 'pdf' | 'excel') => {
    vibrate(15);
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    const txs = entriesCache.get(bookId) || book.transactions || [];
    if (format === 'excel') {
      await backgroundExportManager.enqueueExcelTask(book.id, book.name, txs);
    } else {
      await backgroundExportManager.enqueueTask(book.id, book.name, txs, true);
    }
  };

  const handleAskAi = async () => {
    if (!helpQuery.trim()) return;
    setIsHelpLoading(true);
    setHelpResponse('');
    
    try {
      const res = await fetch("/api/gemini/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: helpQuery }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      setHelpResponse(data.text || "I'm sorry, I couldn't generate a response.");
    } catch (err: any) {
      console.error('Error asking AI:', err);
      setHelpResponse(err.message || "Sorry, I encountered an error while processing your request.");
    } finally {
      setIsHelpLoading(false);
    }
  };

  const handleDeleteBook = (id: string) => {
    vibrate(50);
    setDeleteConfirmId(id);
    setDeleteConfirmed(false);
  };

  const confirmDeleteBook = async () => {
    const targetId = deleteConfirmId;
    if (targetId && session) {
      const bookToDeleteObj = books.find(b => b.id === targetId);
      const originalIndex = books.findIndex(b => b.id === targetId);
      const cached = entriesCache.get(targetId) || [];

      // Immediately remove from UI state
      setBooks(prevBooks => prevBooks.filter(b => b.id !== targetId));
      setDeleteConfirmId(null);
      if (activeBookId === targetId) {
        handleSelectBook(null);
      }

      if (bookToDeleteObj) {
        handleStartUndoableDelete({
          type: 'book',
          data: {
            book: bookToDeleteObj,
            cachedEntries: cached
          },
          originalIndex
        }).catch(err => console.error('[confirmDeleteBook] Error starting undoable delete:', err));
      }
    }
  };

  const handleBulkDeleteBooks = async () => {
    if (selectedBooks.size === 0 || !session) return;

    const booksToDelete = Array.from(selectedBooks).map(id => {
      const book = books.find(b => b.id === id);
      return {
        book,
        cachedEntries: entriesCache.get(id) || []
      };
    }).filter(item => item.book !== undefined);

    const originalIndexes = Array.from(selectedBooks).map(id => {
      return books.findIndex(b => b.id === id);
    });

    const idsSet = new Set(selectedBooks);

    // Immediately remove from UI state
    setBooks(prevBooks => prevBooks.filter(b => !idsSet.has(b.id)));
    setSelectedBooks(new Set());
    setShowBulkDeleteConfirm(false);

    handleStartUndoableDelete({
      type: 'bulk_books',
      data: booksToDelete,
      originalIndexes
    }).catch(err => console.error('[handleBulkDeleteBooks] Error starting undoable delete:', err));
  };

  const handleRetryUpload = (blobUrl: string, transactionId: string) => {
    console.log('[handleRetryUpload] Image upload retry is now handled synchronously during save.');
  };

  const saveTransaction = async () => {
    if (!activeBookId || !showForm || !amount || !session || !supabase) return;

    const finalCategory = category === 'Custom' ? customCategory : category;
    const finalMode = mode === 'Custom' ? customMode : mode;

    const amountNum = parseFloat(amount);
    const dateObj = new Date(transactionDate);

    const isEdit = !!editingTransaction;

    // Check if there are any changes for an edit transaction
    let hasChanges = true;
    if (isEdit && editingTransaction) {
      const amountUnchanged = amountNum === editingTransaction.amount;
      const descUnchanged = description === editingTransaction.description;
      const catUnchanged = finalCategory === editingTransaction.category;
      const modeUnchanged = finalMode === editingTransaction.mode;
      
      const originalDateFormatted = safeToDateTimeLocal(editingTransaction.date);
      const newDateFormatted = safeToDateTimeLocal(dateObj);
      const dateUnchanged = originalDateFormatted === newDateFormatted;

      const originalImages = editingTransaction.images || [];
      const imagesUnchanged = selectedImages.length === originalImages.length &&
        selectedImages.every((img, i) => img === originalImages[i]);

      const layoutUnchanged = imageLayout === (editingTransaction.imageLayout || 'split');
      const typeUnchanged = showForm === editingTransaction.type;

      if (amountUnchanged && descUnchanged && catUnchanged && modeUnchanged && dateUnchanged && imagesUnchanged && layoutUnchanged && typeUnchanged) {
        hasChanges = false;
      }
    }

    if (isEdit && !hasChanges) {
      // No changes made, close immediately
      setShowForm(null);
      setEditingTransaction(null);
      resetForm();
      setIsSubmitting(false);
      return;
    }

    const resolvedName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'User';

    if (isEdit && editingTransaction) {
      const originalTx = editingTransaction;
      const savedId = originalTx.id;
      const currentSelectedImages = [...selectedImages];
      const currentImageLayout = imageLayout;
      const currentCategory = finalCategory || 'General';
      const currentMode = finalMode || 'Cash';
      const currentDescription = description;
      const currentShowForm = showForm;

      // 1. OPTIMISTIC UPDATE: Update UI state instantly
      const updatedTx: Transaction = {
        ...originalTx,
        amount: amountNum,
        type: currentShowForm as 'in' | 'out',
        description: currentDescription,
        category: currentCategory,
        mode: currentMode,
        date: dateObj,
        images: currentSelectedImages,
        imageLayout: currentImageLayout
      };

      setBooks(prev => prev.map(b => b.id === activeBookId ? {
        ...b,
        transactions: b.transactions.map(t => t.id === originalTx.id ? updatedTx : t)
      } : b));

      const prevCached = entriesCache.get(activeBookId) || [];
      entriesCache.set(activeBookId, prevCached.map(t => t.id === originalTx.id ? {
        ...t,
        amount: amountNum,
        type: currentShowForm,
        description: currentDescription,
        category: currentCategory,
        mode: currentMode,
        date: dateObj,
        image_layout: currentImageLayout
      } : t));

      attachmentCache.set(savedId, { images: currentSelectedImages, isAi: false });

      // 2. CLOSE FORM IMMEDIATELY
      setShowForm(null);
      setEditingTransaction(null);
      resetForm();
      setIsSubmitting(false);
      setProgressModal(null);

      // Highlight the edited transaction in the list
      setTimeout(() => {
        setJustEditedTransactionId(savedId);
        const element = document.getElementById(`entry-${savedId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setTimeout(() => {
          setJustEditedTransactionId(null);
        }, 2000);
      }, 50);

      // 3. PERSIST SILENTLY IN BACKGROUND
      (async () => {
        try {
          const cloudinaryFolder = await getUserCloudinaryFolder(session?.user);
          const finalImages: string[] = [];

          for (const img of currentSelectedImages) {
            const hashIdx = img.indexOf('#');
            const hash = hashIdx !== -1 ? img.substring(hashIdx) : '';
            const cleanImg = hashIdx !== -1 ? img.substring(0, hashIdx) : img;

            if (cleanImg.startsWith('blob:')) {
              const file = imageFilesRef.current[cleanImg];
              if (file) {
                const isImage = file.type && file.type.startsWith('image/');
                const processedFile = isImage ? await compressImage(file) : file;
                const fileToUpload = processedFile instanceof File 
                  ? processedFile 
                  : new File([processedFile], file.name || 'image.jpg', { type: file.type });
                const cloudUrl = await uploadToCloudinary(fileToUpload, cloudinaryFolder);
                if (cloudUrl) {
                  finalImages.push(cloudUrl + hash);
                }
              }
            } else {
              finalImages.push(img);
            }
          }

          const resolvedUser = await resolveUserDataForAttachments();
          const payload: any = {
            amount: amountNum,
            type: currentShowForm,
            description: currentDescription,
            category: currentCategory,
            mode: currentMode,
            date: safeToISOString(dateObj),
            user_name: resolvedUser.name
          };

          let entryError: any = null;
          const firstUpdate = await supabase
            .from('entries')
            .update({ ...payload, image_layout: currentImageLayout })
            .eq('id', savedId);
          entryError = firstUpdate.error;

          if (entryError && (entryError.code === '42703' || entryError.message?.toLowerCase().includes('column'))) {
            const secondUpdate = await supabase.from('entries').update(payload).eq('id', savedId);
            entryError = secondUpdate.error;
            if (entryError && (entryError.code === '42703' || entryError.message?.toLowerCase().includes('column'))) {
              const payloadNoUser = { ...payload };
              delete payloadNoUser.user_name;
              const thirdUpdate = await supabase.from('entries').update({ ...payloadNoUser, image_layout: currentImageLayout }).eq('id', savedId);
              entryError = thirdUpdate.error;
              if (entryError && (entryError.code === '42703' || entryError.message?.toLowerCase().includes('column'))) {
                const fourthUpdate = await supabase.from('entries').update(payloadNoUser).eq('id', savedId);
                entryError = fourthUpdate.error;
              }
            }
          }

          if (entryError) {
            try {
              const rbacSaveRes = await fetch('/api/rbac/save-entry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  entry: { id: savedId, cashbook_id: activeBookId, ...payload, image_layout: currentImageLayout },
                  userId: session.user.id,
                  userEmail: session.user.email
                })
              });
              if (rbacSaveRes.ok) {
                const rbacSaveJson = await rbacSaveRes.json();
                if (rbacSaveJson.success) entryError = null;
              }
            } catch (_) {}
          }

          if (entryError) throw entryError;

          await supabase.from('attachments').delete().eq('entry_id', savedId);
          await supabase.from('ai_attachments').delete().eq('entry_id', savedId);
          if (finalImages.length > 0) {
            const attachmentInserts = finalImages.map(url => ({
              entry_id: savedId,
              user_id: session.user.id,
              user_name: resolvedUser.name,
              user_email: resolvedUser.email,
              file_url: url
            }));
            await supabase.from('attachments').insert(attachmentInserts);
          }

          await fetchData();
        } catch (bgErr: any) {
          console.error('[Instant Edit] Background sync error:', bgErr);
          setBooks(prev => prev.map(b => b.id === activeBookId ? {
            ...b,
            transactions: b.transactions.map(t => t.id === originalTx.id ? originalTx : t)
          } : b));
          entriesCache.set(activeBookId, prevCached);
          setError(bgErr.message || 'Failed to update entry. Please check your connection.');
        }
      })();

    } else {
      // Direct Creation Mode
      const tempId = safeUUID();
      const currentSelectedImages = [...selectedImages];
      const currentImageLayout = imageLayout;
      const currentCategory = finalCategory || 'General';
      const currentMode = finalMode || 'Cash';
      const currentDescription = description;
      const currentShowForm = showForm;

      // 1. OPTIMISTIC UPDATE: Add transaction to UI state instantly
      const optimisticTx: Transaction = {
        id: tempId,
        amount: amountNum,
        type: currentShowForm as 'in' | 'out',
        description: currentDescription,
        category: currentCategory,
        mode: currentMode,
        date: dateObj,
        images: currentSelectedImages,
        imageLayout: currentImageLayout,
        source: 'Manual',
        user_name: resolvedName
      };

      setBooks(prev => prev.map(b => b.id === activeBookId ? {
        ...b,
        transactions: [optimisticTx, ...b.transactions]
      } : b));

      const prevCached = entriesCache.get(activeBookId) || [];
      entriesCache.set(activeBookId, [{
        id: tempId,
        amount: amountNum,
        type: currentShowForm,
        description: currentDescription,
        category: currentCategory,
        mode: currentMode,
        date: dateObj,
        image_layout: currentImageLayout,
        user_id: session.user.id,
        cashbook_id: activeBookId
      }, ...prevCached]);

      attachmentCache.set(tempId, { images: currentSelectedImages, isAi: false });

      // 2. CLOSE FORM IMMEDIATELY
      setShowForm(null);
      resetForm();
      setIsSubmitting(false);
      setProgressModal(null);

      // Scroll and highlight the new transaction immediately
      setTimeout(() => {
        setJustEditedTransactionId(tempId);
        const element = document.getElementById(`entry-${tempId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setTimeout(() => {
          setJustEditedTransactionId(null);
        }, 2000);
      }, 50);

      // 3. PERSIST SILENTLY IN BACKGROUND
      (async () => {
        try {
          const cloudinaryFolder = await getUserCloudinaryFolder(session?.user);
          const finalImages: string[] = [];

          for (const img of currentSelectedImages) {
            const hashIdx = img.indexOf('#');
            const hash = hashIdx !== -1 ? img.substring(hashIdx) : '';
            const cleanImg = hashIdx !== -1 ? img.substring(0, hashIdx) : img;

            if (cleanImg.startsWith('blob:')) {
              const file = imageFilesRef.current[cleanImg];
              if (file) {
                const isImage = file.type && file.type.startsWith('image/');
                const processedFile = isImage ? await compressImage(file) : file;
                const fileToUpload = processedFile instanceof File 
                  ? processedFile 
                  : new File([processedFile], file.name || 'image.jpg', { type: file.type });
                const cloudUrl = await uploadToCloudinary(fileToUpload, cloudinaryFolder);
                if (cloudUrl) {
                  finalImages.push(cloudUrl + hash);
                }
              }
            } else {
              finalImages.push(img);
            }
          }

          const resolvedUser = await resolveUserDataForAttachments();
          const payload: any = {
            id: tempId,
            cashbook_id: activeBookId,
            user_id: session.user.id,
            user_name: resolvedUser.name,
            amount: amountNum,
            type: currentShowForm,
            description: currentDescription,
            category: currentCategory,
            mode: currentMode,
            date: safeToISOString(dateObj),
            source: 'Manual'
          };

          let entryError: any = null;
          const firstTry = await supabase
            .from('entries')
            .insert([{ ...payload, image_layout: currentImageLayout }]);
          entryError = firstTry.error;

          if (entryError && (entryError.code === '42703' || entryError.message?.toLowerCase().includes('column'))) {
            const secondTry = await supabase.from('entries').insert([payload]);
            entryError = secondTry.error;
            if (entryError && (entryError.code === '42703' || entryError.message?.toLowerCase().includes('column'))) {
              const payloadNoSource = { ...payload };
              delete payloadNoSource.source;
              const thirdTry = await supabase.from('entries').insert([{ ...payloadNoSource, image_layout: currentImageLayout }]);
              entryError = thirdTry.error;
              if (entryError && (entryError.code === '42703' || entryError.message?.toLowerCase().includes('column'))) {
                const fourthTry = await supabase.from('entries').insert([payloadNoSource]);
                entryError = fourthTry.error;
                if (entryError && (entryError.code === '42703' || entryError.message?.toLowerCase().includes('column'))) {
                  const payloadNoUser = { ...payload };
                  delete payloadNoUser.user_name;
                  const fifthTry = await supabase.from('entries').insert([{ ...payloadNoUser, image_layout: currentImageLayout }]);
                  entryError = fifthTry.error;
                  if (entryError && (entryError.code === '42703' || entryError.message?.toLowerCase().includes('column'))) {
                    const sixthTry = await supabase.from('entries').insert([payloadNoUser]);
                    entryError = sixthTry.error;
                  }
                }
              }
            }
          }

          if (entryError) {
            try {
              const rbacSaveRes = await fetch('/api/rbac/save-entry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  entry: { id: tempId, cashbook_id: activeBookId, ...payload, image_layout: currentImageLayout },
                  userId: session.user.id,
                  userEmail: session.user.email
                })
              });
              if (rbacSaveRes.ok) {
                const rbacSaveJson = await rbacSaveRes.json();
                if (rbacSaveJson.success) entryError = null;
              }
            } catch (_) {}
          }

          if (entryError) throw entryError;

          if (finalImages.length > 0) {
            const attachmentInserts = finalImages.map(url => ({
              entry_id: tempId,
              user_id: session.user.id,
              user_name: resolvedUser.name,
              user_email: resolvedUser.email,
              file_url: url
            }));
            const { error: attachError } = await supabase.from('attachments').insert(attachmentInserts);
            if (attachError) console.error('[Instant Save] Error creating attachments:', attachError);
          }

          await fetchData();
        } catch (bgErr: any) {
          console.error('[Instant Save] Background sync error:', bgErr);
          setBooks(prev => prev.map(b => b.id === activeBookId ? {
            ...b,
            transactions: b.transactions.filter(t => t.id !== tempId)
          } : b));
          entriesCache.set(activeBookId, prevCached);
          setError(bgErr.message || 'Failed to save entry. Please check your connection.');
        }
      })();
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!activeBookId || !showForm || !amount || !session || !supabase) return;

    setIsSubmitting(true);
    setError(null);
    await saveTransaction();
  };

  const handleDeleteTransaction = (id: string) => {
    vibrate(50);
    setTransactionToDelete(id);
    setDeleteConfirmed(false);
  };

  const confirmDeleteTransaction = async () => {
    if (!activeBookId || !transactionToDelete || !session) return;

    const idToDelete = transactionToDelete;

    // Get the transaction object to back up before deleting from local state
    const activeBook = books.find(b => b.id === activeBookId);
    const transactionObj = activeBook?.transactions.find(t => t.id === idToDelete);
    const originalIndex = activeBook?.transactions.findIndex(t => t.id === idToDelete);

    if (transactionObj) {
      await handleStartUndoableDelete({
        type: 'transaction',
        data: transactionObj,
        originalIndex,
        parentBookId: activeBookId
      });
    }

    // Close the confirmation modal to keep UI responsive
    setTransactionToDelete(null);

    // Trigger delete animation
    setAnimatingDeleteId(idToDelete);

    // Wait for the animation (300ms)
    await new Promise(resolve => setTimeout(resolve, 300));

    // Synchronize entries cache for the active book
    const currCached = entriesCache.get(activeBookId);
    if (currCached) {
      entriesCache.set(activeBookId, currCached.filter(t => t.id !== idToDelete));
    }

    setBooks(books.map(b => 
      b.id === activeBookId 
        ? { ...b, transactions: b.transactions.filter(t => t.id !== idToDelete) }
        : b
    ));
    setSelectedTransactions(prev => {
      const next = new Set(prev);
      next.delete(idToDelete);
      return next;
    });
    setAnimatingDeleteId(null);
  };

  const handleBulkDelete = async () => {
    if (!activeBookId || selectedTransactions.size === 0 || !session) return;

    // Get transactions list to back up before deleting from local state
    const activeBook = books.find(b => b.id === activeBookId);
    if (!activeBook) return;

    const txsToDelete = Array.from(selectedTransactions).map(id => {
      return activeBook.transactions.find(t => t.id === id);
    }).filter(t => t !== undefined);

    const originalIndexes = Array.from(selectedTransactions).map(id => {
      return activeBook.transactions.findIndex(t => t.id === id);
    });

    await handleStartUndoableDelete({
      type: 'bulk_transactions',
      data: txsToDelete,
      originalIndexes,
      parentBookId: activeBookId
    });

    // Local filter and state updates
    const idsSet = new Set(selectedTransactions);
    const currCached = entriesCache.get(activeBookId);
    if (currCached) {
      entriesCache.set(activeBookId, currCached.filter(t => !idsSet.has(t.id)));
    }

    setBooks(books.map(b => 
      b.id === activeBookId 
        ? { ...b, transactions: b.transactions.filter(t => !idsSet.has(t.id)) }
        : b
    ));

    setSelectedTransactions(new Set());
    setShowBulkTransactionDeleteConfirm(false);
  };

  const openMergeDialog = () => {
    if (!activeBookId) return;
    const activeBook = books.find(b => b.id === activeBookId);
    if (!activeBook) return;

    const selectedTxs = activeBook.transactions.filter(t => selectedTransactions.has(t.id));
    if (selectedTxs.length < 2) return;

    const totalAmt = selectedTxs.reduce((sum, t) => sum + t.amount, 0);
    const desc = `Merged: ${selectedTxs.map(t => t.description).join(', ')}`;
    const truncatedDesc = desc.length > 85 ? desc.substring(0, 82) + '...' : desc;

    setMergeDescription(truncatedDesc);
    setMergeCategory(selectedTxs[0]?.category || 'General');
    setMergeType(selectedTxs[0]?.type || 'out');
    setShowMergeConfirmDialog(true);
  };

  const handleMergeTransactions = async () => {
    if (!activeBookId || selectedTransactions.size < 2 || !session) return;
    setIsMerging(true);
    setError(null);

    try {
      const activeBook = books.find(b => b.id === activeBookId);
      if (!activeBook) throw new Error('Cashbook not found');

      const selectedTxs = activeBook.transactions.filter(t => selectedTransactions.has(t.id));
      const totalAmount = selectedTxs.reduce((sum, t) => sum + t.amount, 0);
      const newId = safeUUID();

      const resolvedUser = await resolveUserDataForAttachments();
      const payload: any = {
        id: newId,
        cashbook_id: activeBookId,
        user_id: session.user.id,
        user_name: resolvedUser.name,
        amount: totalAmount,
        type: mergeType,
        description: mergeDescription || 'Merged Transactions',
        category: mergeCategory,
        mode: 'Online',
        date: safeToISOString(new Date()),
        image_layout: 'merge',
        bill_type: 'MERGE'
      };

      let insertError: any = null;
      const { error: firstInsertError } = await supabase.from('entries').insert([payload]);
      insertError = firstInsertError;

      if (insertError) {
        if (insertError.code === '42703' || insertError.message?.toLowerCase().includes('column')) {
          const fallbackPayload = { ...payload };
          delete fallbackPayload.image_layout;
          delete fallbackPayload.bill_type;
          const { error: retryError } = await supabase.from('entries').insert([fallbackPayload]);
          insertError = retryError;

          if (insertError && (insertError.code === '42703' || insertError.message?.toLowerCase().includes('column'))) {
            const fallbackNoUser = { ...fallbackPayload };
            delete fallbackNoUser.user_name;
            const { error: retryError2 } = await supabase.from('entries').insert([fallbackNoUser]);
            insertError = retryError2;
          }
        }
      }

      if (insertError) throw insertError;

      const selectedIds = Array.from(selectedTransactions);
      const { data: oldAtts } = await supabase.from('attachments').select('*').in('entry_id', selectedIds);
      const { data: oldAiAtts } = await supabase.from('ai_attachments').select('*').in('entry_id', selectedIds);

      if (oldAtts && oldAtts.length > 0) {
        const resolvedUser = await resolveUserDataForAttachments();
        const newAtts = oldAtts.map(att => ({
          entry_id: newId,
          user_id: session.user.id,
          user_name: resolvedUser.name,
          user_email: resolvedUser.email,
          file_url: att.file_url,
          file_name: att.file_name || 'merged_attachment',
          file_type: att.file_type || 'image'
        }));
        const { error: attachErr } = await supabase.from('attachments').insert(newAtts);
        if (attachErr) {
          if (attachErr.code === '42703' || attachErr.message?.toLowerCase().includes('column')) {
            const fallbackAtts = oldAtts.map(att => ({
              entry_id: newId,
              user_id: session.user.id,
              user_name: resolvedUser.name,
              user_email: resolvedUser.email,
              file_url: att.file_url
            }));
            const { error: retryAttachErr } = await supabase.from('attachments').insert(fallbackAtts);
            if (retryAttachErr) throw retryAttachErr;
          } else {
            throw attachErr;
          }
        }
      }

      if (oldAiAtts && oldAiAtts.length > 0) {
        const resolvedUser = await resolveUserDataForAttachments();
        const newAiAtts = oldAiAtts.map(att => ({
          entry_id: newId,
          user_id: session.user.id,
          user_name: resolvedUser.name,
          user_email: resolvedUser.email,
          file_url: att.file_url,
          file_name: att.file_name || 'merged_ai_attachment',
          file_type: att.file_type || 'image'
        }));
        const { error: aiAttachErr } = await supabase.from('ai_attachments').insert(newAiAtts);
        if (aiAttachErr) {
          if (aiAttachErr.code === '42703' || aiAttachErr.message?.toLowerCase().includes('column')) {
            const fallbackAiAtts = oldAiAtts.map(att => ({
              entry_id: newId,
              user_id: session.user.id,
              user_name: resolvedUser.name,
              user_email: resolvedUser.email,
              file_url: att.file_url
            }));
            const { error: retryAiAttachErr } = await supabase.from('ai_attachments').insert(fallbackAiAtts);
            if (retryAiAttachErr) throw retryAiAttachErr;
          } else {
            throw aiAttachErr;
          }
        }
      }

      // Delete old attachments first to prevent foreign key constraint violations
      if (oldAtts && oldAtts.length > 0) {
        const { error: delAttErr } = await supabase.from('attachments').delete().in('entry_id', selectedIds);
        if (delAttErr) console.warn('[Merge] Warning deleting old attachments before parent entries:', delAttErr);
      }
      if (oldAiAtts && oldAiAtts.length > 0) {
        const { error: delAiAttErr } = await supabase.from('ai_attachments').delete().in('entry_id', selectedIds);
        if (delAiAttErr) console.warn('[Merge] Warning deleting old AI attachments before parent entries:', delAiAttErr);
      }

      // Now we can safely delete parent entries
      const { error: deleteError } = await supabase.from('entries').delete().in('id', selectedIds);
      if (deleteError) throw deleteError;

      setSelectedTransactions(new Set());
      setShowMergeConfirmDialog(false);
      await fetchData();
    } catch (err: any) {
      console.error('[Merge Transactions Error]:', err);
      setError(err.message || 'Failed to merge transactions');
    } finally {
      setIsMerging(false);
    }
  };

  const handleEditTransaction = (t: Transaction) => {
    setEditingTransaction(t);
    setShowForm(t.type);
    setAmount(t.amount.toString());
    setDescription(t.description);
    setCategory(CATEGORIES.includes(t.category) ? t.category : 'Custom');
    if (!CATEGORIES.includes(t.category)) setCustomCategory(t.category);
    setMode(MODES.includes(t.mode) ? t.mode : 'Custom');
    if (!MODES.includes(t.mode)) setCustomMode(t.mode);
    setTransactionDate(safeToDateTimeLocal(t.date));
    setSelectedImages(t.images || []);
    setImageLayout(t.imageLayout || 'split');
  };

  function toggleSelectTransaction(id: string) {
    setSelectedTransactions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedTransactions.size === filteredTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(filteredTransactions.map(t => t.id)));
    }
  }

  const generateShareCode = () => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `TBK-${result}`;
  };

  const handleCopy = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGenerateShareCode = async () => {
    if (selectedList.length === 0 || !session) return;
    if (isGenerating) return; // Atomic loading lock protection
    setIsGenerating(true);
    setShareError('');
    setRestoredMessage('');
    try {
      const nowIso = new Date().toISOString();
      const ids = selectedList.map(t => t.id).filter(Boolean);
      const signature = generateEntriesSignature(ids);

      // Run cleanup on expired entries first
      try {
        await supabase
          .from('shared_entries')
          .delete()
          .lt('expires_at', nowIso);
      } catch (cleanErr) {
        console.warn('Error during pre-share expired cleanup:', cleanErr);
      }

      console.log('[ShareCode] Checking for existing active share session...');
      let existingActiveSession: any = null;

      try {
        // Try to query directly with entries_signature and cashbook_id
        const { data: primaryData, error: primaryErr } = await supabase
          .from('shared_entries')
          .select('share_code, expires_at, entries_json')
          .eq('created_by', session.user.id)
          .eq('cashbook_id', activeBookId)
          .eq('entries_signature', signature)
          .gt('expires_at', nowIso);

        if (!primaryErr && primaryData && primaryData.length > 0) {
          existingActiveSession = primaryData[0];
          console.log('[ShareCode] Primary matching session found:', existingActiveSession.share_code);
        } else if (primaryErr && (primaryErr.code === '42703' || primaryErr.message?.includes('column') || primaryErr.message?.includes('does not exist'))) {
          console.warn('[ShareCode] entries_signature column missing on select, using client-side fallback matching...');
          // Fallback querying user's active codes of this cashbook
          const { data: fallbackData, error: fallbackErr } = await supabase
            .from('shared_entries')
            .select('share_code, expires_at, entries_json')
            .eq('created_by', session.user.id)
            .gt('expires_at', nowIso);

          if (!fallbackErr && fallbackData) {
            existingActiveSession = fallbackData.find((row: any) => {
              if (!Array.isArray(row.entries_json)) return false;
              const rowIds = row.entries_json.map((e: any) => e.id).filter(Boolean);
              return generateEntriesSignature(rowIds) === signature;
            });
          }
        }
      } catch (err) {
        console.warn('[ShareCode] Error during direct session checking:', err);
      }

      if (existingActiveSession) {
        const reusedCode = existingActiveSession.share_code;
        const expiryTime = new Date(existingActiveSession.expires_at).getTime();
        setGeneratedCode(reusedCode);
        setShareExpiryTime(expiryTime);
        
        setRestoredMessage("Previous active share session restored");
        setTimeout(() => setRestoredMessage(''), 20000);

        if (activeBookId) {
          localStorage.setItem(`trackbook_share_session_${activeBookId}`, JSON.stringify({
            code: reusedCode,
            expiry: expiryTime
          }));
        }
        setIsGenerating(false);
        return;
      }

      // No matching session found: delete previous active state for this cashbook before adding a new one
      if (activeBookId) {
        const savedSessionStr = localStorage.getItem(`trackbook_share_session_${activeBookId}`);
        if (savedSessionStr) {
          try {
            const savedSession = JSON.parse(savedSessionStr);
            if (savedSession && savedSession.code) {
              await supabase
                .from('shared_entries')
                .delete()
                .eq('share_code', savedSession.code.toUpperCase());
            }
          } catch (e) {
            console.warn('Error cleanup old session from DB:', e);
          }
        }
      }

      // Generate a new code
      const code = generateShareCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const expiryTime = Date.now() + 5 * 60 * 1000;
      const createdAt = new Date().toISOString();
      
      const payload: any = {
        share_code: code,
        created_by: session.user.id,
        entries_count: selectedList.length,
        expires_at: expiresAt,
        created_at: createdAt,
        cashbook_id: activeBookId,
        entries_signature: signature,
        entries_json: selectedList.map(t => ({
          id: t.id,
          amount: t.amount,
          type: t.type,
          description: t.description,
          category: t.category,
          mode: t.mode,
          date: t.date,
          image_layout: t.imageLayout || 'split',
          images: t.images || []
        }))
      };

      const { error: insertErr } = await supabase
        .from('shared_entries')
        .insert([payload]);

      if (insertErr) {
        console.warn('[ShareCode] Insert with signature failed, falling back...', insertErr.message);
        if (insertErr.code === '42703' || insertErr.message?.includes('column') || insertErr.message?.includes('does not exist')) {
          const { entries_signature, cashbook_id, ...fallbackPayload } = payload;
          const { error: retryErr } = await supabase
            .from('shared_entries')
            .insert([fallbackPayload]);
          if (retryErr) {
            throw new Error(retryErr.message);
          }
        } else {
          throw new Error(insertErr.message);
        }
      }
      
      setGeneratedCode(code);
      setShareExpiryTime(expiryTime);
      setRestoredMessage("New share session generated");
      setTimeout(() => setRestoredMessage(''), 20000);

      // Save current active share session to localStorage
      if (activeBookId) {
        localStorage.setItem(`trackbook_share_session_${activeBookId}`, JSON.stringify({
          code,
          expiry: expiryTime
        }));
      }
    } catch (err: any) {
      console.error('Error generating share code:', err);
      setShareError('Failed to export entries. Clear connection and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImportSharedEntries = async () => {
    if (!importCode.trim() || !session) return;
    if (isImporting) return; // Atomic loading lock protection (Rule 5)
    setIsImporting(true);
    setImportError('');
    setImportSuccess(false);
    setImportSummary('');
    
    let targetBookId = activeBookId;

    try {
      const cleanedCode = importCode.trim().toUpperCase();
      const nowIso = new Date().toISOString();

      // 1. Supabase query layer validation for existence
      const { data: sharedRow, error: fetchError } = await supabase
        .from('shared_entries')
        .select('entries_json, expires_at')
        .eq('share_code', cleanedCode)
        .maybeSingle();

      if (fetchError) {
        throw new Error('Failed to import entries due to dynamic fetch error.');
      }
      if (!sharedRow || !sharedRow.entries_json) {
        setImportError('Invalid share code. Please double-check and try again.');
        setIsImporting(false);
        return;
      }

      // 2. Clear query layer validation for expiration (expires_at > nowIso)
      const { data: queryLayerVal } = await supabase
        .from('shared_entries')
        .select('share_code')
        .eq('share_code', cleanedCode)
        .gt('expires_at', nowIso)
        .maybeSingle();

      const isExpiredInQueryLayer = !queryLayerVal;
      const isExpiredInFrontend = new Date(sharedRow.expires_at).getTime() < Date.now();

      if (isExpiredInQueryLayer || isExpiredInFrontend) {
        setImportError("This share code has expired.");
        setIsImporting(false);
        return;
      }

      const entriesToImport = sharedRow.entries_json as any[];
      if (!Array.isArray(entriesToImport) || entriesToImport.length === 0) {
        setImportError('No entries found in this shared code.');
        setIsImporting(false);
        return;
      }

      // If there is no active book, create a new book!
      if (!targetBookId) {
        const newBookTitle = `Imported Book (${cleanedCode})`;
        const resolvedUser = await resolveUserDataForAttachments();
        const payload: any = {
          name: newBookTitle,
          user_id: session.user.id,
          user_name: resolvedUser.name
        };
        let newBook: any = null;
        let createError: any = null;

        const firstInsert = await supabase
          .from('cashbooks')
          .insert([payload])
          .select()
          .single();
        newBook = firstInsert.data;
        createError = firstInsert.error;

        if (createError && (createError.code === '42703' || createError.message?.toLowerCase().includes('column'))) {
          const fallbackPayload = { ...payload };
          delete fallbackPayload.user_name;
          const secondInsert = await supabase
            .from('cashbooks')
            .insert([fallbackPayload])
            .select()
            .single();
          newBook = secondInsert.data;
          createError = secondInsert.error;
        }

        if (createError) {
          throw new Error('Failed to create imported cashbook.');
        }
        targetBookId = newBook.id;
        
        // Add to local state
        const newBookWithTransactions = {
          ...newBook,
          transactions: []
        };
        setBooks(prev => [newBookWithTransactions, ...prev]);
      } else {
        // 7. Clear stale import locks automatically after failed imports or refresh interruptions.
        try {
          const { data: locks } = await supabase
            .from('shared_entry_imports')
            .select('id, share_code, cashbook_id')
            .eq('cashbook_id', targetBookId)
            .eq('share_code', cleanedCode);
          
          if (locks && locks.length > 0) {
            for (const lock of locks) {
              const { data: anyEntries } = await supabase
                .from('entries')
                .select('id')
                .eq('cashbook_id', lock.cashbook_id)
                .eq('imported_from_share_code', lock.share_code)
                .limit(1);
              
              if (!anyEntries || anyEntries.length === 0) {
                console.log(`[Import] Clearing stale import lock for code: ${lock.share_code} in cashbook: ${lock.cashbook_id}`);
                await supabase
                  .from('shared_entry_imports')
                  .delete()
                  .eq('id', lock.id);
              }
            }
          }
        } catch (cleanupErr) {
          console.warn('[Import] Non-blocking safety lock cleanup warning:', cleanupErr);
        }
      }

      // Rule 1: Fetch all existing entries in target cashbook beforehand
      let existingEntries: any[] = [];
      try {
        const { data: dbEntries, error: existingErr } = await supabase
          .from('entries')
          .select('id, amount, type, category, description, date, mode, imported_from_share_code')
          .eq('cashbook_id', targetBookId);

        if (!existingErr && dbEntries) {
          existingEntries = dbEntries;
        } else if (existingErr) {
          console.warn('[Import] Primary entries select failed, running fallback...', existingErr.message);
          const { data: fallbackEntries } = await supabase
            .from('entries')
            .select('id, amount, type, category, description, date, mode')
            .eq('cashbook_id', targetBookId);
          if (fallbackEntries) {
            existingEntries = fallbackEntries;
          }
        }
      } catch (e) {
        console.error('[Import] Failed to query existing entries:', e);
      }

      // Rule 2 & 3: Generate deterministic signatures and compare to find final inserts
      const existingSignatures = new Set(existingEntries.map(item => getEntrySignature(item)));
      
      const resolvedUser = await resolveUserDataForAttachments();
      const finalInserts: any[] = [];
      let skippedDuplicatesCount = 0;

      for (const t of entriesToImport) {
        const entrySig = getEntrySignature(t);

        if (existingSignatures.has(entrySig)) {
          // Rule 4: Skip duplicates entirely
          skippedDuplicatesCount++;
        } else {
          finalInserts.push({
            id: safeUUID(),
            amount: parseFloat(t.amount) || 0,
            type: t.type || 'out',
            description: t.description || '',
            category: t.category || 'Food',
            mode: t.mode || 'Cash',
            date: t.date || new Date().toISOString(),
            image_layout: t.image_layout || t.imageLayout || 'split',
            cashbook_id: targetBookId,
            user_id: session.user.id,
            user_name: resolvedUser.name,
            imported_from_share_code: cleanedCode, // Rule 6
            is_imported: true,
            import_batch_id: cleanedCode,
            images: t.images || [], // kept in memory for attachments insert
            source: 'Imported'
          });
        }
      }

      // If there are no unique entries to import (they all already exist by signature/date)
      if (finalInserts.length === 0) {
        // If 0 duplicates exist, never show duplicate warning (Instruction 8)
        if (skippedDuplicatesCount === 0) {
          setImportSummary("Imported: 0");
        } else {
          setImportSummary(`Imported: 0 | Skipped Duplicates: ${skippedDuplicatesCount}`);
          setImportError("These entries were already imported into this cashbook.");
        }
        setIsImporting(false);
        return;
      }

      // Convert entries list to clean rows for `entries` database schema (strip extra `images` key)
      const cleanInserts = finalInserts.map(({ images, ...rest }) => rest);

      console.log('[Import] Ingesting unique entries to database...', cleanInserts.length);
      const { error: err1 } = await supabase
        .from('entries')
        .insert(cleanInserts);

      if (err1) {
        console.warn('[Import] Attempt 1 failed:', err1.message, err1.code);
        const isColumnError = err1.code === '42703' || 
                              err1.message?.includes('column') || 
                              err1.message?.includes('does not exist');

        if (isColumnError) {
          // Rescue Step: Retry without is_imported and import_batch_id first (keep original column set)
          console.log('[Import] Retrying without is_imported and import_batch_id...');
          const baseInserts = cleanInserts.map(({ is_imported, import_batch_id, source, user_name, ...rest }) => rest);
          const { error: errBase } = await supabase
            .from('entries')
            .insert(baseInserts);

          if (errBase) {
            console.warn('[Import] Retry without is_imported/import_batch_id failed:', errBase.message);
            const isColErrorBase = errBase.code === '42703' || 
                                   errBase.message?.includes('column') || 
                                   errBase.message?.includes('does not exist');
            
            if (isColErrorBase) {
              // Attempt 2: Without imported_from_share_code
              console.log('[Import] Retrying without imported_from_share_code...');
              const inserts2 = baseInserts.map(({ imported_from_share_code, ...rest }) => rest);
              const { error: err2 } = await supabase
                .from('entries')
                .insert(inserts2);

              if (err2) {
                console.warn('[Import] Attempt 2 failed:', err2.message, err2.code);
                const isColError2 = err2.code === '42703' || 
                                    err2.message?.includes('column') || 
                                    err2.message?.includes('does not exist');

                if (isColError2) {
                  // Attempt 3: Without image_layout
                  console.log('[Import] Retrying without image_layout...');
                  const inserts3 = baseInserts.map(({ image_layout, ...rest }) => rest);
                  const { error: err3 } = await supabase
                    .from('entries')
                    .insert(inserts3);

                  if (err3) {
                    console.warn('[Import] Attempt 3 failed:', err3.message, err3.code);
                    const isColError3 = err3.code === '42703' || 
                                        err3.message?.includes('column') || 
                                        err3.message?.includes('does not exist');

                    if (isColError3) {
                      // Attempt 4: Without both image_layout and imported_from_share_code
                      console.log('[Import] Retrying without both image_layout and imported_from_share_code...');
                      const inserts4 = baseInserts.map(({ image_layout, imported_from_share_code, ...rest }) => rest);
                      const { error: err4 } = await supabase
                        .from('entries')
                        .insert(inserts4);

                      if (err4) {
                        console.error('[Import] Attempt 4 failed:', err4);
                        throw new Error('Failed to import entries database save failed.');
                      }
                    } else {
                      throw err3;
                    }
                  }
                } else {
                  throw err2;
                }
              }
            } else {
              throw errBase;
            }
          }
        } else {
          throw err1;
        }
      }

      // 6. Ensure imported_from_share_code is only written / logged to history after successful insert completion.
      if (targetBookId) {
        try {
          await supabase
            .from('shared_entry_imports')
            .insert([{
              share_code: cleanedCode,
              cashbook_id: targetBookId,
              imported_by: session.user.id,
              imported_at: new Date().toISOString()
            }]);
          console.log('[Import] History logging completed successfully.');
        } catch (historyLogErr) {
          console.warn('[Import] History logging failed:', historyLogErr);
        }
      }

      // Clone entry images into attachments table
      const attachmentInserts: any[] = [];
      finalInserts.forEach(entry => {
        if (Array.isArray(entry.images) && entry.images.length > 0) {
          entry.images.forEach((imgUrl: string) => {
            if (imgUrl) {
              attachmentInserts.push({
                entry_id: entry.id,
                file_url: imgUrl
              });
            }
          });
        }
      });

      if (attachmentInserts.length > 0) {
        try {
          const { error: attachError } = await supabase
            .from('attachments')
            .insert(attachmentInserts);
          if (attachError) {
            console.warn('[ImportGD] attachments saving warning:', attachError);
          }
        } catch (attachmentsCatchErr) {
          console.warn('[ImportGD] attachments catch warning:', attachmentsCatchErr);
        }
      }

      // Optimistic update of the books list locally to prevent freezing or reload latency
      setBooks(prevBooks => {
        return prevBooks.map(b => {
          if (b.id === targetBookId) {
            const mappedNew = finalInserts.map((ins, index) => ({
              id: ins.id || `imported-temp-${index}-${Date.now()}`,
              amount: ins.amount,
              type: ins.type as 'in' | 'out',
              description: ins.description,
              category: ins.category,
              mode: ins.mode,
              date: new Date(ins.date),
              images: ins.images || [],
              imageLayout: (ins.image_layout || 'split') as 'split' | 'merge'
            }));
            return {
              ...b,
              transactions: [...mappedNew, ...b.transactions]
            };
          }
          return b;
        });
      });

      // Clear caches
      if (targetBookId) {
        entriesCache.delete(targetBookId);
        lastFetchTimeCache.delete(targetBookId);
      }

      if (skippedDuplicatesCount === 0) {
        setImportSummary(`Imported: ${finalInserts.length}`);
      } else {
        setImportSummary(`Imported: ${finalInserts.length} | Skipped Duplicates: ${skippedDuplicatesCount}`);
      }
      setImportSuccess(true);
      setImportCode('');
      
      // Fetch fresh data asynchronously while staying optimistic so UI is instant and doesn't block!
      const updatePromise = fetchData();
      if (targetBookId) {
        handleSelectBook(targetBookId);
      }
      
      setTimeout(() => {
        setShowImportModal(false);
        setImportSuccess(false);
        setImportSummary('');
      }, 3000);

    } catch (err: any) {
      console.error('Error importing shared entries:', err);
      setImportError(err.message || 'Failed to import entries. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const resetFormFields = (keepMode?: boolean) => {
    setAmount('');
    setDescription('');
    setCategory('Food');
    setCustomCategory('');
    if (!keepMode) {
      setMode('Cash');
      setCustomMode('');
    }
    setTransactionDate(safeToDateTimeLocal(new Date()));
    setSelectedImages([]);
  };

  const resetForm = () => {
    setShowForm(null);
    setEditingTransaction(null);
    resetFormFields(false);
    setTransactionTypeFilter('all');
    setTransactionDurationFilter('All');
    setTransactionCategoryFilter('All');
    setTransactionSearchQuery('');
    setIsSubmitting(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const filesArray = Array.from(files).slice(0, 5 - selectedImages.length) as File[];
    if (filesArray.length === 0) return;

    const finalFiles = await editImagesIfNeeded(filesArray);

    const newImages: string[] = [...selectedImages];
    finalFiles.forEach(file => {
      const blobUrl = URL.createObjectURL(file);
      imageFilesRef.current[blobUrl] = file;
      newImages.push(blobUrl);
    });

    setSelectedImages(newImages);
    if (e.target) e.target.value = '';
  };

  const exportToExcel = async () => {
    if (!activeBook || reportLoading) return;
    setReportLoading({ type: 'excel', progress: 0 });
    
    // Simulate progress
    for (let i = 0; i <= 100; i += 10) {
      setReportLoading(prev => prev ? { ...prev, progress: i } : null);
      await new Promise(r => setTimeout(r, 100));
    }

    // Calculate PDF page numbers for reference
    let currentPage = 1;
    const transactionPageMap = new Map<string, string>();
    
    const transactionsWithImages = filteredTransactions.filter(t => t.images && t.images.length > 0);
    for (const t of transactionsWithImages) {
      const layout = t.imageLayout || 'split';
      const imageCount = t.images?.length || 0;
      const pagesUsed = layout === 'merge' ? Math.ceil(imageCount / 2) : imageCount;
      
      if (pagesUsed === 1) {
        transactionPageMap.set(t.id, `Refer Page Number ${currentPage}`);
      } else {
        transactionPageMap.set(t.id, `Refer Page Number ${currentPage} to ${currentPage + pagesUsed - 1}`);
      }
      
      currentPage += pagesUsed;
    }

    const data = filteredTransactions.map(t => ({
      Date: safeFormatDate(t.date),
      Details: t.description,
      Category: t.category,
      Mode: t.mode,
      'Cash In': t.type === 'in' ? t.amount : 0,
      'Cash Out': t.type === 'out' ? t.amount : 0,
      'Reference': transactionPageMap.get(t.id) || '-'
    }));

    // Add totals and balance as per user reference
    const totalIn = totals.in;
    const totalOut = totals.out;
    const balance = totals.net;

    const ws = XLSX.utils.json_to_sheet(data);
    
    // Add summary rows
    XLSX.utils.sheet_add_aoa(ws, [
      [],
      ['', '', '', '', totalIn, totalOut],
      ['', '', '', '', balance]
    ], { origin: -1 });

    // Update summary labels to align with the new column structure
    const lastRow = XLSX.utils.decode_range(ws['!ref'] || 'A1').e.r;
    ws[XLSX.utils.encode_cell({ r: lastRow - 1, c: 3 })] = { v: 'TOTAL', t: 's' };
    ws[XLSX.utils.encode_cell({ r: lastRow, c: 3 })] = { v: 'BALANCE', t: 's' };

    // Apply thin black borders and custom styling to all cells in the sheet
    const borderStyle = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } }
    };

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r; R <= range.e.r; ++R) {
      // Skip the blank separator row between transactions and totals
      if (R === lastRow - 2) continue;
      
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
        
        // On summary rows, we only style cells starting from column 3 (TOTAL/BALANCE labels and their values)
        if (R >= lastRow - 1 && C < 3) {
          continue; 
        }

        if (!ws[cell_address]) {
          ws[cell_address] = { t: 's', v: '' };
        }
        
        const cell = ws[cell_address];
        cell.s = cell.s || {};
        cell.s.border = borderStyle;
        
        // Header styling: light gray background fill and bold text
        if (R === 0) {
          cell.s.fill = { fgColor: { rgb: 'F2F2F2' } };
          cell.s.font = { bold: true };
        }
        
        // Summary labels and values: bold text
        if (R >= lastRow - 1) {
          cell.s.font = { bold: true };
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `${activeBook.name}.xlsx`);
    
    setReportLoading(null);
    setShowReportsMenu(false);
  };
  const exportToPDF = async (isCompressed = true) => {
    if (!activeBook || reportLoading) return;
    try {
      console.log("Starting PDF export. Compressed mode:", isCompressed);
      setReportLoading({ type: 'pdf', progress: 5, message: 'Preparing document setup...' });
      
      // Yield to the browser main thread to render the loading backdrop/popup instantly
      await new Promise(r => setTimeout(r, 60));

      // Feature 11: PDF Object/Stream Compression enabled internally
      const doc = new jsPDF({ compress: true });
      
      setReportLoading({ type: 'pdf', progress: 10, message: 'Scanning cashbook attachments...' });
      await new Promise(r => setTimeout(r, 30));

      // Feature 10: Adaptive Compression by Entry Count
      const isStrongCompression = filteredTransactions.length >= 80;
      if (isCompressed && isStrongCompression) {
        console.log('[PDFExport] 80+ entries detected. Enabling extra aggressive receipt compression.');
      }

      // Attachments only
      const transactionsWithImages = filteredTransactions.filter(t => t.images && t.images.length > 0);
      
      const pool = async <T, R>(
        items: T[],
        limit: number,
        fn: (item: T) => Promise<R>
      ): Promise<R[]> => {
        const results: R[] = [];
        const promises: Promise<void>[] = [];
        let index = 0;

        const run = async (): Promise<void> => {
          const currentIdx = index++;
          if (currentIdx >= items.length) return;
          const item = items[currentIdx];
          results[currentIdx] = await fn(item);
          await run();
        };

        for (let i = 0; i < Math.min(limit, items.length); i++) {
          promises.push(run());
        }

        await Promise.all(promises);
        return results;
      };

      // Inline visual asset helper for jsPDF alias mapping (Feature 5: Prevent Duplicate Embedded Assets)
      const addOptimizedImageToDoc = (
        pdfDoc: jsPDF,
        img: HTMLImageElement | string,
        alias: string,
        x: number,
        y: number,
        w: number,
        h: number
      ) => {
        let format = 'JPEG';
        let src: any = img;
        if (typeof img === 'string') {
          if (img.startsWith('data:image/png')) format = 'PNG';
          else if (img.startsWith('data:image/webp')) format = 'WEBP';
          src = img.includes('base64,') ? img.split('base64,')[1] : img;
        }
        pdfDoc.addImage(src, format as any, x, y, w, h, alias, 'FAST');
      };

      const parseUrlMetadata = (url: string) => {
        const hashIdx = url.indexOf('#');
        const hash = hashIdx !== -1 ? url.substring(hashIdx + 1) : '';
        const params = new URLSearchParams(hash);
        const rotate = parseInt(params.get('rotate') || '0', 10);
        const fit = (params.get('fit') || 'original') as 'width' | 'height' | 'original';
        return { rotate, fit };
      };

      const getRotatedPdfImage = (srcOrImg: string | HTMLImageElement, rotate: number): Promise<{ src: string; width: number; height: number }> => {
        return new Promise((resolve) => {
          const src = typeof srcOrImg === 'string' ? srcOrImg : srcOrImg.src;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const origWidth = img.naturalWidth || img.width;
              const origHeight = img.naturalHeight || img.height;
              
              if (rotate === 0) {
                resolve({ src, width: origWidth, height: origHeight });
                return;
              }

              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                resolve({ src, width: origWidth, height: origHeight });
                return;
              }

              const angleRad = (rotate * Math.PI) / 180;
              const is90or270 = rotate === 90 || rotate === 270;

              const targetWidth = is90or270 ? origHeight : origWidth;
              const targetHeight = is90or270 ? origWidth : origHeight;

              canvas.width = targetWidth;
              canvas.height = targetHeight;

              ctx.translate(targetWidth / 2, targetHeight / 2);
              ctx.rotate(angleRad);
              ctx.drawImage(img, -origWidth / 2, -origHeight / 2, origWidth, origHeight);

              const rotatedSrc = canvas.toDataURL('image/jpeg', 0.85);
              resolve({ src: rotatedSrc, width: targetWidth, height: targetHeight });
            } catch (err) {
              console.error('[PDF] Canvas rotation failed:', err);
              resolve({ src, width: 300, height: 400 });
            }
          };
          img.onerror = () => {
            resolve({ src, width: 300, height: 400 });
          };
          img.src = src;
        });
      };

      if (transactionsWithImages.length > 0) {
        // Collect all distinct and unique image URLs to compress before PDF rendering begins (Feature 9)
        const allImageUrls: string[] = [];
        transactionsWithImages.forEach(t => {
          if (t.images) {
            t.images.forEach(imgUrl => {
              if (imgUrl && !allImageUrls.includes(imgUrl)) {
                allImageUrls.push(imgUrl);
              }
            });
          }
        });

        // 5. CHUNKED PARALLEL IMAGE LOADING: Fetch in background. Use a queue size of max 5.
        // We do NOT block/await the entire pool. We let the background pool start fetching immediately
        // while we progressively render pages. Since we fetch 5 at a time concurrently, and the PDF drawer 
        // will progressively wait for each image in sequence, this ensures incredible speed and smoothness!
        const prefetchPromises = pool(allImageUrls, 5, async (url) => {
          try {
            return await getCachedOptimizedImage(url, isCompressed, isStrongCompression, () => {});
          } catch (e) {
            console.warn('[PDF] Parallel prefetch failed for url:', url, e);
            return url;
          }
        });

        const totalImages = transactionsWithImages.reduce((acc, t) => acc + (t.images?.length || 0), 0);
        let processedImages = 0;
        let isFirstPage = true;

        for (const t of transactionsWithImages) {
          await new Promise(r => setTimeout(r, 10));

          if (t.images) {
            const layout = t.imageLayout || 'split';
            
            if (layout === 'merge') {
              // Merge layout: 2 images per page side-by-side
              for (let i = 0; i < t.images.length; i += 2) {
                await new Promise(r => setTimeout(r, 10));

                if (!isFirstPage) doc.addPage();
                isFirstPage = false;

                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                const margin = 10;
                const gap = 5;
                const availableWidth = pageWidth - (margin * 2) - gap;
                const imgWidth = availableWidth / 2;
                
                const safeTop = 16;
                const safeBottom = pageHeight - 25;
                const availableHeight = safeBottom - safeTop;
                const imgHeight = Math.min(pageHeight * 0.55, availableHeight);
                const y = safeTop + (availableHeight - imgHeight) / 2;

                // Add transaction header
                doc.setFontSize(10);
                doc.setTextColor(80);
                doc.text(`Transaction: ${t.description} (${t.amount}) - ${safeFormatDate(t.date)}`, 10, 10);

                // First image in pair
                try {
                  const rawImg1 = t.images[i];
                  const currentImgIdx = processedImages + 1;
                  setReportLoading({ 
                    type: 'pdf', 
                    progress: Math.min(94, Math.round(10 + (processedImages / totalImages) * 85)),
                    message: `Drawing attachment ${currentImgIdx}/${totalImages} to layout...`
                  });
                  
                  const img1 = await getCachedOptimizedImage(rawImg1, isCompressed, isStrongCompression, () => {});
                  
                  const { rotate, fit } = parseUrlMetadata(rawImg1);
                  const rotatedData = await getRotatedPdfImage(img1, rotate);
                  
                  const ar = rotatedData.width / rotatedData.height;
                  let w = imgWidth;
                  let h = imgWidth / ar;
                  
                  if (fit === 'width') {
                    w = imgWidth;
                    h = imgWidth / ar;
                  } else if (fit === 'height') {
                    h = imgHeight;
                    w = imgHeight * ar;
                  } else { // original contain
                    w = imgWidth;
                    h = imgWidth / ar;
                    if (h > imgHeight) {
                      h = imgHeight;
                      w = imgHeight * ar;
                    }
                  }
                  
                  if (h > imgHeight) {
                    h = imgHeight;
                    w = imgHeight * ar;
                  }
                  if (w > imgWidth) {
                    w = imgWidth;
                    h = imgWidth / ar;
                  }
                  
                  const drawX = margin + (imgWidth - w) / 2;
                  const drawY = y + (imgHeight - h) / 2;
                  
                  addOptimizedImageToDoc(doc, rotatedData.src, rawImg1, drawX, drawY, w, h);
                } catch (e) { console.error(e); }
                processedImages++;

                await new Promise(r => setTimeout(r, 10));

                // Second image in pair (if exists)
                if (i + 1 < t.images.length) {
                  try {
                    const rawImg2 = t.images[i + 1];
                    const currentImgIdx = processedImages + 1;
                    setReportLoading({ 
                      type: 'pdf', 
                      progress: Math.min(94, Math.round(10 + (processedImages / totalImages) * 85)),
                      message: `Drawing attachment ${currentImgIdx}/${totalImages} to layout...`
                    });
                    
                    const img2 = await getCachedOptimizedImage(rawImg2, isCompressed, isStrongCompression, () => {});
                    
                    const { rotate, fit } = parseUrlMetadata(rawImg2);
                    const rotatedData = await getRotatedPdfImage(img2, rotate);
                    
                    const ar = rotatedData.width / rotatedData.height;
                    let w = imgWidth;
                    let h = imgWidth / ar;
                    
                    if (fit === 'width') {
                      w = imgWidth;
                      h = imgWidth / ar;
                    } else if (fit === 'height') {
                      h = imgHeight;
                      w = imgHeight * ar;
                    } else { // original contain
                      w = imgWidth;
                      h = imgWidth / ar;
                      if (h > imgHeight) {
                        h = imgHeight;
                        w = imgHeight * ar;
                      }
                    }
                    
                    if (h > imgHeight) {
                      h = imgHeight;
                      w = imgHeight * ar;
                    }
                    if (w > imgWidth) {
                      w = imgWidth;
                      h = imgWidth / ar;
                    }
                    
                    const drawX = margin + imgWidth + gap + (imgWidth - w) / 2;
                    const drawY = y + (imgHeight - h) / 2;
                    
                    addOptimizedImageToDoc(doc, rotatedData.src, rawImg2, drawX, drawY, w, h);
                  } catch (e) { console.error(e); }
                  processedImages++;
                }
              }
            } else {
              // Split layout: 1 image per page (current behavior)
              for (const img of t.images) {
                await new Promise(r => setTimeout(r, 10));

                try {
                  if (!isFirstPage) doc.addPage();
                  isFirstPage = false;
                  
                  const currentImgIdx = processedImages + 1;
                  setReportLoading({ 
                    type: 'pdf', 
                    progress: Math.min(94, Math.round(10 + (processedImages / totalImages) * 85)),
                    message: `Drawing attachment ${currentImgIdx}/${totalImages} to layout...`
                  });

                  const optimizedImg = await getCachedOptimizedImage(img, isCompressed, isStrongCompression, () => {});
                  
                  const pageWidth = doc.internal.pageSize.getWidth();
                  const pageHeight = doc.internal.pageSize.getHeight();
                  
                  // Centered, tall and slim layout
                  const safeTop = 16;
                  const safeBottom = pageHeight - 25;
                  const availableHeight = safeBottom - safeTop;
                  
                  const maxWidth = pageWidth * 0.62;
                  const maxHeight = Math.min(pageHeight * 0.70, availableHeight);
                  const targetX = (pageWidth - maxWidth) / 2;
                  const targetY = safeTop + (availableHeight - maxHeight) / 2;

                  // Add transaction header
                  doc.setFontSize(10);
                  doc.setTextColor(80);
                  doc.text(`Transaction: ${t.description} (${t.amount}) - ${safeFormatDate(t.date)}`, 10, 10);

                  const { rotate, fit } = parseUrlMetadata(img);
                  const rotatedData = await getRotatedPdfImage(optimizedImg, rotate);
                  
                  const ar = rotatedData.width / rotatedData.height;
                  let w = maxWidth;
                  let h = maxWidth / ar;
                  
                  if (fit === 'width') {
                    w = maxWidth;
                    h = maxWidth / ar;
                  } else if (fit === 'height') {
                    h = maxHeight;
                    w = maxHeight * ar;
                  } else { // original contain
                    w = maxWidth;
                    h = maxWidth / ar;
                    if (h > maxHeight) {
                      h = maxHeight;
                      w = maxHeight * ar;
                    }
                  }
                  
                  if (h > maxHeight) {
                    h = maxHeight;
                    w = maxHeight * ar;
                  }
                  if (w > maxWidth) {
                    w = maxWidth;
                    h = maxWidth / ar;
                  }
                  
                  const drawX = targetX + (maxWidth - w) / 2;
                  const drawY = targetY + (maxHeight - h) / 2;

                  addOptimizedImageToDoc(doc, rotatedData.src, img, drawX, drawY, w, h);
                } catch (e) { console.error(e); }
                
                processedImages++;
              }
            }
          }
        }
      } else {
        doc.setFontSize(12);
        doc.text("No attachments found in this book.", 14, 20);
        await new Promise(r => setTimeout(r, 200));
      }

      setReportLoading({ type: 'pdf', progress: 95, message: 'Finalizing document pagination...' });
      await new Promise(r => setTimeout(r, 100));
      
      const fileName = `${activeBook.name}.pdf`;
      
      // Add page numbers and footer with professional TrackBook branding on every page
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        if (i % 4 === 0) {
          await new Promise(r => setTimeout(r, 15));
        }
        
        doc.setPage(i);
        addPdfBrandingFooter(doc, i, totalPages, activeBook.name);
      }

      await new Promise(r => setTimeout(r, 50));
      setReportLoading({ type: 'pdf', progress: 98, message: 'Saving PDF file to disk...' });
      doc.save(fileName);
      console.log("PDF saved successfully");
      
      setReportLoading({ type: 'pdf', progress: 100, message: 'Export complete!' });
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      console.error("PDF Export failed:", error);
      alert("Failed to download PDF. Please try again.");
    } finally {
      setReportLoading(null);
      setShowReportsMenu(false);
    }
  };

  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0 || !activeBookId) return;

    // Limit to 5 images as per user request
    const filesToProcess = Array.from(files).slice(0, 5) as File[];

    // Bypass cropping workflow; images should be processed immediately upon upload/drop
    const finalFiles = filesToProcess;
    if (finalFiles.length === 0) return;

    const cloudinaryFolder = await getUserCloudinaryFolder(session?.user);

    setIsUploading(true);
    setUploadingMessage('Detecting bills with AI TrackBook...');
    setError(null);

    try {
      if (aiMode === 'merge' && finalFiles.length > 1) {
        setUploadingMessage('Merging and detecting bills...');
        const imagesData: { base64: string, mimeType: string, raw: string | File }[] = [];
        
        for (const file of finalFiles) {
          const isImage = file.type && file.type.startsWith('image/');
          let processedFile: File;

          if (isImage) {
            const compressedBlob = await compressImage(file);
            processedFile = new File([compressedBlob], file.name || 'compressed.jpg', { type: file.type || 'image/jpeg' });
          } else {
            processedFile = file;
          }
          
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(processedFile);
          });
          
          imagesData.push({
            base64: base64.split(',')[1],
            mimeType: processedFile.type || 'image/jpeg',
            raw: processedFile
          });
        }

        console.log('[processFiles] Querying Gemini receipt parser for merged receipts...');
        const result = await parseMultipleReceipts(imagesData.map(img => ({ base64: img.base64, mimeType: img.mimeType })));
        
        if (result) {
          setUploadingMessage('Uploading merged bills to TrackBook Cloud...');
          console.log('[processFiles] Uploading receipt documents to Cloudinary store...');
          
          const cloudinaryUrls: string[] = [];
          for (const img of imagesData) {
            try {
              const u = await uploadToCloudinary(img.raw, cloudinaryFolder);
              cloudinaryUrls.push(u);
            } catch (err: any) {
              console.error('[processFiles] Merged Cloudinary upload error:', err);
              throw new Error(`Cloudinary upload failed: ${err.message || err}`);
            }
          }

          const newTransactionId = safeUUID();

          if (supabase && session) {
            setUploadingMessage('Registering transaction in database...');
            console.log('[processFiles] Inserting entry to database:', { id: newTransactionId });
            try {
              const payload: any = {
                id: newTransactionId,
                cashbook_id: activeBookId,
                user_id: session.user.id,
                amount: result.amount,
                type: result.type,
                description: result.description,
                category: result.category,
                mode: 'Online',
                date: safeToISOString(parseAIDate(result.date)),
                source: 'AI'
              };

              // Try with image_layout first
              const { error: entryError } = await supabase.from('entries').insert([{ ...payload, image_layout: 'merge' }]);
              
              if (entryError) {
                if (entryError.code === '42703' || entryError.message?.includes('column "image_layout" does not exist') || entryError.message?.includes('column "source" does not exist')) {
                  console.warn('[processFiles] image_layout or source missing in schema, retrying fallback...');
                  const fallbackPayload = { ...payload };
                  delete fallbackPayload.source;
                  const { error: retryError } = await supabase.from('entries').insert([fallbackPayload]);
                  if (retryError) throw retryError;
                } else {
                  throw entryError;
                }
              }

              if (cloudinaryUrls.length > 0) {
                console.log('[processFiles] Saving AI attachments rows...');
                const resolvedUser = await resolveUserDataForAttachments();
                const aiAttachmentInserts = await Promise.all(
                  cloudinaryUrls.map(async (url) => {
                    const validated = await validateAndResolveCloudinaryUrl(url, session.user);
                    return {
                      entry_id: newTransactionId,
                      user_id: session.user.id,
                      user_name: resolvedUser.name,
                      user_email: resolvedUser.email,
                      file_url: validated,
                      file_name: 'ai_merged_bill',
                      file_type: 'image'
                    };
                  })
                );
                const { error: attachError } = await supabase.from('ai_attachments').insert(aiAttachmentInserts);
                if (attachError) throw attachError;
              }

              console.log('[processFiles] Completed insertions, triggering database refetch...');
              await fetchData();
            } catch (error: any) {
              console.error('[processFiles] Error syncing merged AI entry (detailed):', error);
              const msg = error.message || 'Unknown error';
              setError(`Database Sync Error: ${msg}. Please ensure your Supabase "amount" column supports decimals.`);
            }
          } else {
            // Local fallback
            const newTransaction: Transaction = {
              id: newTransactionId,
              amount: result.amount,
              type: result.type,
              description: result.description,
              category: result.category,
              mode: 'Online',
              date: parseAIDate(result.date),
              images: cloudinaryUrls,
              isAi: true,
              imageLayout: 'merge',
              source: 'AI'
            };
            setBooks(prev => prev.map(b => 
              b.id === activeBookId 
                ? { ...b, transactions: [newTransaction, ...b.transactions] }
                : b
            ));
          }
        }
      } else {
        let completed = 0;
        const total = finalFiles.length;
        
        for (const file of finalFiles) {
          setUploadingMessage(`Detecting bill ${completed + 1}/${total}...`);
          
          const isImage = file.type && file.type.startsWith('image/');
          let processedFile: File;

          if (isImage) {
            const compressedBlob = await compressImage(file);
            processedFile = new File([compressedBlob], file.name || 'compressed.jpg', { type: file.type || 'image/jpeg' });
          } else {
            processedFile = file;
          }
          
          await new Promise<void>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('File reading failed'));
            reader.onloadend = async () => {
              try {
                const base64String = (reader.result as string).split(',')[1];
                console.log(`[processFiles] Uploading file ${completed + 1}/${total} to Gemini...`);
                const result = await parseReceipt(base64String, processedFile.type || 'image/jpeg');
                
                if (result) {
                  setUploadingMessage(`Uploading receipt ${completed + 1}/${total} to TrackBook Cloud...`);
                  console.log(`[processFiles] Uploading file ${completed + 1}/${total} to Cloudinary...`);
                  
                  let cloudinaryUrl = '';
                  try {
                    cloudinaryUrl = await uploadToCloudinary(processedFile, cloudinaryFolder);
                  } catch (err: any) {
                    console.error('[processFiles] Single Cloudinary upload failed:', err);
                    throw new Error(`Cloudinary file upload failed: ${err.message || err}`);
                  }

                  const newTransactionId = safeUUID();
                  completed++;
                  
                  if (supabase && session) {
                    setUploadingMessage(`Saving bill ${completed}/${total} (SQL)...`);
                    try {
                      const payload: any = {
                        id: newTransactionId,
                        cashbook_id: activeBookId,
                        user_id: session.user.id,
                        amount: result.amount,
                        type: result.type,
                        description: result.description,
                        category: result.category,
                        mode: 'Online',
                        date: safeToISOString(parseAIDate(result.date)),
                        source: 'AI'
                      };

                      // Try with image_layout first
                      const { error: entryError } = await supabase.from('entries').insert([{ ...payload, image_layout: 'split' }]);
                      
                      if (entryError) {
                        if (entryError.code === '42703' || entryError.message?.includes('column "image_layout" does not exist') || entryError.message?.includes('column "source" does not exist')) {
                          const fallbackPayload = { ...payload };
                          delete fallbackPayload.source;
                          const { error: retryError } = await supabase.from('entries').insert([fallbackPayload]);
                          if (retryError) throw retryError;
                        } else {
                          throw entryError;
                        }
                      }

                      console.log('[processFiles] Saving single AI image attachment row...');
                      const validatedSingleUrl = await validateAndResolveCloudinaryUrl(cloudinaryUrl, session.user);
                      const resolvedUser = await resolveUserDataForAttachments();
                      const aiAttachmentInserts = [{
                        entry_id: newTransactionId,
                        user_id: session.user.id,
                        user_name: resolvedUser.name,
                        user_email: resolvedUser.email,
                        file_url: validatedSingleUrl,
                        file_name: 'ai_detected_bill',
                        file_type: 'image'
                      }];
                      const { error: attachError } = await supabase.from('ai_attachments').insert(aiAttachmentInserts);
                      if (attachError) throw attachError;
                      
                    } catch (error: any) {
                      console.error('[processFiles] Error syncing AI entry:', error);
                      const msg = error.message || 'Unknown error';
                      setError(`AI Sync Error: ${msg}. Your Supabase "amount" column likely needs to be changed to DECIMAL.`);
                    }
                  } else {
                    // Local fallback
                    const newTransaction: Transaction = {
                      id: newTransactionId,
                      amount: result.amount,
                      type: result.type,
                      description: result.description,
                      category: result.category,
                      mode: 'Online',
                      date: parseAIDate(result.date),
                      images: [cloudinaryUrl],
                      isAi: true,
                      imageLayout: 'split',
                      source: 'AI'
                    };
                    setBooks(prev => prev.map(b => 
                      b.id === activeBookId 
                        ? { ...b, transactions: [newTransaction, ...b.transactions] }
                        : b
                    ));
                  }
                }
                resolve();
              } catch (err) {
                console.error('Error in file processing callback:', err);
                reject(err);
              }
            };
            reader.readAsDataURL(processedFile);
          });
        }

        // Fetch everything freshly to finalize the batch update
        if (supabase && session && completed > 0) {
          setUploadingMessage('Syncing backend changes...');
          await fetchData();
        }
      }

      setIsUploading(false);
      setShowDropZone(false);
    } catch (error: any) {
      console.error("[processFiles] Upload/AI chain failed:", error);
      setIsUploading(false);
      setShowDropZone(false);
      setError(error.message || 'Processing failed');
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  async function startAiUploadReceiptParsing(filesInput: File | File[] | FileList) {
    if (!activeBookId) return;

    let files: File[] = [];
    if (filesInput instanceof File) {
      files = [filesInput];
    } else if (filesInput instanceof FileList) {
      files = Array.from(filesInput);
    } else if (Array.isArray(filesInput)) {
      files = filesInput;
    }

    if (files.length === 0) return;

    // Filter to images only (JPG, JPEG, PNG, WEBP)
    const validImageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const imageOnlyFiles = files.filter(f => 
      validImageTypes.includes(f.type?.toLowerCase()) || 
      validImageExtensions.some(ext => f.name.toLowerCase().endsWith(ext)) ||
      (f.type && f.type.startsWith('image/'))
    );

    if (imageOnlyFiles.length === 0) {
      setError('Please select image files only (JPG, JPEG, PNG, WEBP).');
      return;
    }

    // Limit to 5 receipts as per BUG 2
    const filesToScan = imageOnlyFiles.slice(0, 5);

    // Bypass cropping workflow; images should be processed immediately upon upload/drop
    const finalFilesToScan = filesToScan;
    if (finalFilesToScan.length === 0) return;

    setSelectedFiles(finalFilesToScan);

    // Auto-detect task name (BUG 3: Food vs Travel Receipts)
    const isFood = finalFilesToScan.some(f => 
      f.name.toLowerCase().includes('food') || 
      f.name.toLowerCase().includes('restaurant') || 
      f.name.toLowerCase().includes('meal') || 
      f.name.toLowerCase().includes('cafe') || 
      f.name.toLowerCase().includes('swiggy') || 
      f.name.toLowerCase().includes('zomato')
    ) || (isHandwritten && handwrittenIsFood);

    const taskName = isFood ? "Food Receipts" : "Travel Receipts";

    // Transition the wizard modal to the scanning/loading step
    setAiConstructionModal('upload');
    setAiWorkflowStep('scanning');

    // Increment uploaded counts today
    for (let i = 0; i < finalFilesToScan.length; i++) {
      incrementUploadedCount();
    }

    // Enqueue the AI Scan Task in the background queue
    const taskId = await backgroundExportManager.enqueueAiScanTask(
      activeBookId,
      activeBook?.name || 'Cashbook',
      finalFilesToScan,
      taskName,
      aiGroupSize,
      isHandwritten,
      handwrittenTime,
      handwrittenIsFood
    );
    setActiveAiTaskId(taskId);
  };

  const handleSaveAiEntry = async (forceSave = false) => {
    if (!activeBookId) return;

    // Commit any pending deletions immediately to Supabase
    if (pendingActionRef.current) {
      await commitPendingDeletion(pendingActionRef.current);
      setUndoAction(null);
      setShowUndoToast(false);
    }

    const amountNum = parseFloat(aiAmount) || 0;
    
    // Parse the date (which is in DD-MM-YYYY format)
    const parts = aiDate.split('-');
    let dateObj = new Date();
    if (parts.length === 3) {
      dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }

    if (!forceSave && activeBook) {
      // Exclude any transactions that are currently in the pending delete queue
      let activeTransactions = activeBook.transactions || [];
      if (pendingActionRef.current) {
        const action = pendingActionRef.current;
        if (action.type === 'transaction' && action.data?.id) {
          activeTransactions = activeTransactions.filter(tx => tx.id !== action.data.id);
        } else if (action.type === 'bulk_transactions' && Array.isArray(action.data)) {
          const deletedIds = new Set(action.data.map((d: any) => d.id));
          activeTransactions = activeTransactions.filter(tx => !deletedIds.has(tx.id));
        }
      }

      const isDuplicate = activeTransactions.some(tx => {
        const amountMatches = Math.abs(tx.amount - amountNum) < 0.01;
        
        const txDateStr = new Date(tx.date).toDateString();
        const newDateStr = dateObj.toDateString();
        const dateMatches = txDateStr === newDateStr;
        
        const txDescLower = (tx.description || '').toLowerCase();
        const newDescLower = aiDescription.toLowerCase();
        const newMerchantLower = aiMerchant.toLowerCase();
        
        const descMatches = txDescLower.includes(newMerchantLower) || 
                            newDescLower.includes(txDescLower) || 
                            txDescLower.includes(newDescLower);
                            
        return amountMatches && dateMatches && descMatches;
      });

      if (isDuplicate) {
        setShowDuplicateAiWarning({
          onConfirm: () => {
            setShowDuplicateAiWarning(null);
            handleSaveAiEntry(true);
          },
          onCancel: () => {
            setShowDuplicateAiWarning(null);
          }
        });
        return;
      }
    }

    setIsUploading(true);
    setError(null);

    const tempId = safeUUID();
    const cloudinaryFolder = await getUserCloudinaryFolder(session?.user);

    const localBlobUrl = aiFilePreviewUrl;
    const imagesToStore = localBlobUrl ? [localBlobUrl] : [];

    const ocrData = {
      merchant: aiMerchant,
      billType: aiBillType,
      extractedTime: aiTime,
      mealType: aiMealType,
      groupSize: aiGroupSize,
      ocr_confidence: aiOcrConfidence,
      ocr_duration_ms: aiOcrDuration
    };

    const newTransaction: Transaction = {
      id: tempId,
      amount: amountNum,
      type: 'out', // Expense
      description: aiDescription,
      category: aiCategory || 'General',
      mode: 'Online',
      date: dateObj,
      images: imagesToStore,
      imageLayout: 'split',
      isAi: true
    };

    // Cache the attachments
    attachmentCache.set(tempId, { images: imagesToStore, isAi: true });

    // Update entriesCache
    const currCached = entriesCache.get(activeBookId) || [];
    entriesCache.set(activeBookId, [{ 
      id: tempId, 
      amount: amountNum, 
      type: 'out', 
      description: aiDescription, 
      category: aiCategory || 'General', 
      mode: 'Online', 
      date: dateObj, 
      image_layout: 'split',
      user_id: session?.user?.id,
      cashbook_id: activeBookId
    }, ...currCached]);

    // Instantly add to State
    setBooks(prevBooks => prevBooks.map(b => 
      b.id === activeBookId 
        ? { ...b, transactions: [newTransaction, ...b.transactions] }
        : b
    ));

    // Run direct database updates in background!
    incrementProcessedCount(1);
    if (supabase && session) {
      const savedAmount = amountNum;
      const savedDescription = aiDescription;
      const savedCategory = aiCategory;
      const savedBillType = aiBillType;
      const savedDateObj = dateObj;
      const savedFile = aiFile;
      const savedCloudinaryUrl = aiCloudinaryUrl;

      (async () => {
        try {
          let imageUrl = savedCloudinaryUrl;
          if (!imageUrl && savedFile) {
            imageUrl = await uploadToCloudinary(savedFile, cloudinaryFolder);
          }

          const payload: any = {
            id: tempId,
            cashbook_id: activeBookId,
            user_id: session.user.id,
            amount: savedAmount,
            type: 'out',
            description: savedDescription,
            category: savedCategory || 'General',
            mode: 'Online',
            date: safeToISOString(savedDateObj),
            image_layout: 'split'
          };

          const { error: entryError } = await supabase.from('entries').insert([payload]);
          if (entryError) {
            if (entryError.code === '42703' || entryError.message?.includes('column "image_layout" does not exist')) {
              delete payload.image_layout;
              const { error: retryError } = await supabase.from('entries').insert([payload]);
              if (retryError) throw retryError;
            } else {
              throw entryError;
            }
          }

          if (imageUrl) {
            const validatedUrl = await validateAndResolveCloudinaryUrl(imageUrl, session.user);
            const resolvedUser = await resolveUserDataForAttachments();
            const aiAttachmentInserts = [{
              entry_id: tempId,
              user_id: session.user.id,
              user_name: resolvedUser.name,
              user_email: resolvedUser.email,
              file_url: validatedUrl,
              file_name: JSON.stringify({
                original_name: savedFile?.name || 'receipt',
                ocr: ocrData,
                classification: savedBillType,
                groupSize: aiGroupSize
              }),
              file_type: 'image'
            }];
            await supabase.from('ai_attachments').insert(aiAttachmentInserts);
          }
          await fetchData();
        } catch (dbErr) {
          console.error('[AI Save BG] Database sync error:', dbErr);
        }
      })();
    }

    // Shift queue for next handwritten bill if available
    const nextIndex = currentQueueIndex + 1;
    if (nextIndex < handwrittenQueue.length) {
      setCurrentQueueIndex(nextIndex);
      const nextItem = handwrittenQueue[nextIndex];
      setAiAmount(String(nextItem.result.amount));
      setAiMerchant(nextItem.result.merchant || 'Unknown Vendor');
      setAiBillType(nextItem.result.billType || 'Food');
      setAiCategory(nextItem.result.category || 'Food');
      setAiDate(nextItem.result.date || '27-05-2026');
      setAiTime(nextItem.result.time || '12:00 PM');
      setAiMealType(nextItem.result.mealType || '');
      setAiDescription(nextItem.result.description || 'Food Expense');
      setAiOcrConfidence(nextItem.result.ocr_confidence ?? 100);
      setAiOcrDuration(nextItem.result.ocr_duration_ms ?? 0);
      setAiAnalytics(nextItem.result.analytics || null);
      setAiCloudinaryUrl(nextItem.result.cloudinaryUrl || '');
      setAiFile(nextItem.file);
      setAiFilePreviewUrl(nextItem.previewUrl);
      setIsUploading(false); // Let user edit next
    } else {
      // Completed last entry, transition to completion screen
      setAiWorkflowStep('completion');
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await processFiles(e.target.files);
    }
  };

  const handleSignOut = async () => {
    try {
      clearSessionUnlocked();
      localStorage.removeItem('trackbook_cached_books');
      localStorage.removeItem('trackbook_avatar');
    } catch (e) {}
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  if (isLoading && books.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <Loader2 className="animate-spin text-indigo-600 animate-duration-1000" size={40} />
          <p className="text-sm font-medium text-slate-500 animate-pulse font-sans">Initializing dashboard...</p>
        </div>
      </div>
    );
  }
  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300 overflow-x-clip",
      theme === 'dark' ? "bg-black text-slate-100" : "bg-slate-50 text-black"
    )}>
      {showOfflineDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={cn(
            "w-full max-w-md p-6 rounded-3xl shadow-xl space-y-4 text-center border transition-all duration-300 transform scale-100",
            theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-slate-150 text-slate-900"
          )}>
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-500">
              <CloudOff size={24} />
            </div>
            <h3 className="text-lg font-black tracking-tight">You're Offline</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              We couldn't sync your latest data because your device is offline.
              You can continue creating entries normally.
              Everything will automatically sync once your internet connection is restored.
            </p>
            <button
              onClick={() => setShowOfflineDialog(false)}
              className="w-full py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/10 active:scale-98"
            >
              Continue Offline
            </button>
          </div>
        </div>
      )}

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="fixed top-0 left-0 right-0 bg-rose-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 z-[100] flex-wrap"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="hover:bg-white/20 rounded p-0.5 transition-colors cursor-pointer outline-none border-none">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Session Restored Alert */}
      <AnimatePresence>
        {restoredMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 bg-emerald-600 dark:bg-emerald-700 text-white px-5 py-2.5 rounded-full text-xs font-bold flex items-center gap-2.5 z-[100] shadow-xl border border-emerald-500/30 tracking-wide"
          >
            <CheckSquare size={16} />
            <span>{restoredMessage}</span>
            <button
              type="button"
              onClick={() => setRestoredMessage('')}
              className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors cursor-pointer outline-none border-none text-white/90 hover:text-white flex items-center justify-center"
              title="Close"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Component */}
      {!activeBookId && (
        <header className={cn(
          "border-b sticky top-0 z-50 px-4 h-14 sm:h-16 transition-colors duration-300",
          theme === 'dark' ? "bg-black border-zinc-900" : "bg-white border-slate-100"
        )}>
          <div className="w-full h-full flex items-center justify-between gap-2 sm:gap-4 px-6 md:px-8">
            
            {/* Left: Logo */}
            <div className="flex items-center shrink-0 select-none">
              <span className="font-sans text-[15px] sm:text-base tracking-[0.08em] uppercase font-semibold text-indigo-600 dark:text-indigo-400">
                TRACKBOOK
              </span>
            </div>

            {/* Center: Desktop Search (Centered) */}
            <div className="hidden sm:flex flex-1 justify-center px-4">
              <div className="w-full max-w-md relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input 
                  type="text"
                  placeholder="Search your books..."
                  value={searchQueryInput}
                  onChange={(e) => setSearchQueryInput(e.target.value)}
                  className={cn(
                    "w-full pl-10 pr-4 py-2 border-none rounded-full focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                    theme === 'dark' ? "bg-slate-800 text-white" : "bg-slate-100 text-black"
                  )}
                />
              </div>
            </div>

            {/* Right: Mobile Search Icon + Profile Dropdown */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Mobile Search Button (Right side) */}
              <button 
                onClick={() => { vibrate(); setIsSearchExpanded(true); }}
                className="sm:hidden p-2 text-slate-400 hover:text-indigo-600 transition-colors"
              >
                <Search size={20} />
              </button>

              {/* Notification Bell */}
              <NotificationBell session={session} theme={theme} onInviteAccepted={fetchData} />

              {/* Inline Download Center Trigger */}
              <DownloadCenterTrigger theme={theme} isOpen={showDownloadCenter} setIsOpen={setShowDownloadCenter} />

              <div className="relative shrink-0" ref={dropdownRef}>
                <button 
                  onClick={() => { vibrate(); setIsProfileOpen(!isProfileOpen); }}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-600 ring-2 ring-indigo-500/30 hover:ring-indigo-500/60 transition-all cursor-pointer select-none overflow-hidden flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0 aspect-square shadow-sm active:scale-95"
                  style={{ borderRadius: '9999px', clipPath: 'circle(50% at 50% 50%)' }}
                  title="Profile and settings"
                  aria-label="Profile and settings"
                >
                  {userAvatarUrl ? (
                    <img 
                      src={userAvatarUrl} 
                      alt={userName || "Profile"} 
                      className="w-full h-full object-cover block" 
                      style={{ borderRadius: '9999px', objectFit: 'cover' }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="select-none font-bold">{userName && userName.length > 0 ? userName[0].toUpperCase() : 'U'}</span>
                  )}
                </button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className={cn(
                        "absolute right-0 mt-2 w-64 rounded-2xl shadow-2xl border p-2 z-50 transition-colors duration-300",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-200"
                      )}
                    >
                      <div className={cn(
                        "p-3 border-b mb-2 transition-colors duration-300 flex items-center gap-3",
                        theme === 'dark' ? "border-zinc-800" : "border-slate-100"
                      )}>
                        <div 
                          className="w-10 h-10 rounded-full bg-indigo-600 ring-2 ring-indigo-500/20 overflow-hidden flex items-center justify-center text-white font-bold text-sm shrink-0 aspect-square shadow-sm"
                          style={{ borderRadius: '9999px', overflow: 'hidden' }}
                        >
                          {userAvatarUrl ? (
                            <img 
                              src={userAvatarUrl} 
                              alt={userName || "Profile"} 
                              className="w-full h-full object-cover rounded-full block" 
                              style={{ borderRadius: '9999px', objectFit: 'cover' }}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="select-none font-bold">{userName && userName.length > 0 ? userName[0].toUpperCase() : 'U'}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Signed in as</p>
                          <p className={cn(
                            "font-bold truncate text-sm transition-colors duration-300",
                            theme === 'dark' ? "text-slate-100" : "text-black"
                          )}>{userName}</p>
                          {userPhoneVerified && (
                            <div className="flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-widest bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-900/30 w-fit">
                              ✓ Verified Mobile
                            </div>
                          )}
                        </div>
                      </div>

                      <button 
                        onClick={(e) => { vibrate(); toggleTheme(e); }}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                          theme === 'dark' ? "hover:bg-zinc-900 text-slate-300" : "hover:bg-slate-50 text-black"
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                          <span className="font-medium text-left">Appearance</span>
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {theme}
                        </div>
                      </button>

                      <button 
                        onClick={() => { vibrate(5); setIsAutomationMailConfirmOpen(true); setIsProfileOpen(false); }}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                          theme === 'dark' ? "hover:bg-zinc-900 text-slate-300" : "hover:bg-slate-50 text-black"
                        )}
                      >
                        <Mail size={18} className="text-indigo-500" />
                        <span className="font-medium flex-1 text-left flex items-center gap-2">
                          <span>Automation Mail</span>
                          <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-full uppercase tracking-widest border border-indigo-500/10">BETA</span>
                        </span>
                      </button>

                      {/* Mobile-Only Security Options */}
                      {isMobileSecurityActive && (
                        <>
                          <button 
                            onClick={() => { vibrate(); navigate('/biometric-security'); setIsProfileOpen(false); }}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                              theme === 'dark' ? "hover:bg-zinc-900 text-slate-300" : "hover:bg-slate-50 text-black"
                            )}
                          >
                            <Fingerprint size={18} className="text-indigo-500" />
                            <span className="font-medium flex-1 text-left">Fingerprint & Face Lock</span>
                          </button>

                          {!hasUserMpin ? (
                            <button 
                              onClick={() => { vibrate(); openMpinCreateModal(); setIsProfileOpen(false); }}
                              className={cn(
                                "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                                theme === 'dark' ? "hover:bg-zinc-900 text-slate-300" : "hover:bg-slate-50 text-black"
                              )}
                            >
                              <Shield size={18} className="text-indigo-500" />
                              <span className="font-medium flex-1 text-left">Create your TPIN</span>
                            </button>
                          ) : (
                            <>
                              <button 
                                onClick={() => { vibrate(); openMpinChangeModal(); setIsProfileOpen(false); }}
                                className={cn(
                                  "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                                  theme === 'dark' ? "hover:bg-zinc-900 text-slate-300" : "hover:bg-slate-50 text-black"
                                )}
                              >
                                <KeyRound size={18} className="text-indigo-500" />
                                <span className="font-medium flex-1 text-left">Change your TPIN</span>
                              </button>
                              <button 
                                onClick={() => { vibrate(); openMpinForgotModal(); setIsProfileOpen(false); }}
                                className={cn(
                                  "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                                  theme === 'dark' ? "hover:bg-zinc-900 text-slate-300" : "hover:bg-slate-50 text-black"
                                )}
                              >
                                <RefreshCw size={18} className="text-indigo-500" />
                                <span className="font-medium flex-1 text-left">Forgot TPIN</span>
                              </button>
                            </>
                          )}
                        </>
                      )}

                      <button 
                        onClick={() => { setIsEditingName(true); setIsProfileOpen(false); }}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                          theme === 'dark' ? "hover:bg-zinc-900 text-slate-300" : "hover:bg-slate-50 text-black"
                        )}
                      >
                        <Settings size={18} />
                        <span className="font-medium flex-1 text-left">Settings</span>
                      </button>

                      <button 
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 transition-all"
                      >
                        <LogOut size={18} />
                        <span className="font-medium flex-1 text-left">Logout</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Mobile Search Overlay */}
          <AnimatePresence>
            {isSearchExpanded && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  "absolute inset-0 z-[60] px-4 flex items-center gap-2 transition-colors duration-300",
                  theme === 'dark' ? "bg-black" : "bg-white"
                )}
              >
                <button onClick={() => setIsSearchExpanded(false)} className="p-2 text-slate-400 hover:text-indigo-600">
                  <ArrowLeft size={20} />
                </button>
                <input 
                  autoFocus
                  type="text"
                  placeholder="Search books..."
                  value={searchQueryInput}
                  onChange={(e) => setSearchQueryInput(e.target.value)}
                  className={cn(
                    "flex-1 rounded-full py-2 px-4 outline-none text-sm transition-all",
                    theme === 'dark' ? "bg-slate-800 text-white" : "bg-slate-100 text-black"
                  )}
                />
                {searchQueryInput && (
                  <button onClick={() => { setSearchQueryInput(''); setSearchQuery(''); }} className="p-2 text-slate-400">
                    <X size={18} />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </header>
      )}

      {/* Main Content Area */}
      <main className="w-full px-6 md:px-8 py-6 sm:py-8 overflow-x-clip">
        {!activeBookId ? (
          /* PAGE 1: HOME / BOOKS LIST */
          <motion.div
            key="home"
            initial={shouldReduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
              {/* User Welcome Section */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5 sm:space-y-1">
                  <h2 className={cn(
                    "text-xl sm:text-2xl lg:text-[clamp(1.35rem,2vw,1.75rem)] font-bold transition-colors duration-300 flex items-center gap-2 flex-wrap",
                    theme === 'dark' ? "text-slate-100" : "text-slate-800"
                  )}>
                    Hello, <span className="text-indigo-600 dark:text-indigo-400">{userName}</span>!
                    {userPhoneVerified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-900/30">
                        ✓ Verified
                      </span>
                    )}
                  </h2>
                  <p className={cn(
                    "text-xs sm:text-sm transition-colors duration-300",
                    theme === 'dark' ? "text-slate-400" : "text-slate-500"
                  )}>Welcome back to your financial dashboard.</p>
                </div>

                <div className="flex items-center gap-3 sm:gap-4">
                  {selectedBooks.size > 0 ? (
                    <button
                      onClick={() => { vibrate(); setShowBulkDeleteConfirm(true); setDeleteConfirmed(false); }}
                      className={cn(
                        "flex-1 sm:flex-none py-2 sm:py-2.5 px-4 sm:px-6 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm sm:text-base animate-in fade-in zoom-in duration-200",
                        theme === 'dark' ? "shadow-none" : "shadow-lg shadow-rose-100"
                      )}
                    >
                      <Trash2 size={18} />
                      Delete ({selectedBooks.size})
                    </button>
                  ) : (
                    books.length > 0 && (
                      <button
                        onClick={() => { vibrate(); setIsCreatingBook(true); }}
                        className={cn(
                          "group/shortcut relative py-2 sm:py-2.5 px-3.5 sm:px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm hover:scale-[1.02] active:scale-[0.98] duration-200 cursor-pointer w-auto shrink-0",
                          theme === 'dark' ? "shadow-none" : "shadow-lg shadow-indigo-100"
                        )}
                      >
                        <Plus size={16} />
                        <span>Create a Book</span>
                        <span className="hidden lg:group-hover/shortcut:flex absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded shadow-lg whitespace-nowrap items-center gap-1 z-50">
                          Press <kbd className="bg-slate-700 px-1 rounded">C</kbd> + <kbd className="bg-slate-700 px-1 rounded">B</kbd>
                        </span>
                      </button>
                    )
                  )}

                  <div className={cn(
                    "hidden sm:flex items-center gap-2 p-1 rounded-xl border shadow-sm transition-colors duration-300",
                    theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-100"
                  )}>
                    <button 
                      onClick={() => setViewMode('grid')}
                      className={cn(
                        "p-2 rounded-lg transition-all cursor-pointer", 
                        viewMode === 'grid' 
                          ? (theme === 'dark' ? "bg-indigo-600 text-white shadow-none" : "bg-indigo-600 text-white shadow-lg shadow-indigo-100") 
                          : (theme === 'dark' ? "text-slate-400 hover:bg-slate-800" : "text-slate-400 hover:bg-slate-50")
                      )}
                    >
                      <LayoutGrid size={20} />
                    </button>
                    <button 
                      onClick={() => setViewMode('list')}
                      className={cn(
                        "p-2 rounded-lg transition-all cursor-pointer", 
                        viewMode === 'list' 
                          ? (theme === 'dark' ? "bg-indigo-600 text-white shadow-none" : "bg-indigo-600 text-white shadow-lg shadow-indigo-100") 
                          : (theme === 'dark' ? "text-slate-400 hover:bg-slate-800" : "text-slate-400 hover:bg-slate-50")
                      )}
                    >
                      <List size={20} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Books Section */}
              {filteredBooks.length === 0 ? (
                <div className={cn(
                  "flex flex-col items-center justify-center p-6 sm:p-10 text-center space-y-4 sm:space-y-5 border rounded-3xl shadow-sm mx-auto max-w-sm sm:max-w-md transition-colors duration-300",
                  theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-100"
                )}>
                  <div className={cn(
                    "w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-colors duration-300 shadow-inner",
                    theme === 'dark' ? "bg-indigo-950/40 text-indigo-400" : "bg-indigo-50 text-indigo-600"
                  )}>
                    <BookOpen size={22} className="sm:w-6 sm:h-6" />
                  </div>
                  <div className="space-y-1 px-4">
                    <h3 className={cn(
                      "text-base sm:text-lg font-black transition-colors duration-300",
                      theme === 'dark' ? "text-slate-100" : "text-slate-800"
                    )}>No Cashbooks Yet</h3>
                    <p className={cn(
                      "max-w-[220px] sm:max-w-xs mx-auto text-xs transition-colors duration-300 leading-relaxed",
                      theme === 'dark' ? "text-slate-400" : "text-slate-500"
                    )}>Start your financial journey by creating your first cashbook today.</p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => { vibrate(); setIsCreatingBook(true); }}
                      className={cn(
                        "w-auto inline-flex items-center justify-center gap-2 py-2.5 px-5 sm:px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all active:scale-95 text-xs sm:text-sm cursor-pointer shadow-md shadow-indigo-500/20",
                        theme === 'dark' ? "shadow-none" : ""
                      )}
                    >
                      <Plus size={16} />
                      Create a Book
                    </button>
                  </div>
                </div>
              ) : (
                <div className={cn(
                  "grid w-full",
                  viewMode === 'grid' 
                    ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6" 
                    : "grid-cols-1 gap-3"
                )}>
                  {filteredBooks.map((book) => (
                    <motion.div
                      key={book.id}
                      initial={false}
                      animate={
                        justEditedBookId === book.id
                          ? { scale: [1, 1.05, 1.05, 1], y: 0, opacity: 1 }
                          : { opacity: 1, y: 0, scale: 1 }
                      }
                      transition={
                        justEditedBookId === book.id
                          ? { duration: 1.5, times: [0, 0.2, 0.8, 1], ease: "easeInOut" }
                          : { duration: 0.2, ease: "easeOut" }
                      }
                      onMouseDown={() => onTouchStartBook(book.id)}
                      onMouseUp={onTouchEndBook}
                      onTouchStart={() => onTouchStartBook(book.id)}
                      onTouchEnd={onTouchEndBook}
                      onClick={() => handleBookPress(book.id)}
                      className={cn(
                        "group border rounded-2xl md:rounded-[20px] transition-all duration-200 relative overflow-hidden select-none flex items-center justify-between cursor-pointer w-full",
                        viewMode === 'list'
                          ? "p-3 sm:p-3.5 md:p-3 md:h-[72px] border-b border-slate-100/80 dark:border-zinc-800/60"
                          : "p-4 sm:p-5 md:p-4 md:h-[120px]",
                        justEditedBookId === book.id
                          ? (theme === 'dark' ? "bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20 font-bold" : "bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-500/30 font-bold")
                          : theme === 'dark' 
                            ? "border-transparent bg-transparent hover:bg-zinc-900/90 hover:border-zinc-800 hover:shadow-sm" 
                            : "border-transparent bg-transparent hover:bg-slate-100 hover:border-slate-200 hover:shadow-sm",
                      )}
                    >
                      {selectedBooks.has(book.id) && (
                        <div className="absolute top-2 right-2 z-10">
                          <div className="bg-indigo-600 text-white rounded-full p-1 shadow-md">
                            <Check size={12} />
                          </div>
                        </div>
                      )}
                      <div className="flex-grow flex-1 min-w-0 flex items-center gap-2 md:gap-3 pr-1 md:pr-1.5">
                        <div className="p-2 md:p-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl md:rounded-[14px] group-hover:scale-110 transition-transform flex-shrink-0">
                          <BookOpen size={18} className="w-[18px] h-[18px] md:w-5 md:h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className={cn(
                            "font-bold text-base sm:text-[17px] md:text-lg break-words whitespace-normal leading-snug line-clamp-2 transition-colors duration-300",
                            theme === 'dark' ? "text-slate-100" : "text-slate-800"
                          )}>{book.name}</h4>
                          <p className={cn(
                            "text-[9px] md:text-[10px] mt-0.5 transition-colors duration-300",
                            theme === 'dark' ? "text-slate-500" : "text-slate-400"
                          )}>Created on {formatDateTime12h(book.createdAt)}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0 ml-1.5 md:ml-3">
                        <div className="flex items-center gap-0.5 md:gap-1 border-l border-slate-100 dark:border-slate-800 pl-1.5 md:pl-2.5">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setIsEditingBook(book.id); setEditBookName(book.name); }}
                            className="p-1 md:p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                          >
                            <Pencil size={12} className="w-[14px] h-[14px] md:w-[16px] md:h-[16px]" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteBook(book.id); }}
                            className="p-1 md:p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                          >
                            <Trash2 size={12} className="w-[14px] h-[14px] md:w-[16px] md:h-[16px]" />
                          </button>
                          <button 
                            onClick={() => handleSelectBook(book.id)}
                            className="p-1.5 md:p-1.5 text-indigo-800 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all ml-0.5"
                          >
                            <motion.div
                              animate={{ x: [0, 3, 0] }}
                              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                            >
                              <ArrowRight size={16} className="w-[16px] h-[16px] md:w-[18px] md:h-[18px]" />
                            </motion.div>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
              /* PAGE 2: INDIVIDUAL CASHBOOK VIEW */
            <motion.div
              key={activeBookId}
              initial={shouldReduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="w-full space-y-4 sm:space-y-6 pb-[180px] lg:pb-0"
            >
              {/* STICKY TOP CONTROLS SECTION */}
              <div className={cn(
                "lg:sticky lg:top-0 z-30 transition-colors duration-300 border-b",
                "-mt-2 pt-2 -mx-6 px-6 pb-3 mb-2",
                "sm:-mt-4 sm:pt-4 sm:pb-4 sm:mb-4",
                "md:-mt-6 md:pt-6 md:-mx-8 md:px-8 md:pb-5 md:mb-5",
                "space-y-2.5 sm:space-y-4 shadow-sm",
                theme === 'dark' ? "bg-black/95 backdrop-blur-md border-zinc-900" : "bg-slate-50/95 backdrop-blur-md border-slate-200"
              )}>
                {/* Header Actions */}
                <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-1.5 sm:gap-2.5">
                  <button 
                    onClick={() => {
                      vibrate();
                      if (currentTabName !== 'entries') {
                        const slug = getBookSlug(activeBook?.name || '', activeBook?.id || '');
                        navigate(`/cashbooks/${slug}/entries`);
                      } else {
                        handleSelectBook(null);
                      }
                    }}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-450 transition-colors shrink-0"
                  >
                    <ArrowLeft size={22} className="sm:w-[24px] sm:h-[24px]" />
                  </button>
                  <div className="flex items-center gap-2 font-sans font-bold text-base sm:text-lg tracking-tight select-none leading-none min-w-0">
                    <h2 className={cn(
                      "font-black truncate max-w-[140px] xs:max-w-[180px] sm:max-w-[280px] md:max-w-none lg:text-[clamp(1.125rem,2.2vw,1.5rem)] transition-colors duration-300 text-slate-900 dark:text-slate-100",
                    )}>{activeBook?.name}</h2>
                    {currentUserRole && (
                      <span className={cn(
                        "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border tracking-wider shrink-0 select-none shadow-2xs",
                        (currentUserRole === 'Primary Admin' || currentUserRole === 'Admin')
                          ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25"
                          : currentUserRole === 'Book Admin'
                          ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25"
                          : currentUserRole === 'Data Operator'
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25"
                          : "bg-slate-500/10 text-slate-600 dark:text-zinc-400 border-slate-500/25"
                      )}>
                        {currentUserRole === 'Primary Admin' ? 'Admin' : currentUserRole}
                      </span>
                    )}
                  </div>
                </div>
                </div>
                
                {/* Right actions: Import Entries + Add Member Icon (Admin Blue) + 3-Lines Menu */}
                <div className="flex items-center gap-1 sm:gap-1.5">
                  {canAddEntries(currentUserRole) && (
                    <button
                      onClick={() => {
                        vibrate();
                        setShowImportModal(true);
                      }}
                      title="Import Entries"
                      className={cn(
                        "hidden md:flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 duration-150 whitespace-nowrap",
                        theme === 'dark'
                          ? "bg-amber-950/30 border-amber-900/50 text-amber-400 hover:bg-amber-950/50"
                          : "bg-amber-50/80 border-amber-200/80 text-amber-800 hover:bg-amber-100/80"
                      )}
                    >
                      <DownloadCloud size={15} className="text-amber-500 shrink-0" />
                      <span className="font-bold">Import Entries</span>
                    </button>
                  )}

                  {/* Add Member Icon (Admin Blue, No Border, positioned right next to 3-lines menu) */}
                  {canManageMembers(currentUserRole) && (
                    <button
                      onClick={() => {
                        vibrate();
                        const slug = getBookSlug(activeBook?.name || '', activeBook?.id || '');
                        navigate(`/cashbooks/${slug}/members`);
                      }}
                      title="Add Member / Members & Access"
                      aria-label="Add Member"
                      className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-xl transition-all cursor-pointer active:scale-95 duration-150 shrink-0 border-0 outline-none",
                        currentTabName === 'members'
                          ? "bg-blue-600 text-white shadow-blue-500/20"
                          : "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                      )}
                    >
                      <UserPlus size={20} />
                    </button>
                  )}

                  {/* 3-Lines Overflow/Book Actions Menu */}
                  <div className="relative" ref={bookMenuRef}>
                  <button 
                    onClick={() => setShowBookMenu(!showBookMenu)}
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-xl transition-all cursor-pointer active:scale-95 duration-150 hover:bg-slate-100 dark:hover:bg-slate-800/60 border-0 outline-none",
                      theme === 'dark' 
                        ? "text-slate-200" 
                        : "text-slate-600"
                    )}
                    aria-label="Book Options"
                  >
                    <Menu size={20} />
                  </button>
                  <AnimatePresence>
                    {showBookMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className={cn(
                          "absolute right-0 mt-2 w-52 rounded-2xl shadow-2xl p-1.5 z-50 border backdrop-blur-xl transition-all",
                          theme === 'dark' 
                            ? "bg-zinc-950/95 border-zinc-900 text-white" 
                            : "bg-white/95 border-slate-200 text-slate-900"
                        )}
                      >
                        {/* Navigation Section */}
                        <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                          View Sections
                        </div>
                        {[
                          { id: 'entries', label: 'Entries', icon: List },
                          { id: 'reports', label: 'Reports', icon: FileText }
                        ].map((tab) => {
                          const isActive = currentTabName === tab.id;
                          const Icon = tab.icon;
                          return (
                            <button
                              key={tab.id}
                              onClick={() => {
                                setShowBookMenu(false);
                                vibrate();
                                const slug = getBookSlug(activeBook?.name || '', activeBook?.id || '');
                                navigate(`/cashbooks/${slug}/${tab.id}`);
                              }}
                              className={cn(
                                "w-full flex items-center gap-2.5 p-2 rounded-xl transition-all cursor-pointer text-left shadow-sm text-xs border mb-1 last:mb-0",
                                isActive 
                                  ? theme === 'dark'
                                    ? "bg-indigo-950/40 border-indigo-900/60 text-indigo-400 font-extrabold"
                                    : "bg-indigo-50/60 border-indigo-100/80 text-indigo-700 font-extrabold"
                                  : theme === 'dark'
                                    ? "bg-transparent border-transparent text-slate-300 hover:bg-zinc-900 hover:border-zinc-805"
                                    : "bg-transparent border-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-105"
                              )}
                            >
                              <Icon size={14} className={cn("shrink-0", isActive ? "text-indigo-500" : "opacity-70 dark:opacity-80")} />
                              <span>{tab.label}</span>
                            </button>
                          );
                        })}

                        <div className="border-t border-slate-100 dark:border-zinc-900/60 my-1.5 md:hidden" />

                        {/* Actions Section - Mobile View */}
                        <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1 md:hidden">
                          Book Actions
                        </div>
                        <button 
                          onClick={() => { setShowBookMenu(false); setShowImportModal(true); }}
                          className={cn(
                            "w-full flex md:hidden items-center gap-3 p-2 rounded-xl transition-all cursor-pointer text-left border shadow-sm text-xs",
                            theme === 'dark' 
                              ? "bg-amber-950/20 border-amber-900/40 text-amber-400 hover:bg-amber-950/45" 
                              : "bg-amber-50/50 border-amber-100/70 text-amber-800 hover:bg-amber-50"
                          )}
                        >
                          <DownloadCloud size={14} className="text-amber-500 shrink-0" />
                          <span className="font-bold">Import Entries</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {currentTabName === 'entries' && (
              <>
                {/* Mobile Summary Card (Reference Image Style) */}
              <div className={cn(
                "lg:hidden rounded-2xl border shadow-sm overflow-hidden transition-colors duration-300",
                theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-100"
              )}>
                <div className="p-3 px-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className={cn(
                      "text-sm font-bold transition-colors duration-300",
                      theme === 'dark' ? "text-slate-100" : "text-black"
                    )}>Net Balance</h3>
                    <p className={cn(
                      "font-black transition-colors duration-300",
                      theme === 'dark' ? "text-slate-100" : "text-black",
                      "text-sm"
                    )}>
                      {formatCurrency(totals.net)}
                    </p>
                  </div>
                  
                  <div className={cn(
                    "space-y-1.5 pt-1.5 border-t transition-colors duration-300",
                    theme === 'dark' ? "border-zinc-800" : "border-slate-50"
                  )}>
                    <div className="flex items-center justify-between">
                      <p className={cn(
                        "text-xs font-bold transition-colors duration-300",
                        theme === 'dark' ? "text-slate-400" : "text-slate-500"
                      )}>Total In (+)</p>
                      <p className={cn(
                        "font-black text-emerald-600",
                        "text-xs"
                      )}>{formatCurrency(totals.in)}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={cn(
                        "text-xs font-bold transition-colors duration-300",
                        theme === 'dark' ? "text-slate-400" : "text-slate-500"
                      )}>Total Out (-)</p>
                      <p className={cn(
                        "font-black text-rose-600",
                        "text-xs"
                      )}>{formatCurrency(totals.out)}</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Action Buttons Row (Desktop Only) */}
              {canAddEntries(currentUserRole) ? (
                <div className="hidden lg:flex items-center gap-3">
                  <button
                    onClick={() => { vibrate(); setShowForm('in'); setTransactionDate(safeToDateTimeLocal(new Date())); }}
                    className={cn(
                      "group/shortcut relative flex-1 sm:flex-none lg:w-44 lg:h-12 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all active:scale-95 cursor-pointer",
                      theme === 'dark' 
                        ? "bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40" 
                        : "bg-emerald-50/50 border border-emerald-150 text-emerald-800 hover:bg-emerald-100/70 shadow-sm shadow-emerald-50/20"
                    )}
                  >
                    <Plus size={20} />
                    Cash In
                    <span className="hidden lg:group-hover/shortcut:flex absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded shadow-lg whitespace-nowrap items-center gap-1 z-50">
                      Press <kbd className="bg-slate-700 px-1 rounded">C</kbd> + <kbd className="bg-slate-700 px-1 rounded">I</kbd>
                    </span>
                  </button>
                  <button
                    onClick={() => { vibrate(); setShowForm('out'); setTransactionDate(safeToDateTimeLocal(new Date())); }}
                    className={cn(
                      "group/shortcut relative flex-1 sm:flex-none lg:w-44 lg:h-12 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all active:scale-95 cursor-pointer",
                      theme === 'dark' 
                        ? "bg-rose-900/20 text-rose-400 hover:bg-rose-900/40" 
                        : "bg-rose-50/50 border border-rose-150 text-rose-800 hover:bg-rose-100/70 shadow-sm shadow-rose-50/20"
                    )}
                  >
                    <Minus size={20} />
                    Cash Out
                    <span className="hidden lg:group-hover/shortcut:flex absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded shadow-lg whitespace-nowrap items-center gap-1 z-50">
                      Press <kbd className="bg-slate-700 px-1 rounded">C</kbd> + <kbd className="bg-slate-700 px-1 rounded">O</kbd>
                    </span>
                  </button>
                  <button
                    onClick={() => { 
                      vibrate(); 
                      setShowAiWarning(true);
                    }}
                    className={cn(
                      "group/shortcut relative flex-1 sm:flex-none lg:w-44 lg:h-12 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all active:scale-95 cursor-pointer",
                      theme === 'dark' 
                        ? "bg-indigo-900/20 text-indigo-400 hover:bg-indigo-900/40" 
                        : "bg-indigo-50/40 border border-indigo-150 text-indigo-750 hover:bg-indigo-100 shadow-sm shadow-indigo-100/20"
                    )}
                  >
                    <Upload size={20} className="text-indigo-650 dark:text-indigo-400 shrink-0" />
                    AI Upload
                    <span className="hidden lg:group-hover/shortcut:flex absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded shadow-lg whitespace-nowrap items-center gap-1 z-50">
                      Press <kbd className="bg-slate-700 px-1 rounded">A</kbd> + <kbd className="bg-slate-700 px-1 rounded">U</kbd>
                    </span>
                  </button>
                </div>
              ) : (
                <div className="hidden lg:flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-600 dark:text-zinc-400">
                  <Eye size={16} className="text-indigo-500 shrink-0" />
                  <span>Viewing as <strong>{currentUserRole}</strong> (Read-only). New entries, edits, and deletions are restricted.</span>
                </div>
              )}

              {/* Filters & Search Row */}
              <div className="flex flex-col lg:flex-row items-center gap-3 sm:gap-4">
                <div className="flex-1 relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text"
                    placeholder="Search by remark, amount, category..."
                    value={transactionSearchQueryInput}
                    onChange={(e) => setTransactionSearchQueryInput(e.target.value)}
                    className={cn(
                      "w-full pl-10 pr-4 py-2 sm:py-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm",
                      theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-slate-100" : "bg-white border-slate-200 text-black"
                    )}
                  />
                </div>                {/* Desktop Action & Filter Row */}
                <div className="hidden lg:flex items-center gap-2 pb-1 sm:pb-0">
                  {currentUserRole !== 'Viewer' && (
                    <>
                      {selectedTransactions.size === 0 ? (
                        <button
                          onClick={toggleSelectAll}
                          className={cn(
                            "flex items-center gap-2 px-4 h-11 lg:min-w-[145px] lg:justify-center rounded-xl font-bold transition-all text-sm whitespace-nowrap cursor-pointer hover:scale-[1.02] active:scale-[0.98] duration-200",
                            theme === 'dark' ? "bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
                          )}
                        >
                          <Square size={16} />
                          Select All
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setSelectedTransactions(new Set())}
                            className={cn(
                              "flex items-center gap-2 px-4 h-11 lg:min-w-[145px] lg:justify-center rounded-xl font-bold transition-all text-sm whitespace-nowrap cursor-pointer hover:scale-[1.02] active:scale-[0.98] duration-200 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm",
                              theme === 'dark' && "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                            )}
                          >
                            <X size={16} />
                            <span>Deselect All</span>
                          </button>
                          <button
                            onClick={() => setShowShareModal(true)}
                            className={cn(
                              "flex items-center gap-2 px-4 h-11 lg:min-w-[145px] lg:justify-center bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap text-sm cursor-pointer duration-200",
                              theme === 'dark' ? "shadow-none" : "shadow-lg shadow-indigo-100"
                            )}
                          >
                            <Share size={16} />
                            Share Entries
                          </button>
                          {canDeleteEntries(currentUserRole) && (
                            <button
                              onClick={() => { setShowBulkTransactionDeleteConfirm(true); setDeleteConfirmed(false); }}
                              className={cn(
                                "flex items-center gap-2 px-4 h-11 lg:min-w-[145px] lg:justify-center bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap text-sm cursor-pointer duration-200",
                                theme === 'dark' ? "shadow-none" : "shadow-lg shadow-rose-100"
                              )}
                            >
                              <Trash size={16} />
                              Delete ({selectedTransactions.size})
                            </button>
                          )}
                        </>
                      )}
                    </>
                  )}
                  <div className="relative min-w-[120px]">
                    <select 
                      value={transactionTypeFilter}
                      onChange={(e) => setTransactionTypeFilter(e.target.value as any)}
                      className={cn(
                        "w-full pl-4 pr-10 h-11 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-bold appearance-none",
                        theme === 'dark' ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-black"
                      )}
                    >
                      <option value="all">All Types</option>
                      <option value="in">Cash In</option>
                      <option value="out">Cash Out</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                  </div>
                  <div className="relative min-w-[140px]">
                    <select 
                      value={transactionDurationFilter}
                      onChange={(e) => setTransactionDurationFilter(e.target.value)}
                      className={cn(
                        "w-full pl-4 pr-10 h-11 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-bold appearance-none",
                        theme === 'dark' ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-black"
                      )}
                    >
                      {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                  </div>
                  {transactionDurationFilter === 'Custom' && (
                    <div className="relative min-w-[150px]">
                      <input 
                        type="date"
                        value={customFilterDate}
                        onChange={(e) => setCustomFilterDate(e.target.value)}
                        className={cn(
                          "w-full px-3 h-11 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-bold",
                          theme === 'dark' ? "bg-slate-900 border-slate-800 text-white [color-scheme:dark]" : "bg-white border-slate-200 text-black"
                        )}
                        style={{ contentVisibility: 'auto' }}
                      />
                    </div>
                  )}
                </div>

                {/* Mobile Action & Filter Stacked Layout */}
                <div className="lg:hidden w-full flex flex-col gap-2.5">

                  {/* ROW 3: [All Types] [All] */}
                  <div className="grid grid-cols-2 gap-2.5 w-full">
                    <div className="relative w-full">
                      <select 
                        value={transactionTypeFilter}
                        onChange={(e) => setTransactionTypeFilter(e.target.value as any)}
                        className={cn(
                          "w-full pl-4 pr-10 h-11 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs font-bold appearance-none",
                          theme === 'dark' ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-black"
                        )}
                      >
                        <option value="all">All Types</option>
                        <option value="in">Cash In</option>
                        <option value="out">Cash Out</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                    <div className="relative w-full">
                      <select 
                        value={transactionDurationFilter}
                        onChange={(e) => setTransactionDurationFilter(e.target.value)}
                        className={cn(
                          "w-full pl-4 pr-10 h-11 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs font-bold appearance-none",
                          theme === 'dark' ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-black"
                        )}
                      >
                        {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                  </div>
                  {transactionDurationFilter === 'Custom' && (
                    <div className="relative w-full">
                      <input 
                        type="date"
                        value={customFilterDate}
                        onChange={(e) => setCustomFilterDate(e.target.value)}
                        className={cn(
                          "w-full px-3 h-11 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs font-bold",
                          theme === 'dark' ? "bg-slate-900 border-slate-800 text-white [color-scheme:dark]" : "bg-white border-slate-200 text-black"
                        )}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Balance Cards Row (Desktop Only) */}
              <div className="hidden lg:grid lg:grid-cols-3 w-full gap-4 sm:gap-6">
                <div className={cn(
                  "p-6 rounded-3xl border flex items-center gap-4 shadow-sm transition-colors duration-300",
                  theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                )}>
                  <div className={cn(
                    "p-3 rounded-2xl",
                    theme === 'dark' ? "bg-emerald-900/20 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                  )}>
                    <Plus size={24} />
                  </div>
                  <div>
                    <p className={cn(
                      "text-sm font-bold uppercase tracking-wider",
                      theme === 'dark' ? "text-slate-400" : "text-slate-500"
                    )}>Cash In</p>
                    <p className={cn(
                      "font-black text-emerald-600 dark:text-emerald-400",
                      "text-xl"
                    )}>
                      {formatCurrency(totals.in)}
                    </p>
                  </div>
                </div>

                <div className={cn(
                  "p-6 rounded-3xl border flex items-center gap-4 shadow-sm transition-colors duration-300",
                  theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                )}>
                  <div className={cn(
                    "p-3 rounded-2xl",
                    theme === 'dark' ? "bg-rose-900/20 text-rose-400" : "bg-rose-50 text-rose-600"
                  )}>
                    <Minus size={24} />
                  </div>
                  <div>
                    <p className={cn(
                      "text-sm font-bold uppercase tracking-wider",
                      theme === 'dark' ? "text-slate-400" : "text-slate-500"
                    )}>Cash Out</p>
                    <p className={cn(
                      "font-black text-rose-600 dark:text-rose-400",
                      "text-xl"
                    )}>
                      {formatCurrency(totals.out)}
                    </p>
                  </div>
                </div>

                <div className={cn(
                  "p-6 rounded-3xl border flex items-center gap-4 shadow-sm transition-colors duration-300",
                  theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                )}>
                  <div className={cn(
                    "p-3 rounded-2xl",
                    theme === 'dark' ? "bg-indigo-900/20 text-indigo-400" : "bg-indigo-50 text-indigo-600"
                  )}>
                    <Wallet size={24} />
                  </div>
                  <div>
                    <p className={cn(
                      "text-sm font-bold uppercase tracking-wider",
                      theme === 'dark' ? "text-slate-400" : "text-slate-500"
                    )}>Net Balance</p>
                    <p className={cn(
                      "font-black text-indigo-600 dark:text-indigo-400",
                      "text-xl"
                    )}>
                      {formatCurrency(totals.net)}
                    </p>
                  </div>
                </div>
              </div>
              </>
            )}
              </div> {/* Close STICKY TOP CONTROLS SECTION */}

              {/* Transaction List Section */}
              {currentTabName === 'entries' && (
                <>
                  <div className="space-y-4">
                {/* Mobile Transaction List (Card Based) */}
                 <div ref={mobileContainerRef} className="lg:hidden space-y-3">
                  {(isEntriesLoading || (activeBookId !== null && !entriesCache.has(activeBookId))) && filteredTransactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                      <div className="relative flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 animate-ping absolute" />
                        <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin relative z-10" />
                      </div>
                      <p className={cn(
                        "text-xs font-black uppercase tracking-widest leading-none font-mono",
                        theme === 'dark' ? "text-slate-500" : "text-slate-400"
                      )}>
                        Loading entries...
                      </p>
                    </div>
                  ) : filteredTransactions.length === 0 ? (
                    <div className={cn(
                      "py-12 px-6 text-center rounded-3xl border transition-colors duration-300 space-y-3",
                      theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                    )}>
                      {isOffline ? (
                        <>
                          <CloudOff size={40} className="mx-auto text-amber-500 animate-pulse" />
                          <h4 className="text-sm font-bold">Device is Offline</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
                            We couldn't sync your latest data because your device is offline. You can continue creating entries normally. Everything will automatically sync once your internet connection is restored.
                          </p>
                        </>
                      ) : (
                        <>
                          <History size={40} className={cn(
                            "mx-auto mb-2 transition-colors duration-300",
                            theme === 'dark' ? "text-slate-700" : "text-slate-200"
                          )} />
                          <p className={cn(
                            "text-sm font-medium transition-colors duration-300",
                            theme === 'dark' ? "text-slate-500" : "text-black"
                          )}>No entries found</p>
                        </>
                      )}
                    </div>
                  ) : (
                    (() => {
                      // Group transactions by date for headers in viewport
                      const visibleSlice = pagedTransactions.slice(mobileStart, mobileEnd + 1);
                      const groups: { [key: string]: Transaction[] } = {};
                      visibleSlice.forEach(t => {
                        const dateStr = safeFormatDate(t.date, { day: 'numeric', month: 'long', year: 'numeric' });
                        if (!groups[dateStr]) groups[dateStr] = [];
                        groups[dateStr].push(t);
                      });

                      return (
                        <>
                          {mobilePaddingTop > 0 && <div style={{ height: `${mobilePaddingTop}px` }} />}
                          {Object.entries(groups).map(([date, transactions]) => (
                            <div key={date} className="space-y-2">
                              <div className="flex items-center gap-2 px-1">
                                <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                                <h4 className={cn(
                                  "text-xs font-bold transition-colors duration-300",
                                  theme === 'dark' ? "text-slate-500" : "text-slate-600"
                                )}>{date}</h4>
                              </div>
                                                        {transactions.map((t) => (
                                <MobileTransactionRow
                                  key={t.id}
                                  t={t}
                                  runningBalance={runningBalancesMap.get(t.id) || 0}
                                  selected={selectedTransactions.has(t.id)}
                                  isCurrentlyDeleting={animatingDeleteId === t.id}
                                  onTouchStart={onTouchStart}
                                  onTouchEnd={onTouchEnd}
                                  onClick={handleTransactionPress}
                                  handleEditTransaction={handleEditTransaction}
                                  handleDeleteTransaction={handleDeleteTransaction}
                                  handleRetryUpload={handleRetryUpload}
                                  uploadStatuses={uploadStatuses}
                                  setPreviewImages={handleOpenPreview}
                                  setPreviewIndex={setPreviewIndex}
                                  setPreviewRotation={setPreviewRotation}
                                  setPreviewZoom={setPreviewZoom}
                                  theme={theme}
                                  index={visibleSlice.indexOf(t)}
                                  isJustEdited={justEditedTransactionId === t.id}
                                  canEdit={canEditEntries(currentUserRole)}
                                  canDelete={canDeleteEntries(currentUserRole)}
                                  canSelect={currentUserRole !== 'Viewer'}
                                />
                              ))}
                            </div>
                          ))}
                          {mobilePaddingBottom > 0 && <div style={{ height: `${mobilePaddingBottom}px` }} />}
                        </>
                      );
                    })()


                  )}
                </div>

                {/* Desktop Transaction Table */}
                <div className="hidden lg:block">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2 mb-4">
                    <p className="text-sm text-slate-500 font-medium">
                      Showing 1 - {filteredTransactions.length} of {filteredTransactions.length} entries
                    </p>
                  </div>

                  <div className={cn(
                    "rounded-3xl border shadow-sm transition-colors duration-300",
                    theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                  )}>
                    <div className="w-full">
                      <table className="w-full text-left">
                        <thead>
                          <tr className={cn(
                            "text-xs font-bold uppercase tracking-wider transition-colors duration-300",
                            theme === 'dark' ? "bg-slate-800/50 text-slate-300" : "bg-slate-50 text-slate-400"
                          )}>
                            {currentUserRole !== 'Viewer' && (
                              <th className="px-3 sm:px-6 py-4 w-12">
                                <button 
                                  onClick={toggleSelectAll}
                                  className={cn(
                                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                                    selectedTransactions.size === filteredTransactions.length && filteredTransactions.length > 0
                                      ? "bg-indigo-600 border-indigo-600 text-white"
                                      : "border-slate-300 dark:border-slate-700"
                                  )}
                                >
                                  {selectedTransactions.size === filteredTransactions.length && filteredTransactions.length > 0 && <CheckSquare size={14} />}
                                </button>
                              </th>
                            )}
                             <th className="px-3 sm:px-6 py-4">
                                <div className="flex items-center gap-2">
                                  Date & Time
                                </div>
                              </th>
                            <th className="px-3 sm:px-6 py-4">Details</th>
                            <th 
                              className="px-3 sm:px-6 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                              onClick={() => toggleSort('category')}
                            >
                              <div className="flex items-center gap-2">
                                Category
                                {sortColumn === 'category' ? (
                                  <ArrowUp size={12} className={cn("transition-transform duration-200", sortDirection === 'desc' ? "rotate-180" : "")} />
                                ) : (
                                  <ArrowUpDown size={12} className="text-slate-300 dark:text-slate-700" />
                                )}
                              </div>
                            </th>
                            <th className="px-3 sm:px-6 py-4">Mode</th>
                            <th className="px-3 sm:px-6 py-4">Bill</th>
                            <th className="px-3 sm:px-6 py-4 text-right">Amount</th>
                            <th className="px-3 sm:px-6 py-4 text-right">Balance</th>
                            <th className="px-3 sm:px-6 py-4 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody 
                          ref={desktopTableRef}
                          className={cn(
                            "divide-y transition-colors duration-300",
                            theme === 'dark' ? "divide-slate-800" : "divide-slate-50"
                          )}
                        >{(isEntriesLoading || (activeBookId !== null && !entriesCache.has(activeBookId))) && filteredTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={currentUserRole !== 'Viewer' ? 9 : 8} className="px-6 py-20">
                                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                                  <div className="relative flex items-center justify-center">
                                    <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 animate-ping absolute" />
                                    <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin relative z-10" />
                                  </div>
                                  <p className={cn(
                                    "text-xs font-black uppercase tracking-widest leading-none font-mono",
                                    theme === 'dark' ? "text-slate-500" : "text-slate-400"
                                  )}>
                                    Loading entries...
                                  </p>
                                </div>
                              </td>
                            </tr>
                          ) : filteredTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={currentUserRole !== 'Viewer' ? 9 : 8} className="px-6 py-20 text-center">
                                <div className="flex flex-col items-center justify-center space-y-3 max-w-md mx-auto">
                                  {isOffline ? (
                                    <>
                                      <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center">
                                        <CloudOff size={24} className="animate-pulse" />
                                      </div>
                                      <h4 className="text-sm font-bold">Device is Offline</h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                        We couldn't sync your latest data because your device is offline. You can continue creating entries normally. Everything will automatically sync once your internet connection is restored.
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <div className={cn(
                                        "w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-300",
                                        theme === 'dark' ? "bg-slate-800 text-slate-700" : "bg-slate-50 text-slate-300"
                                      )}>
                                        <History size={24} />
                                      </div>
                                      <p className={cn(
                                        "text-sm font-medium transition-colors duration-300",
                                        theme === 'dark' ? "text-slate-500" : "text-black"
                                      )}>No entries found for this book.</p>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <>
                              {desktopPaddingTop > 0 && (
                                <tr style={{ height: `${desktopPaddingTop}px` }}>
                                  <td colSpan={currentUserRole !== 'Viewer' ? 9 : 8} style={{ padding: 0, height: `${desktopPaddingTop}px` }} />
                                </tr>
                              )}
                              {pagedTransactions.slice(desktopStart, desktopEnd + 1).map((t, index) => (
                                <DesktopTransactionRow
                                  key={t.id}
                                  t={t}
                                  runningBalance={runningBalancesMap.get(t.id) || 0}
                                  selected={selectedTransactions.has(t.id)}
                                  isCurrentlyDeleting={animatingDeleteId === t.id}
                                  toggleSelectTransaction={toggleSelectTransaction}
                                  handleEditTransaction={handleEditTransaction}
                                  handleDeleteTransaction={handleDeleteTransaction}
                                  handleRetryUpload={handleRetryUpload}
                                  uploadStatuses={uploadStatuses}
                                  setPreviewImages={handleOpenPreview}
                                  setPreviewIndex={setPreviewIndex}
                                  setPreviewRotation={setPreviewRotation}
                                  setPreviewZoom={setPreviewZoom}
                                  theme={theme}
                                  index={index}
                                  isJustEdited={justEditedTransactionId === t.id}
                                  canEdit={canEditEntries(currentUserRole)}
                                  canDelete={canDeleteEntries(currentUserRole)}
                                  canSelect={currentUserRole !== 'Viewer'}
                                />
                              ))}
                              {desktopPaddingBottom > 0 && (
                                <tr style={{ height: `${desktopPaddingBottom}px` }}>
                                  <td colSpan={currentUserRole !== 'Viewer' ? 9 : 8} style={{ padding: 0, height: `${desktopPaddingBottom}px` }} />
                                </tr>
                              )}
                            </>
                          )}

                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {filteredTransactions.length > visibleCount && (
                  <div className="flex justify-center pt-6 pb-2">
                    <button
                      onClick={() => setVisibleCount(prev => prev + 30)}
                      className={cn(
                        "px-6 py-2.5 rounded-full text-xs font-black tracking-wider transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm border",
                        theme === 'dark'
                          ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
                          : "bg-white border-slate-200 text-slate-700 hover:text-black hover:bg-slate-50"
                      )}
                    >
                      LOAD MORE ENTRIES ({filteredTransactions.length - visibleCount} REMAINING)
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Sticky Bottom Buttons */}
              {canAddEntries(currentUserRole) && (
                <div className={cn(
                  "lg:hidden fixed bottom-0 left-0 right-0 p-4 pb-6 backdrop-blur-lg border-t z-40 transition-colors duration-300",
                  theme === 'dark' ? "bg-slate-900/80 border-slate-800" : "bg-white/80 border-slate-100"
                )}>
                  <div className="w-full font-sans">
                    <div className="flex flex-col gap-3 w-full">
                      {/* Row 1: AI UPLOAD */}
                      <button
                        onClick={() => { 
                          vibrate(); 
                          setShowAiWarning(true);
                        }}
                        className={cn(
                          "w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black shadow-sm transition-all active:scale-95 cursor-pointer text-xs sm:text-sm border",
                          theme === 'dark' 
                            ? "bg-indigo-950/25 text-indigo-400 border-indigo-900/50 hover:bg-indigo-950/40" 
                            : "bg-white border-indigo-200 text-indigo-650 shadow-sm shadow-indigo-100/30 hover:bg-indigo-50"
                        )}
                      >
                        <Upload size={18} className="shrink-0" />
                        AI UPLOAD
                      </button>

                      {/* Row 2: CASH IN & CASH OUT */}
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => { vibrate(); vibrate(); setShowForm('in'); setTransactionDate(safeToDateTimeLocal(new Date())); }}
                          className={cn(
                            "flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black shadow-sm transition-all active:scale-95 cursor-pointer text-xs sm:text-sm border",
                            theme === 'dark' 
                              ? "bg-emerald-950/20 text-emerald-400 border-emerald-900/40 shadow-none hover:bg-emerald-950/35" 
                              : "bg-white border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-100/30 hover:bg-emerald-50"
                          )}
                        >
                          <Plus size={16} />
                          CASH IN
                        </button>
                        <button
                          onClick={() => { vibrate(); vibrate(); setShowForm('out'); setTransactionDate(safeToDateTimeLocal(new Date())); }}
                          className={cn(
                            "flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black shadow-sm transition-all active:scale-95 cursor-pointer text-xs sm:text-sm border",
                            theme === 'dark' 
                              ? "bg-rose-950/20 text-rose-400 border-rose-900/40 shadow-none hover:bg-rose-950/35" 
                              : "bg-white border-rose-200 text-rose-700 shadow-sm shadow-rose-100/30 hover:bg-rose-50"
                          )}
                        >
                          <Minus size={16} />
                          CASH OUT
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </>
            )}

            {currentTabName === 'ai-upload' && (
              <div className="space-y-6 max-w-2xl mx-auto py-8 px-4">
                {/* 1. Group Size Selector Modal/Card */}
                {aiWorkflowStep === 'group' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "rounded-3xl border p-8 shadow-xl space-y-8 transition-colors duration-300 max-w-md mx-auto relative overflow-hidden",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
                    )}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -z-10" />
                    
                    <div className="text-center space-y-3">
                      <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                        <Users size={24} />
                      </div>
                      <h3 className={cn(
                        "text-xl font-extrabold tracking-tight transition-colors duration-300",
                        theme === 'dark' ? "text-white" : "text-zinc-900"
                      )}>Who was included in this expense?</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Select the group size to automatically divide and describe this bill.
                      </p>
                    </div>

                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="flex items-center gap-6">
                        <button 
                          type="button"
                          onClick={() => {
                            vibrate();
                            setAiGroupSize(prev => Math.max(1, prev - 1));
                          }}
                          disabled={aiGroupSize <= 1}
                          className={cn(
                            "w-12 h-12 rounded-2xl border flex items-center justify-center transition-all font-bold hover:scale-105 active:scale-95 text-lg disabled:opacity-40 select-none cursor-pointer",
                            theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-white" : "border-slate-200 bg-slate-50 text-slate-800"
                          )}
                          id="btn-dec-groupsize"
                        >
                          -
                        </button>
                        
                        <div className="text-center min-w-[100px]">
                          <span className={cn(
                            "text-4xl font-black tracking-tight block",
                            theme === 'dark' ? "text-white" : "text-zinc-900"
                          )}>
                            {aiGroupSize}
                          </span>
                          <span className="text-xs font-semibold text-slate-400/80 uppercase tracking-widest mt-1 block">
                            {aiGroupSize === 1 ? 'Member' : 'Members'}
                          </span>
                        </div>

                        <button 
                          type="button"
                          onClick={() => {
                            vibrate();
                            setAiGroupSize(prev => Math.min(50, prev + 1));
                          }}
                          disabled={aiGroupSize >= 50}
                          className={cn(
                            "w-12 h-12 rounded-2xl border flex items-center justify-center transition-all font-bold hover:scale-105 active:scale-95 text-lg disabled:opacity-40 select-none cursor-pointer",
                            theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-white" : "border-slate-200 bg-slate-50 text-slate-800"
                          )}
                          id="btn-inc-groupsize"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-center py-2 px-4 bg-indigo-50/50 dark:bg-indigo-950/10 rounded-2xl border border-indigo-100/10 text-xs font-medium text-indigo-650 dark:text-indigo-400">
                        {aiGroupSize} Member{aiGroupSize > 1 ? 's' : ''} expense structure will be auto-calculated.
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5 w-full">
                      <button
                        type="button"
                        onClick={() => {
                          vibrate();
                          setAiWorkflowStep('upload');
                        }}
                        className={cn(
                          "w-full py-4 rounded-2xl font-bold text-sm tracking-wide shadow-lg cursor-pointer flex items-center justify-center gap-2 text-white",
                          theme === 'dark'
                            ? "bg-indigo-600 md:hover:bg-indigo-500 md:hover:translate-y-[-1px] md:transition-all active:scale-95 shadow-indigo-950/40"
                            : "bg-indigo-600 md:hover:bg-indigo-700 md:hover:translate-y-[-1px] md:transition-all active:scale-95 shadow-indigo-100"
                        )}
                        id="btn-confirm-groupsize"
                      >
                        Continue
                        <ArrowRight size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          vibrate();
                          setAiConstructionModal(null);
                        }}
                        className={cn(
                          "w-full py-2.5 rounded-xl font-bold text-xs tracking-wide cursor-pointer flex items-center justify-center gap-1.5 border transition-all hover:bg-slate-50 dark:hover:bg-zinc-900",
                          theme === 'dark'
                            ? "border-zinc-800 text-zinc-400"
                            : "border-slate-200 text-slate-500"
                        )}
                      >
                        Back to Dashboard
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* 2. File Upload / Picker Select Area */}
                {aiWorkflowStep === 'upload' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "rounded-3xl border p-8 shadow-sm space-y-6 transition-colors duration-300",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
                    )}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-900/60 font-sans">
                      <button
                        type="button"
                        onClick={() => setAiWorkflowStep('group')}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/10 px-3 py-1 rounded-full uppercase tracking-wider">
                        {aiGroupSize} {aiGroupSize === 1 ? 'Member' : 'Members'} Selected
                      </span>
                    </div>

                    <div className="text-center space-y-1.5">
                      <h3 className={cn(
                        "text-lg font-extrabold transition-colors duration-300",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>Upload Bill Image</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                        JPG, JPEG, PNG, or WEBP receipts are supported (Max 5 images).
                      </p>
                    </div>

                    {/* Drag & Drop Zone */}
                    <div 
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          startAiUploadReceiptParsing(e.dataTransfer.files);
                        }
                      }}
                      onClick={() => {
                        vibrate();
                        // Open file input directly!
                        const el = document.getElementById('custom-ai-file-picker');
                        if (el) el.click();
                      }}
                      className={cn(
                        "border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer group",
                        theme === 'dark' ? "border-indigo-900/50 bg-indigo-900/5 hover:bg-indigo-900/10" : "border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/50"
                      )}
                    >
                      <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                        <Upload size={32} />
                      </div>
                      <div className="text-center">
                        <p className={cn(
                          "font-bold transition-colors duration-300",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>Drag & Drop image here</p>
                        <p className={cn(
                          "text-sm transition-colors duration-300",
                          theme === 'dark' ? "text-slate-400" : "text-slate-500"
                        )}>or click to browse image files</p>
                      </div>
                    </div>

                    {/* Quick Selection Buttons */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          vibrate();
                          const el = document.getElementById('custom-ai-file-picker');
                          if (el) el.click();
                        }}
                        className={cn(
                          "w-full flex items-center justify-center gap-2 py-3 border rounded-xl text-xs font-bold transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900 active:scale-95",
                          theme === 'dark' ? "border-zinc-800 text-slate-300" : "border-slate-200 text-slate-700"
                        )}
                        id="btn-upload-camera"
                      >
                        <Camera size={14} />
                        Select Receipt Images (Camera / Gallery)
                      </button>
                    </div>

                    {/* Custom onFileSelected hook to intercept input changes inside this wizard */}
                    <input 
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/jpg,image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          startAiUploadReceiptParsing(e.target.files);
                        }
                      }}
                      className="hidden"
                      id="custom-ai-file-picker"
                    />

                    <div className="flex items-center gap-2.5 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl text-amber-700 dark:text-amber-400 text-xs font-sans">
                      <div className="shrink-0"><Loader2 size={14} className="animate-spin" /></div>
                      <p>Full AI extraction automatically normalizes and splits currencies.</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        vibrate();
                        setAiConstructionModal(null);
                      }}
                      className={cn(
                        "w-full py-2.5 rounded-xl font-bold text-xs tracking-wide cursor-pointer flex items-center justify-center gap-1.5 border transition-all hover:bg-slate-50 dark:hover:bg-zinc-900 mt-2",
                        theme === 'dark'
                          ? "border-zinc-800 text-zinc-400"
                          : "border-slate-200 text-slate-500"
                      )}
                    >
                      Back to Dashboard
                    </button>
                  </motion.div>
                )}

                {/* 3. Real-time Scanning Progress screen (Step 2 details) */}
                {aiWorkflowStep === 'scanning' && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(
                      "rounded-3xl border p-12 shadow-md space-y-8 text-center transition-colors duration-300 relative overflow-hidden",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
                    )}
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-pink-500 to-indigo-500 animate-[shimmer_2s_infinite]" />
                    
                    <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                      <div className="absolute inset-0 bg-indigo-500/10 rounded-full animate-ping" />
                      <div className="relative w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-lg rotate-12 transition-transform duration-700 hover:rotate-0">
                        <Sparkles size={28} className="animate-pulse" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className={cn(
                        "text-xl font-bold tracking-tight animate-bounce",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        {aiScanStatus}
                      </h4>

                      {/* 0 to 100% Progressive Loading Design / Line Loading Animation */}
                      <div className="max-w-xs mx-auto space-y-2 pt-1 pb-2">
                        <div className="flex items-center justify-between text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest leading-none">
                          <span>Scanning progress</span>
                          <span className="font-mono text-xs">{Math.round(aiProgress)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-zinc-900 h-2 rounded-full overflow-hidden border border-slate-200/40 dark:border-zinc-800/40 relative">
                          <motion.div 
                            className="bg-indigo-600 dark:bg-indigo-400 h-full absolute left-0 top-0 rounded-full"
                            style={{ width: `${aiProgress}%` }}
                            transition={{ type: 'spring', damping: 20, stiffness: 80 }}
                          />
                        </div>
                      </div>

                      <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
                        AI TrackBook is reading text, classifying merchants, and matching time structures.
                      </p>
                    </div>

                    {/* Professional Processing Timeline */}
                    <div className="max-w-xs mx-auto pt-4 pb-2 border-t border-slate-100 dark:border-zinc-900/60 text-left">
                      <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-3">Live Processing Timeline</p>
                      <ProcessingTimeline currentStepId={aiCurrentStepId} completedSteps={aiCompletedSteps} theme={theme} />
                    </div>

                    {/* Today's Batch Tracker Component */}
                    <div className="max-w-xs mx-auto p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/40 border border-slate-100 dark:border-zinc-900/20 text-left font-sans space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Today's Batch Tracker</p>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="space-y-0.5">
                          <p className="text-slate-500 dark:text-slate-400">Uploaded Today</p>
                          <p className="text-sm font-black text-slate-800 dark:text-slate-200">{uploadedCount}</p>
                        </div>
                        <div className="space-y-0.5 border-l border-slate-200/60 dark:border-zinc-800/60 pl-3">
                          <p className="text-slate-500 dark:text-slate-400">Processed Today</p>
                          <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{processedCount}</p>
                        </div>
                      </div>
                    </div>

                    {/* Background and Cancel Buttons */}
                    <div className="flex items-center gap-3 max-w-xs mx-auto pt-4 border-t border-slate-100 dark:border-zinc-900/60">
                      <button
                        type="button"
                        onClick={() => {
                          vibrate();
                          setBackgroundScanResult("Your receipts are scanning in the background! Track status in the Download Center.");
                          setTimeout(() => {
                            setBackgroundScanResult(null);
                          }, 8000);
                          // Keep processing but leave immediately
                          setAiConstructionModal(null);
                          setShowDownloadCenter(true);
                          const slug = getBookSlug(activeBook?.name || '', activeBook?.id || '');
                          navigate(`/cashbooks/${slug}/entries`);
                        }}
                        className={cn(
                          "flex-1 py-2 rounded-xl font-bold text-xs tracking-wide cursor-pointer transition-all border",
                          theme === 'dark'
                            ? "border-zinc-800 text-zinc-300 bg-zinc-900 hover:bg-zinc-850"
                            : "border-slate-250 text-slate-700 bg-slate-50 hover:bg-slate-100"
                        )}
                      >
                        Back to Dashboard
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          vibrate();
                          cancelScanRef.current = true;
                          setAiWorkflowStep('group');
                          setIsUploading(false);
                          setAiConstructionModal(null);
                        }}
                        className={cn(
                          "flex-1 py-2 rounded-xl font-bold text-xs tracking-wide cursor-pointer transition-all border",
                          "border-rose-250 text-rose-600 bg-rose-50 hover:bg-rose-100 dark:border-rose-950/40 dark:text-rose-400 dark:bg-rose-950/20 dark:hover:bg-rose-950/45"
                        )}
                      >
                        Cancel Scan
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* 4. Confirmation / Field Filling Preview (Step 8 & 9) */}
                {aiWorkflowStep === 'confirmation' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-5 gap-6"
                  >
                    {/* Invoice/bill visual metadata preview card */}
                    <div className="md:col-span-2 space-y-4">
                      <div className={cn(
                        "rounded-3xl border p-5 shadow-sm space-y-4 transition-colors duration-300 text-center",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
                      )}>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest text-left">Captured Receipt</h4>
                        
                        {aiFilePreviewUrl ? (
                          <div className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-slate-100 dark:bg-zinc-900 flex items-center justify-center group border border-slate-200 dark:border-zinc-800 shadow-inner">
                            <img 
                              src={aiFilePreviewUrl} 
                              alt="Uploaded Receipt" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <span className="text-white text-xs px-2 py-1 rounded bg-black/60 font-bold select-none whitespace-normal break-all">
                                {aiFile?.name || 'document.pdf'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-800 flex flex-col items-center justify-center p-8 aspect-[3/4] text-slate-400">
                            <FileText size={48} className="stroke-[1.5]" />
                            <span className="text-xs font-semibold mt-2">Document uploaded</span>
                          </div>
                        )}

                        <div className="pt-2 text-left space-y-1 bg-slate-50 dark:bg-zinc-900/40 p-3 rounded-2xl border border-slate-100 dark:border-zinc-900/20 font-sans">
                          <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">AI Classification</p>
                          <p className="text-sm font-black text-indigo-650 dark:text-indigo-400">
                            {aiBillType} Detected{aiMealType ? ` (${aiMealType})` : ''}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium pt-0.5">
                            Group Size: {aiGroupSize} {aiGroupSize === 1 ? 'Member' : 'Members'}
                          </p>
                        </div>

                        {/* OCR Confidence Score and Status */}
                        <div className="pt-2 text-left space-y-1 bg-slate-50 dark:bg-zinc-900/40 p-3 rounded-2xl border border-slate-100 dark:border-zinc-900/20 font-sans">
                          <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">OCR Confidence Score</p>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-sm font-black",
                              aiOcrConfidence >= 90 ? "text-emerald-600 dark:text-emerald-400" :
                              aiOcrConfidence >= 70 ? "text-amber-600 dark:text-amber-400" :
                              "text-rose-600 dark:text-rose-400"
                            )}>
                              {aiOcrConfidence.toFixed(0)}%
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              {aiOcrConfidence >= 90 ? "High" : aiOcrConfidence >= 70 ? "Moderate" : "Low"}
                            </span>
                          </div>
                          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 pt-0.5">
                            {aiOcrConfidence >= 90 && "High (No manual check needed)"}
                            {aiOcrConfidence >= 70 && aiOcrConfidence < 90 && "Moderate (Check values carefully)"}
                            {aiOcrConfidence < 70 && "Low (Verify all fields manually)"}
                          </p>
                          {aiOcrConfidence < 70 && (
                            <div className="mt-1 px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-950 text-[9px] font-bold uppercase tracking-wider">
                              Below 70%: Gemini Fallback Allowed
                            </div>
                          )}
                        </div>

                        {/* Performance Analytics details */}
                        {aiAnalytics && (
                          <div className="pt-2 text-left space-y-1 bg-slate-50 dark:bg-zinc-900/40 p-3 rounded-2xl border border-slate-100 dark:border-zinc-900/20 font-sans">
                            <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Performance Analytics</p>
                            <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              <span>Upload:</span>
                              <span className="text-right font-medium">{aiAnalytics.upload_duration_ms ? `${(aiAnalytics.upload_duration_ms / 1000).toFixed(2)}s` : '0.00s'}</span>
                              <span>OCR:</span>
                              <span className="text-right font-medium">{aiAnalytics.ocr_duration_ms ? `${(aiAnalytics.ocr_duration_ms / 1000).toFixed(2)}s` : '0.00s'}</span>
                              <span>AI/Rules:</span>
                              <span className="text-right font-medium">{aiAnalytics.ai_duration_ms ? `${(aiAnalytics.ai_duration_ms / 1000).toFixed(2)}s` : '0.00s'}</span>
                              <span className="font-bold text-indigo-600 dark:text-indigo-400 pt-0.5 border-t border-slate-200/40 dark:border-zinc-800/40 mt-0.5 font-sans">Total:</span>
                              <span className="text-right font-bold text-indigo-600 dark:text-indigo-400 pt-0.5 border-t border-slate-200/40 dark:border-zinc-800/40 mt-0.5">
                                {aiAnalytics.total_duration_ms ? `${(aiAnalytics.total_duration_ms / 1000).toFixed(2)}s` : '0.00s'}
                              </span>
                            </div>
                            {aiAnalytics.total_duration_ms && aiAnalytics.total_duration_ms > 10000 && (
                              <p className="text-[9px] text-rose-500 font-bold pt-1 uppercase tracking-wider flex items-center gap-1 animate-pulse">
                                ⚠️ Slow Receipt (&gt;10s)
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pre-filled fields editable inputs list */}
                    <div className="md:col-span-3 space-y-4">
                      <div className={cn(
                        "rounded-3xl border p-6 sm:p-8 shadow-sm space-y-6 transition-colors duration-300",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
                      )}>
                        <div className="flex items-center justify-between pl-1 pb-3 border-b border-slate-100 dark:border-zinc-900/60 font-sans">
                          <h3 className={cn(
                            "text-base font-extrabold",
                            theme === 'dark' ? "text-white" : "text-zinc-900"
                          )}>Verify Ledger Entry</h3>
                          <span className="rounded bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-black text-[10px] px-2.5 py-1 uppercase tracking-widest">
                            {handwrittenQueue.length > 1 
                              ? `Receipt ${currentQueueIndex + 1} of ${handwrittenQueue.length}` 
                              : 'Ready to save'
                            }
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 font-sans text-left">
                          {/* Amount */}
                          <div className="space-y-1.5 col-span-2 sm:col-span-1">
                            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Amount</label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                              <input 
                                type="number"
                                value={aiAmount}
                                onChange={(e) => setAiAmount(e.target.value)}
                                className={cn(
                                  "w-full pl-7 pr-4 py-3 rounded-xl border text-sm font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors",
                                  theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                                )}
                              />
                            </div>
                          </div>

                          {/* Merchant / Vendor */}
                          <div className="space-y-1.5 col-span-2 sm:col-span-1">
                            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Merchant</label>
                            <input 
                              type="text"
                              value={aiMerchant}
                              onChange={(e) => setAiMerchant(e.target.value)}
                              className={cn(
                                "w-full px-4 py-3 rounded-xl border text-sm font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors",
                                theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                              )}
                            />
                          </div>

                          {/* Date */}
                          <div className="space-y-1.5 col-span-1">
                            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date</label>
                            <input 
                              type="text"
                              value={aiDate}
                              onChange={(e) => setAiDate(e.target.value)}
                              placeholder="DD-MM-YYYY"
                              className={cn(
                                "w-full px-4 py-3 rounded-xl border text-sm font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors",
                                theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                              )}
                            />
                          </div>

                          {/* Time */}
                          <div className="space-y-1.5 col-span-1">
                            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Time</label>
                            <input 
                              type="text"
                              value={aiTime}
                              onChange={(e) => setAiTime(e.target.value)}
                              placeholder="e.g., 01:20 PM"
                              className={cn(
                                "w-full px-4 py-3 rounded-xl border text-sm font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors",
                                theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                              )}
                            />
                          </div>

                          {/* Bill Type Category selection */}
                          <div className="space-y-1.5 col-span-1">
                            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Bill Type</label>
                            <select 
                              value={aiBillType}
                              onChange={(e) => setAiBillType(e.target.value)}
                              className={cn(
                                "w-full px-4 py-3 rounded-xl border text-sm font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors appearance-none cursor-pointer",
                                theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                              )}
                            >
                              {["Restaurant", "Food", "Taxi", "Cab", "Bus", "Train", "Flight", "Fuel", "Groceries", "Medical", "Shopping", "Utilities", "Internet", "Recharge", "Hotel", "Entertainment"].map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>

                          {/* Ledger Category selection */}
                          <div className="space-y-1.5 col-span-1">
                            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Category</label>
                            <select 
                              value={aiCategory}
                              onChange={(e) => setAiCategory(e.target.value)}
                              className={cn(
                                "w-full px-4 py-3 rounded-xl border text-sm font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors appearance-none cursor-pointer",
                                theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                              )}
                            >
                              {["Food", "Transport", "Utilities", "Shopping", "Entertainment", "Health", "Education", "Salary", "Other"].map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>

                          {/* Description field */}
                          <div className="space-y-1.5 col-span-2">
                            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Generated Description</label>
                            <input 
                              type="text"
                              value={aiDescription}
                              onChange={(e) => setAiDescription(e.target.value)}
                              className={cn(
                                "w-full px-4 py-3 rounded-xl border text-sm font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors",
                                theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                              )}
                            />
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-zinc-900/60 font-sans">
                          <button
                            type="button"
                            onClick={() => {
                              vibrate();
                              setAiWorkflowStep('upload');
                              setAiFile(null);
                              setAiFilePreviewUrl('');
                            }}
                            className={cn(
                              "flex-1 py-3.5 rounded-2xl font-bold text-xs tracking-wide border cursor-pointer active:scale-95 transition-all text-center flex items-center justify-center gap-1.5",
                              theme === 'dark' 
                                ? "border-zinc-800 text-slate-400 hover:bg-zinc-900" 
                                : "border-slate-200 text-slate-500 hover:bg-slate-50"
                            )}
                            id="btn-cancel-ai"
                          >
                            <Trash2 size={14} />
                            Change Bill
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              vibrate();
                              handleSaveAiEntry();
                            }}
                            className={cn(
                              "flex-[2] py-3.5 rounded-2xl font-black text-xs tracking-wide shadow-md active:scale-95 text-center flex items-center justify-center gap-1.5 cursor-pointer text-white",
                              theme === 'dark' 
                                ? "bg-indigo-600 md:hover:bg-indigo-500 md:transition-colors shadow-indigo-950/50" 
                                : "bg-indigo-600 md:hover:bg-indigo-700 md:transition-colors shadow-indigo-100"
                            )}
                            id="btn-save-ai"
                          >
                            <Check size={14} />
                            SAVE ENTRY
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 5. Completion Step */}
                {aiWorkflowStep === 'completion' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "rounded-3xl border p-12 shadow-md space-y-8 text-center transition-colors duration-300 max-w-md mx-auto relative overflow-hidden",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
                    )}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -z-10" />

                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1] }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-sm"
                    >
                      <Check size={40} strokeWidth={3} className="text-emerald-500" />
                    </motion.div>

                    <div className="space-y-2">
                      <h3 className={cn(
                        "text-xl font-extrabold tracking-tight",
                        theme === 'dark' ? "text-white" : "text-zinc-900"
                      )}>Receipt imported successfully.</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-xs max-w-xs mx-auto leading-relaxed">
                        Your split entry has been successfully verified, parsed, and logged to your cashbook ledger.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 max-w-xs mx-auto pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          vibrate();
                          setAiWorkflowStep('group');
                          setAiGroupSize(1);
                          setIsUploading(false);
                          setHandwrittenQueue([]);
                          setCurrentQueueIndex(0);
                          setAiConstructionModal(null);
                          const slug = getBookSlug(activeBook?.name || '', activeBook?.id || '');
                          navigate(`/cashbooks/${slug}/entries`);
                        }}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs tracking-wide cursor-pointer transition-all shadow-md text-center"
                      >
                        Review Entry
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          vibrate();
                          setAiWorkflowStep('group');
                          setAiGroupSize(1);
                          setIsUploading(false);
                          setHandwrittenQueue([]);
                          setCurrentQueueIndex(0);
                        }}
                        className={cn(
                          "w-full py-2.5 rounded-xl font-bold text-xs tracking-wide cursor-pointer transition-all border text-center",
                          theme === 'dark'
                            ? "border-zinc-800 text-zinc-350 bg-zinc-900/60 hover:bg-zinc-850"
                            : "border-slate-200 text-slate-650 bg-slate-50 hover:bg-slate-100"
                        )}
                      >
                        Upload Another Receipt
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {currentTabName === 'reports' && (
              <div className="space-y-6 max-w-4xl mx-auto py-6 px-4 pb-20">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={cn(
                    "p-6 rounded-3xl border transition-colors duration-300 shadow-sm",
                    theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-100"
                  )}>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Cash In</p>
                    <h4 className="text-2xl font-black text-emerald-600 mt-2">{formatCurrency(totals.in)}</h4>
                  </div>
                  <div className={cn(
                    "p-6 rounded-3xl border transition-colors duration-300 shadow-sm",
                    theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-100"
                  )}>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Cash Out</p>
                    <h4 className="text-2xl font-black text-rose-600 mt-2">{formatCurrency(totals.out)}</h4>
                  </div>
                  <div className={cn(
                    "p-6 rounded-3xl border transition-colors duration-300 shadow-sm",
                    theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-100"
                  )}>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Net Balance</p>
                    <h4 className={cn(
                      "text-2xl font-black mt-2",
                      totals.net >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-rose-600 dark:text-rose-400"
                    )}>{formatCurrency(totals.net)}</h4>
                  </div>
                </div>

                {/* Cash Flow Distribution */}
                <div className={cn(
                  "p-6 rounded-3xl border transition-colors duration-300 shadow-sm space-y-4",
                  theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-100"
                )}>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Cash Flow Balance Chart</h3>
                  {totals.in === 0 && totals.out === 0 ? (
                    <p className="text-slate-500 text-xs py-4 text-center">Add entries to generate visual cash flow distribution.</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex h-5 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-zinc-900">
                        <div 
                          style={{ width: `${Math.max(5, (totals.in / (totals.in + totals.out || 1)) * 100)}%` }} 
                          className="bg-emerald-500 font-extrabold text-[10px] text-white flex items-center justify-center transition-all duration-550"
                        >
                          In
                        </div>
                        <div 
                          style={{ width: `${Math.max(5, (totals.out / (totals.in + totals.out || 1)) * 100)}%` }} 
                          className="bg-rose-500 font-extrabold text-[10px] text-white flex items-center justify-center transition-all duration-550"
                        >
                          Out
                        </div>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-500">
                        <span>{((totals.in / (totals.in + totals.out || 1)) * 100).toFixed(1)}% In ({formatCurrency(totals.in)})</span>
                        <span>{((totals.out / (totals.in + totals.out || 1)) * 100).toFixed(1)}% Out ({formatCurrency(totals.out)})</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Export & Share Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* WhatsApp Share Card */}
                  <div 
                    onClick={() => {
                      if (activeBook) {
                        setShowWhatsAppModal(true);
                      }
                    }}
                    className={cn(
                      "p-6 rounded-3xl border transition-all cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99] duration-150 flex items-center gap-4 group col-span-1 sm:col-span-3 lg:col-span-1",
                      theme === 'dark' ? "bg-zinc-950 hover:bg-emerald-950/20 border-emerald-900/40" : "bg-emerald-50/40 hover:bg-emerald-50/80 border-emerald-200/80"
                    )}
                  >
                    <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                      <MessageSquare size={24} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">Share Reports to WhatsApp</h4>
                        <span className="px-1.5 py-0.5 text-[9px] font-black uppercase bg-emerald-600 text-white rounded-md tracking-wider shrink-0">NEW</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Send Excel and PDF reports directly to any WhatsApp number.</p>
                    </div>
                  </div>

                  <div 
                    onClick={() => {
                      if (activeBook) {
                        if (!filteredTransactions || filteredTransactions.length === 0) {
                          alert('No transactions found to export in this cashbook.');
                          return;
                        }
                        backgroundExportManager.enqueueExcelTask(activeBook.id, activeBook.name, filteredTransactions);
                        setShowDownloadCenter(true);
                      }
                    }}
                    className={cn(
                      "p-6 rounded-3xl border transition-all cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99] duration-150 flex items-center gap-4 group",
                      theme === 'dark' ? "bg-zinc-950 hover:bg-emerald-950/10 border-zinc-900" : "bg-white hover:bg-emerald-50/20 border-slate-100"
                    )}
                  >
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                      <FileSpreadsheet size={24} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">Export as Microsoft Excel</h4>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Compatible with Excel, Google Sheets, and Numbers.</p>
                    </div>
                  </div>

                  <div 
                    onClick={() => {
                      if (activeBook) {
                        if (!filteredTransactions || filteredTransactions.length === 0) {
                          alert('No transactions found to export in this cashbook.');
                          return;
                        }
                        backgroundExportManager.enqueueTask(activeBook.id, activeBook.name, filteredTransactions, true);
                        setShowDownloadCenter(true);
                      }
                    }}
                    className={cn(
                      "p-6 rounded-3xl border transition-all cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99] duration-150 flex items-center gap-4 group",
                      theme === 'dark' ? "bg-zinc-950 hover:bg-rose-950/10 border-zinc-900" : "bg-white hover:bg-rose-50/20 border-slate-100"
                    )}
                  >
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl">
                      <FileText size={24} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">Export as PDF</h4>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Perfect for printing or sharing official business records.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentTabName === 'members' && activeBook && (
              <div className="max-w-6xl mx-auto py-4 px-2 sm:px-4 pb-20">
                <MembersAccessManagement
                  cashbookId={activeBook.id}
                  cashbookName={activeBook.name}
                  theme={theme}
                  currentUserRole={currentUserRole}
                  currentUserId={session?.user?.id || 'u1'}
                  currentUserName={userName || 'Siva'}
                  currentUserEmail={session?.user?.email || 'siva@gmail.com'}
                />
              </div>
            )}

            {currentTabName === 'import-export' && (
              <div className="space-y-6 max-w-4xl mx-auto py-6 px-4 pb-20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Share Panel */}
                  <div className={cn(
                    "p-6 rounded-3xl border transition-colors duration-300 shadow-sm space-y-4 flex flex-col justify-between",
                    theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-100"
                  )}>
                    <div className="space-y-2">
                      <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Generate Share Code</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Generate a secure, single-use 5-character share code to transfer selected entries seamlessly to another TrackBook user.
                      </p>
                      
                      {selectedList.length === 0 ? (
                        <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl text-center space-y-2">
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">No entries currently selected</p>
                          <button
                            onClick={toggleSelectAll}
                            className="text-xs text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline"
                          >
                            Select All {filteredTransactions.length} Entries
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 bg-indigo-50/40 dark:bg-indigo-950/10 rounded-2xl flex items-center justify-between border border-indigo-150/20">
                          <div>
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Selected Entries</span>
                            <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-0.5">{selectedList.length} items</p>
                          </div>
                          <button
                            onClick={() => setSelectedTransactions(new Set())}
                            className="text-xs text-rose-600 hover:underline font-bold"
                          >
                            Clear
                          </button>
                        </div>
                      )}

                      {shareError && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2 font-bold antialiased">
                          <AlertCircle size={14} />
                          <span>{shareError}</span>
                        </div>
                      )}

                      {generatedCode && (
                        <div className="mt-4 p-4 border border-indigo-200/50 dark:border-indigo-900/50 bg-indigo-50/10 dark:bg-indigo-950/10 rounded-2xl text-center space-y-3">
                          <div className="text-[10px] uppercase font-black tracking-widest text-slate-400">Share Code</div>
                          <div className="text-2xl font-black font-mono tracking-widest text-indigo-600 dark:text-indigo-400 select-all p-2 bg-white dark:bg-zinc-900 rounded-xl inline-block border dark:border-zinc-800">
                            {generatedCode}
                          </div>
                          {countdownText && (
                            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">{countdownText}</p>
                          )}
                          <div className="pt-2">
                            <span className="text-[10px] text-slate-400 leading-normal block">Give this code to another user to let them import these entries instantly.</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-4">
                      <button
                        onClick={handleGenerateShareCode}
                        disabled={selectedList.length === 0}
                        className={cn(
                          "w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black tracking-wider text-xs uppercase transition-all shadow-md shadow-indigo-100 dark:shadow-none cursor-pointer",
                          selectedList.length === 0 && "opacity-55 cursor-not-allowed"
                        )}
                      >
                        Generate Share Code
                      </button>
                    </div>
                  </div>

                  {/* Import Panel */}
                  <div className={cn(
                    "p-6 rounded-3xl border transition-colors duration-300 shadow-sm space-y-4 flex flex-col justify-between",
                    theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-100"
                  )}>
                    <div className="space-y-4">
                      <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Import Shared Entries</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Enter a shared 5-character coupon/code code from another user to instantly clone and import their transactions into a new cashbook.
                      </p>

                      {importError && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2 font-bold antialiased">
                          <AlertCircle size={14} />
                          <span>{importError}</span>
                        </div>
                      )}

                      {importSuccess ? (
                        <div className="text-center py-4 space-y-3 bg-emerald-500/5 dark:bg-emerald-950/5 p-4 rounded-2xl border border-emerald-500/10">
                          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                            <CheckSquare size={18} />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-850 dark:text-slate-100">Entries Imported!</h4>
                            <p className="text-[10px] text-slate-400 mt-1">Creating book and refreshing workspace...</p>
                            {importSummary && (
                              <div className="mt-2.5 p-2.5 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl text-left border border-indigo-100/30 text-[11px] font-semibold text-slate-550 dark:text-slate-400">
                                {importSummary}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase font-black tracking-wider text-slate-400">Share Code</label>
                          <input 
                            type="text"
                            placeholder="e.g. TBK-82KD1"
                            value={importCode}
                            onChange={(e) => setImportCode(e.target.value.toUpperCase())}
                            disabled={isImporting}
                            className={cn(
                              "w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-center font-bold font-mono text-base tracking-widest",
                              theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white placeholder-slate-700" : "bg-white border-slate-200 text-black placeholder-slate-350"
                            )}
                            maxLength={10}
                          />
                        </div>
                      )}
                    </div>

                    {!importSuccess && (
                      <div className="pt-4">
                        <button
                          onClick={() => {
                            if (!isImporting && importCode.trim()) {
                              handleImportSharedEntries();
                            }
                          }}
                          disabled={isImporting || !importCode.trim()}
                          className={cn(
                            "w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black tracking-wider text-xs uppercase transition-all shadow-md shadow-emerald-100 dark:shadow-none cursor-pointer flex items-center justify-center gap-2",
                            (isImporting || !importCode.trim()) && "opacity-55 cursor-not-allowed"
                          )}
                        >
                          {isImporting ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              <span>Importing...</span>
                            </>
                          ) : (
                            <span>Import Code</span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            </motion.div>
          )}
      </main>

      {/* MODALS */}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className={cn(
            "fixed inset-0 z-[150] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300 overflow-y-auto",
            theme === 'dark' ? "bg-black/60" : "bg-indigo-900/10"
          )}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center space-y-4 transition-colors duration-300",
                theme === 'dark' ? "bg-zinc-950" : "bg-white"
              )}
            >
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-colors duration-300",
                theme === 'dark' ? "bg-rose-900/20 text-rose-400" : "bg-rose-50 text-rose-600"
              )}>
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className={cn(
                  "text-xl font-bold transition-colors duration-300",
                  theme === 'dark' ? "text-slate-100" : "text-slate-800"
                )}>Delete Cashbook?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Are you sure you want to delete this book? This action cannot be undone and all transactions will be permanently lost.
                </p>
                <div className="pt-2 text-left flex justify-center">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs select-none">
                    <input 
                      type="checkbox" 
                      checked={deleteConfirmed} 
                      onChange={(e) => setDeleteConfirmed(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-800 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-slate-500 dark:text-slate-400 font-bold">I confirm this deletion</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => { setDeleteConfirmId(null); }}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDeleteBook}
                  disabled={!deleteConfirmed}
                  className={cn(
                    "flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
                    theme === 'dark' ? "shadow-none" : "shadow-lg shadow-rose-100"
                  )}
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transaction Delete Confirmation Modal */}
      <AnimatePresence>
        {transactionToDelete && (
          <div className={cn(
            "fixed inset-0 z-[150] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300 overflow-y-auto",
            theme === 'dark' ? "bg-black/60" : "bg-indigo-900/10"
          )}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center space-y-4 transition-colors duration-300",
                theme === 'dark' ? "bg-zinc-950" : "bg-white"
              )}
            >
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-colors duration-300",
                theme === 'dark' ? "bg-rose-900/20 text-rose-400" : "bg-rose-50 text-rose-600"
              )}>
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className={cn(
                  "text-xl font-bold transition-colors duration-300",
                  theme === 'dark' ? "text-slate-100" : "text-slate-800"
                )}>Delete Entry?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Are you sure you want to delete this entry? Once deleted, it cannot be recovered.
                </p>
                <div className="pt-2 text-left flex justify-center">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs select-none">
                    <input 
                      type="checkbox" 
                      checked={deleteConfirmed} 
                      onChange={(e) => setDeleteConfirmed(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-800 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-slate-500 dark:text-slate-400 font-bold">I confirm this deletion</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => { setTransactionToDelete(null); }}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDeleteTransaction}
                  disabled={!deleteConfirmed}
                  className={cn(
                    "flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
                    theme === 'dark' ? "shadow-none" : "shadow-lg shadow-rose-100"
                  )}
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Upload Warning Modal */}
      <AnimatePresence>
        {showAiWarning && (
          <div className={cn(
            "fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300",
            theme === 'dark' ? "bg-black/60" : "bg-indigo-900/10"
          )}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 text-left transition-colors duration-300",
                theme === 'dark' ? "bg-zinc-950 border border-zinc-900 text-white" : "bg-white border border-slate-100 text-slate-800"
              )}
            >
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-zinc-900 pb-3">
                <span className="text-xl">⚠️</span>
                <h3 className="text-sm font-black tracking-tight font-sans uppercase">
                  AI TrackBook (Testing Phase)
                </h3>
              </div>

              <div className="space-y-3 font-sans text-xs">
                <p className="font-semibold text-slate-500 dark:text-zinc-400 leading-relaxed">
                  AI TrackBook is currently under active testing.
                </p>
                <p className="font-semibold text-slate-500 dark:text-zinc-400 leading-relaxed">
                  While most receipts are processed correctly, some receipts may occasionally produce incorrect:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1 font-bold text-slate-700 dark:text-zinc-300">
                  <li>Amounts</li>
                  <li>Dates</li>
                  <li>Merchant Names</li>
                  <li>Categories</li>
                  <li>Food / Travel Classification</li>
                </ul>
                <p className="font-bold text-slate-600 dark:text-zinc-300 leading-relaxed">
                  Please verify extracted information before saving.
                </p>
              </div>

              {/* Checkbox block */}
              <div 
                className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/40 border border-slate-100 dark:border-zinc-900 flex items-start gap-2.5 cursor-pointer select-none"
                onClick={() => setAiWarningChecked(!aiWarningChecked)}
              >
                <input
                  type="checkbox"
                  id="chk-ai-agreement"
                  checked={aiWarningChecked}
                  onChange={(e) => setAiWarningChecked(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5 cursor-pointer"
                />
                <label 
                  htmlFor="chk-ai-agreement" 
                  className="text-[11px] font-black text-slate-500 dark:text-zinc-400 leading-normal cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  I understand that AI extraction may occasionally be inaccurate and I will review detected information before saving.
                </label>
              </div>

              {/* Cancel / Continue Buttons */}
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => { setShowAiWarning(false); setAiWarningChecked(false); }}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-800 rounded-xl font-black text-xs uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  disabled={!aiWarningChecked}
                  onClick={() => { 
                    setShowAiWarning(false); 
                    setAiWarningChecked(false); // Reset for next time
                    // Start the real AI upload setup
                    vibrate(); 
                    setAiWorkflowStep('group'); 
                    setAiGroupSize(1);
                    setAiFile(null);
                    setAiFilePreviewUrl('');
                    setAiConstructionModal('upload'); 
                  }}
                  className={cn(
                    "flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer",
                    theme === 'dark' ? "shadow-none" : "shadow-lg shadow-indigo-100"
                  )}
                >
                  Continue
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Full-Screen Image Lightbox Preview (Satisfies mobile-preview modal requirement) */}
      <AnimatePresence>
        {showFullScreenPreview && aiFilePreviewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowFullScreenPreview(false)}
            className="fixed inset-0 z-[500] bg-black/95 flex flex-col items-center justify-center p-4 cursor-zoom-out backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-full max-h-[85vh] flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl bg-zinc-950 border border-zinc-800"
            >
              <img
                src={aiFilePreviewUrl}
                alt="Receipt Fullscreen Layout"
                className="max-w-full max-h-[85vh] object-contain"
                referrerPolicy="no-referrer"
              />
              <button
                onClick={() => setShowFullScreenPreview(false)}
                className="absolute top-4 right-4 p-2.5 rounded-full bg-black/75 text-white hover:bg-black hover:text-indigo-400 transition-colors border border-white/15 cursor-pointer"
                title="Close Preview"
              >
                <X size={20} />
              </button>
            </motion.div>
            <div className="mt-4 text-center select-none pointer-events-none">
              <p className="text-white/80 font-sans text-xs font-bold uppercase tracking-wider">Fullscreen Receipt view</p>
              <p className="text-white/45 font-sans text-[10px] mt-0.5">Click anywhere on the backdrop to exit</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Under Construction / OCR Parser Modal */}
      <AnimatePresence>
        {aiConstructionModal && (
          <div 
            onClick={() => {
              if (aiWorkflowStep !== 'scanning') {
                setAiConstructionModal(null);
              }
            }}
            className={cn(
              "fixed inset-0 z-[400] flex items-center justify-center p-4 backdrop-blur-xl transition-colors duration-300",
              theme === 'dark' ? "bg-slate-950/80" : "bg-slate-900/60"
            )}
          >
            {aiConstructionModal === 'ask' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "relative w-full max-w-sm rounded-[32px] p-6 sm:p-8 shadow-3xl text-center space-y-6 transition-colors duration-300 border overflow-hidden",
                  theme === 'dark' ? "bg-zinc-950 border-zinc-900 shadow-black/80" : "bg-white border-slate-100 shadow-slate-200/50"
                )}
              >
                {/* Background Slowly Rotating Construction Gear */}
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none select-none">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
                    className={cn(
                      "opacity-[0.03] dark:opacity-[0.04]",
                      theme === 'dark' ? "text-indigo-400" : "text-indigo-900"
                    )}
                  >
                    <Settings size={280} strokeWidth={1} />
                  </motion.div>
                </div>

                {/* Close Button */}
                <button 
                  onClick={() => { vibrate(); setAiConstructionModal(null); }}
                  className={cn(
                    "absolute top-4 right-4 p-2 rounded-full border transition-all hover:scale-105 active:scale-95 cursor-pointer",
                    theme === 'dark' 
                      ? "border-zinc-800 hover:bg-zinc-900 text-slate-400 hover:text-white" 
                      : "border-slate-100 hover:bg-slate-50 text-slate-500 hover:text-slate-800"
                  )}
                >
                  <X size={16} />
                </button>

                {/* Glowing Dynamic Visual Header */}
                <div className="relative w-24 h-24 mx-auto flex items-center justify-center mt-3">
                  <motion.div 
                    animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0.15, 0.6] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full bg-indigo-500/10 dark:bg-indigo-500/5"
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.25, 1], opacity: [0.8, 0.3, 0.8] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", delay: 0.5 }}
                    className="absolute inset-2 rounded-full bg-indigo-500/15 dark:bg-indigo-500/10"
                  />
                  
                  {/* Central Icon Container */}
                  <div className={cn(
                    "w-16 h-16 rounded-[22px] flex items-center justify-center relative shadow-xl",
                    theme === 'dark' ? "bg-gradient-to-tr from-indigo-900/40 to-violet-800/20" : "bg-indigo-50"
                  )}>
                    <motion.div
                      animate={{ scale: [0.95, 1.05, 0.95] }}
                      transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                      className={theme === 'dark' ? "text-indigo-400" : "text-indigo-600"}
                    >
                      <MessageSquare size={28} strokeWidth={2.2} />
                    </motion.div>
                    
                    <motion.div 
                      animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.1, 0.8] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                      className="absolute bottom-1 right-1 text-amber-400"
                    >
                      <Sparkles size={14} fill="currentColor" />
                    </motion.div>
                  </div>
                </div>

                {/* Title & Subtitle */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-center gap-1.5">
                    <motion.div 
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1.5, delay: 0 }}
                      className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                    />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Under Construction</span>
                  </div>
                  
                  <h3 className={cn(
                    "text-xl font-bold tracking-tight transition-colors duration-300",
                    theme === 'dark' ? "text-white" : "text-slate-900"
                  )}>
                    Ask AI Coming Soon
                  </h3>
                  
                  <p className={cn(
                    "text-sm leading-relaxed px-2 transition-colors duration-300 font-medium",
                    theme === 'dark' ? "text-slate-400" : "text-slate-600"
                    )}>
                    This AI feature is under development and will be released soon.
                  </p>
                </div>

                {/* Progress bar */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
                    <span>Development Progress</span>
                    <span className="text-indigo-500 font-black">78%</span>
                  </div>
                  <div className={cn(
                    "h-2 w-full rounded-full overflow-hidden relative",
                    theme === 'dark' ? "bg-zinc-900" : "bg-slate-100"
                  )}>
                    <motion.div 
                      initial={{ width: "0%" }}
                      animate={{ width: "78%" }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full relative"
                    >
                      <motion.div 
                        initial={{ left: "-100%" }}
                        animate={{ left: "100%" }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                      />
                    </motion.div>
                  </div>
                </div>

                <button 
                  onClick={() => { vibrate(); setAiConstructionModal(null); }}
                  className={cn(
                    "w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-lg",
                    theme === 'dark' ? "shadow-indigo-950/20" : "shadow-indigo-100"
                  )}
                >
                  Awesome, I'll wait!
                </button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "relative w-full rounded-[32px] p-4 sm:p-8 shadow-3xl transition-all duration-300 border overflow-hidden",
                  aiWorkflowStep === 'confirmation' ? "max-w-4xl max-h-[92vh] flex flex-col" : "max-w-md",
                  theme === 'dark' ? "bg-zinc-950 border-zinc-900 shadow-black/80" : "bg-white border-slate-150 shadow-slate-200/50"
                )}
              >
                {/* 1. Group Size Selector Step */}
                {aiWorkflowStep === 'group' && (
                  <div className="space-y-6 relative">
                    <button 
                      onClick={() => { vibrate(); setAiConstructionModal(null); }}
                      className={cn(
                        "absolute top-0 right-0 p-2 rounded-full border transition-all hover:scale-105 active:scale-95 cursor-pointer",
                        theme === 'dark' 
                          ? "border-zinc-800 hover:bg-zinc-900 text-slate-400 hover:text-white" 
                          : "border-slate-100 hover:bg-slate-50 text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <X size={16} />
                    </button>

                    <div className="text-center space-y-3 pt-4">
                      <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                        <Users size={24} />
                      </div>
                      <h3 className={cn(
                        "text-xl font-extrabold tracking-tight transition-colors duration-300",
                        theme === 'dark' ? "text-white" : "text-zinc-900"
                      )}>Who was included in this expense?</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Select group size to automatically divide and classify this bill.
                      </p>
                    </div>

                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="flex items-center gap-6">
                        <button 
                          type="button"
                          onClick={() => {
                            vibrate();
                            setAiGroupSize(prev => Math.max(1, prev - 1));
                          }}
                          disabled={aiGroupSize <= 1}
                          className={cn(
                            "w-12 h-12 rounded-2xl border flex items-center justify-center transition-all font-bold hover:scale-105 active:scale-95 text-lg disabled:opacity-40 select-none cursor-pointer",
                            theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-white" : "border-slate-200 bg-slate-50 text-slate-800"
                          )}
                        >
                          -
                        </button>
                        
                        <div className="text-center min-w-[100px]">
                          <span className={cn(
                            "text-4xl font-black tracking-tight block",
                            theme === 'dark' ? "text-white" : "text-zinc-900"
                          )}>
                            {aiGroupSize}
                          </span>
                          <span className="text-xs font-semibold text-slate-400/80 uppercase tracking-widest mt-1 block">
                            {aiGroupSize === 1 ? 'Member' : 'Members'}
                          </span>
                        </div>

                        <button 
                          type="button"
                          onClick={() => {
                            vibrate();
                            setAiGroupSize(prev => Math.min(50, prev + 1));
                          }}
                          disabled={aiGroupSize >= 50}
                          className={cn(
                            "w-12 h-12 rounded-2xl border flex items-center justify-center transition-all font-bold hover:scale-105 active:scale-95 text-lg disabled:opacity-40 select-none cursor-pointer",
                            theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-white" : "border-slate-200 bg-slate-50 text-slate-800"
                          )}
                        >
                          +
                        </button>
                      </div>

                      <div className="text-center py-2 px-4 bg-indigo-50/20 dark:bg-indigo-950/25 rounded-2xl border border-indigo-500/10 text-xs font-bold text-indigo-650 dark:text-indigo-400">
                        {aiGroupSize === 1 ? '1 Member' : `${aiGroupSize} Members`} expense structure will be auto-calculated.
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5 w-full">
                      <button
                        type="button"
                        onClick={() => {
                          vibrate();
                          setAiWorkflowStep('upload');
                        }}
                        className={cn(
                          "w-full py-4 rounded-2xl font-bold text-sm tracking-wide shadow-lg cursor-pointer flex items-center justify-center gap-2 text-white",
                          theme === 'dark'
                            ? "bg-indigo-600 md:hover:bg-indigo-500 md:hover:translate-y-[-1px] md:transition-all active:scale-95 shadow-indigo-950/40"
                            : "bg-indigo-600 md:hover:bg-indigo-700 md:hover:translate-y-[-1px] md:transition-all active:scale-95 shadow-indigo-100"
                        )}
                      >
                        Continue
                        <ArrowRight size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          vibrate();
                          setAiConstructionModal(null);
                        }}
                        className={cn(
                          "w-full py-2.5 rounded-xl font-bold text-xs tracking-wide cursor-pointer flex items-center justify-center gap-1.5 border transition-all hover:bg-slate-50 dark:hover:bg-zinc-900",
                          theme === 'dark'
                            ? "border-zinc-800 text-zinc-400"
                            : "border-slate-200 text-slate-500"
                        )}
                      >
                        Back to Dashboard
                      </button>
                    </div>
                  </div>
                )}

                {/* 1.5 File Upload Step */}
                {aiWorkflowStep === 'upload' && (
                  <div className="space-y-6 relative">
                    <button 
                      onClick={() => { vibrate(); setAiConstructionModal(null); }}
                      className={cn(
                        "absolute top-0 right-0 p-2 rounded-full border transition-all hover:scale-105 active:scale-95 cursor-pointer z-10",
                        theme === 'dark' 
                          ? "border-zinc-800 hover:bg-zinc-900 text-slate-400 hover:text-white" 
                          : "border-slate-100 hover:bg-slate-50 text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <X size={16} />
                    </button>

                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-900/60 font-sans pt-4">
                      <button
                        type="button"
                        onClick={() => setAiWorkflowStep('group')}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        <ArrowLeft size={14} /> Back
                      </button>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/10 px-3 py-1 rounded-full uppercase tracking-wider">
                        {aiGroupSize} {aiGroupSize === 1 ? 'Member' : 'Members'} Selected
                      </span>
                    </div>

                    <div className="text-center space-y-1.5">
                      <h3 className={cn(
                        "text-lg font-extrabold transition-colors duration-300",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>Upload Bill Image</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-xs text-center">
                        JPG, JPEG, PNG, or WEBP receipts are supported (Max 5 images).
                      </p>
                    </div>

                    {/* Drag & Drop Zone */}
                    <div 
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          startAiUploadReceiptParsing(e.dataTransfer.files);
                        }
                      }}
                      onClick={() => {
                        vibrate();
                        const el = document.getElementById('modal-ai-file-picker');
                        if (el) el.click();
                      }}
                      className={cn(
                        "border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group",
                        theme === 'dark' ? "border-indigo-900/50 bg-indigo-900/5 hover:bg-indigo-900/10" : "border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/50"
                      )}
                    >
                      <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl shadow-sm flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                        <Upload size={24} />
                      </div>
                      <div className="text-center font-sans">
                        <p className={cn(
                          "font-bold transition-colors text-sm",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>Drag & Drop image here</p>
                        <p className={cn(
                          "text-xs transition-colors",
                          theme === 'dark' ? "text-slate-400" : "text-slate-500"
                        )}>or click to browse image files</p>
                      </div>
                    </div>

                    {/* Quick Selection Buttons */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          vibrate();
                          const el = document.getElementById('modal-ai-file-picker');
                          if (el) el.click();
                        }}
                        className={cn(
                          "w-full flex items-center justify-center gap-2 py-3 border rounded-xl text-xs font-bold transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900 active:scale-95",
                          theme === 'dark' ? "border-zinc-800 text-slate-300" : "border-slate-200 text-slate-700"
                        )}
                      >
                        <Camera size={14} />
                        Select Receipt Images (Camera / Gallery)
                      </button>
                    </div>

                    <input 
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/jpg,image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          startAiUploadReceiptParsing(e.target.files);
                        }
                      }}
                      className="hidden"
                      id="modal-ai-file-picker"
                    />

                    <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 dark:bg-amber-900/10 rounded-xl text-amber-700 dark:text-amber-400 text-xs font-sans">
                      <div className="shrink-0"><Loader2 size={13} className="animate-spin" /></div>
                      <p>Full AI extraction automatically normalizes and splits currencies.</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        vibrate();
                        setAiConstructionModal(null);
                      }}
                      className={cn(
                        "w-full py-2.5 rounded-xl font-bold text-xs tracking-wide cursor-pointer flex items-center justify-center gap-1.5 border transition-all hover:bg-slate-50 dark:hover:bg-zinc-900 mt-2",
                        theme === 'dark'
                          ? "border-zinc-800 text-zinc-400"
                          : "border-slate-200 text-slate-500"
                      )}
                    >
                      Back to Dashboard
                    </button>
                  </div>
                )}

                {/* 2. Scanning Loader Step */}
                {aiWorkflowStep === 'scanning' && (
                  <div className="space-y-6 pt-4 text-center">
                    <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                      <motion.div 
                        animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0.15, 0.6] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                        className="absolute inset-0 rounded-full bg-indigo-500/20 dark:bg-indigo-500/10"
                      />
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        className="w-16 h-16 rounded-full border-4 border-indigo-300 dark:border-zinc-800 border-t-indigo-600 dark:border-t-indigo-400 flex items-center justify-center"
                      />
                      <Sparkles size={22} className="absolute text-indigo-600 dark:text-indigo-400 animate-pulse" />
                    </div>

                    <div className="space-y-2">
                      <h3 className={cn(
                        "text-xl font-black tracking-tight",
                        theme === 'dark' ? "text-white" : "text-zinc-900"
                      )}>AI TrackBook is scanning your bills...</h3>
                      <p className="text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-widest animate-pulse max-w-xs mx-auto">
                        {aiScanStatus}
                      </p>

                      {/* 0 to 100% Progressive Loading Design / Line Loading Animation */}
                      <div className="max-w-xs mx-auto space-y-2 pt-1 pb-2">
                        <div className="flex items-center justify-between text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest leading-none">
                          <span>Scanning progress</span>
                          <span className="font-mono text-xs">{Math.round(aiProgress)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-zinc-900 h-2 rounded-full overflow-hidden border border-slate-200/40 dark:border-zinc-800/40 relative">
                          <motion.div 
                            className="bg-indigo-600 dark:bg-indigo-400 h-full absolute left-0 top-0 rounded-full"
                            style={{ width: `${aiProgress}%` }}
                            transition={{ type: 'spring', damping: 20, stiffness: 80 }}
                          />
                        </div>
                        <div className="flex items-center justify-between px-1 text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mt-1.5">
                          <span>Est. Time Remaining</span>
                          <span className="font-mono text-indigo-600 dark:text-indigo-400 animate-pulse">{aiTimeRemaining}</span>
                        </div>
                      </div>

                      {/* Professional Processing Timeline */}
                      <div className="max-w-xs mx-auto pt-4 pb-2 border-t border-slate-100 dark:border-zinc-900/60 text-left">
                        <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-3">Live Processing Timeline</p>
                        <ProcessingTimeline currentStepId={aiCurrentStepId} completedSteps={aiCompletedSteps} theme={theme} />
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 dark:text-zinc-500 max-w-xs mx-auto leading-relaxed">
                      AI TrackBook is extracting receipt data, mapping categories, and parsing your splits. Please do not close this window.
                    </div>

                    {/* Floating Network Status Badge */}
                    <div className="absolute bottom-28 right-4 md:right-6 z-50">
                      <AnimatePresence>
                        {aiNetworkState === 'good' && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-3 shadow-lg max-w-[200px] text-left flex items-start gap-2 backdrop-blur-md"
                          >
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping mt-1 shrink-0" />
                            <div>
                              <h4 className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 leading-none">Connection: Good</h4>
                              <p className="text-[9px] text-emerald-600 dark:text-emerald-500 font-medium leading-tight mt-0.5">Uploads are running normally.</p>
                            </div>
                          </motion.div>
                        )}
                        {aiNetworkState === 'slow' && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-3 shadow-lg max-w-[200px] text-left flex items-start gap-2 backdrop-blur-md animate-pulse"
                          >
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse mt-1 shrink-0" />
                            <div>
                              <h4 className="text-[10px] font-black text-amber-800 dark:text-amber-400 leading-none">Connection: Slow</h4>
                              <p className="text-[9px] text-amber-600 dark:text-amber-500 font-medium leading-tight mt-0.5">
                                Internet is slower than usual. Receipt scanning continues automatically.
                              </p>
                            </div>
                          </motion.div>
                        )}
                        {aiNetworkState === 'offline' && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-3 shadow-lg max-w-[200px] text-left flex items-start gap-2 backdrop-blur-md border-l-4 border-l-rose-500"
                          >
                            <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping mt-1 shrink-0" />
                            <div>
                              <h4 className="text-[10px] font-black text-rose-800 dark:text-rose-400 leading-none">Connection Lost</h4>
                              <p className="text-[9px] text-rose-600 dark:text-rose-500 font-medium leading-tight mt-0.5 animate-pulse">
                                Waiting for connection... Do not close page.
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Background and Cancel Buttons */}
                    <div className="flex items-center gap-3 max-w-xs mx-auto pt-4 border-t border-slate-100 dark:border-zinc-900/60">
                      <button
                        type="button"
                        onClick={() => {
                          vibrate();
                          // Keep processing but leave immediately
                          setAiConstructionModal(null);
                          const slug = getBookSlug(activeBook?.name || '', activeBook?.id || '');
                          navigate(`/cashbooks/${slug}/entries`);
                        }}
                        className={cn(
                          "flex-1 py-2 rounded-xl font-bold text-xs tracking-wide cursor-pointer transition-all border",
                          theme === 'dark'
                            ? "border-zinc-800 text-zinc-300 bg-zinc-900 hover:bg-zinc-850"
                            : "border-slate-250 text-slate-700 bg-slate-50 hover:bg-slate-100"
                        )}
                      >
                        Back to Dashboard
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          vibrate();
                          cancelScanRef.current = true;
                          setAiWorkflowStep('group');
                          setIsUploading(false);
                          setAiConstructionModal(null);
                        }}
                        className={cn(
                          "flex-1 py-2 rounded-xl font-bold text-xs tracking-wide cursor-pointer transition-all border",
                          "border-rose-250 text-rose-600 bg-rose-50 hover:bg-rose-100 dark:border-rose-950/40 dark:text-rose-400 dark:bg-rose-950/20 dark:hover:bg-rose-950/45"
                        )}
                      >
                        Cancel Scan
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Confirmation Step */}
                {aiWorkflowStep === 'confirmation' && (
                  <div className="space-y-4 text-left flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-900/60 font-sans shrink-0">
                      <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400 animate-pulse" />
                        <h3 className={cn(
                          "text-lg font-extrabold tracking-tight",
                          theme === 'dark' ? "text-white" : "text-zinc-900"
                        )}>Verify Split Entry</h3>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "rounded font-black text-[10px] px-2.5 py-1 uppercase tracking-widest",
                          aiOcrConfidence < 80 
                            ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                            : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                        )}>
                          Confidence: {aiOcrConfidence}% {aiOcrConfidence < 80 ? '(Review Required)' : ''}
                        </span>
                        {aiOcrDuration > 0 && (
                          <span className="rounded bg-slate-50 dark:bg-zinc-900 text-slate-400 dark:text-zinc-500 font-mono text-[9px] px-2 py-1 border border-slate-100 dark:border-zinc-850">
                            {(aiOcrDuration / 1000).toFixed(2)}s
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col md:grid md:grid-cols-5 gap-4 overflow-hidden flex-1 min-h-0 w-full">
                      {/* Left Side: Thumbnail Preview */}
                      <div className="md:col-span-2 space-y-3 shrink-0">
                        <div className={cn(
                          "rounded-2xl border p-3 text-center space-y-2.5 shadow-inner",
                          theme === 'dark' ? "bg-zinc-900/40 border-zinc-900" : "bg-slate-50/50 border-slate-150"
                        )}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Receipt Preview</span>
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                              {aiGroupSize} {aiGroupSize === 1 ? 'Member' : 'Members'}
                            </span>
                          </div>

                          {aiFilePreviewUrl ? (
                            <div 
                              onClick={() => setShowFullScreenPreview(true)}
                              className="relative rounded-xl overflow-hidden aspect-[16/9] md:aspect-[3/4] bg-slate-100 dark:bg-zinc-950 flex items-center justify-center border border-slate-200 dark:border-zinc-850 shadow-inner cursor-pointer group/preview"
                            >
                              <img 
                                src={aiFilePreviewUrl} 
                                alt="Receipt Thumbnail" 
                                className="w-full h-full object-cover group-hover/preview:scale-105 transition-transform duration-300"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 flex items-center justify-center transition-opacity duration-200">
                                <span className="text-[10px] font-bold text-white bg-indigo-600 px-2 py-1 rounded shadow">Click to Expand</span>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-800 flex flex-col items-center justify-center p-3 md:p-6 aspect-[16/9] md:aspect-[3/4] text-slate-400 bg-slate-100/50 dark:bg-zinc-950">
                              <FileText size={24} className="stroke-[1.5] text-slate-400 dark:text-zinc-600" />
                              <span className="text-[10px] font-bold mt-1">Document processed</span>
                              <span className="text-[9px] text-slate-400 mt-0.5 truncate max-w-full px-2 font-mono">
                                {aiFile?.name}
                              </span>
                            </div>
                          )}
                          <div className="text-[10px] font-black text-emerald-500 flex items-center justify-center gap-1">
                            <Check size={12} strokeWidth={3} />
                            Classified: {aiBillType} Detection
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Form Fields to verify */}
                      <div className="md:col-span-3 space-y-4 overflow-y-auto flex-1 md:h-full min-h-0 pr-1 pb-4">
                        <div className="grid grid-cols-2 gap-4 font-sans">
                          {/* Amount */}
                          <div className="space-y-1.5 col-span-2 sm:col-span-1">
                            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Amount</label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                              <input 
                                type="number"
                                value={aiAmount}
                                onChange={(e) => setAiAmount(e.target.value)}
                                className={cn(
                                  "w-full pl-7 pr-4 py-3 rounded-xl border text-sm font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors",
                                  theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                                )}
                              />
                            </div>
                          </div>

                          {/* Merchant */}
                          <div className="space-y-1.5 col-span-2 sm:col-span-1">
                            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Merchant</label>
                            <input 
                              type="text"
                              value={aiMerchant}
                              onChange={(e) => setAiMerchant(e.target.value)}
                              className={cn(
                                "w-full px-4 py-3 rounded-xl border text-sm font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors",
                                theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                              )}
                            />
                          </div>

                          {/* Date */}
                          <div className="space-y-1.5 col-span-1">
                            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date</label>
                            <input 
                              type="text"
                              value={aiDate}
                              onChange={(e) => setAiDate(e.target.value)}
                              placeholder="DD-MM-YYYY"
                              className={cn(
                                "w-full px-4 py-3 rounded-xl border text-sm font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors",
                                theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                              )}
                            />
                          </div>

                          {/* Time */}
                          <div className="space-y-1.5 col-span-1">
                            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Time</label>
                            <input 
                              type="text"
                              value={aiTime}
                              onChange={(e) => setAiTime(e.target.value)}
                              placeholder="e.g., 01:20 PM"
                              className={cn(
                                "w-full px-4 py-3 rounded-xl border text-sm font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors",
                                theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                              )}
                            />
                          </div>

                          {/* Bill Type Category selection */}
                          <div className="space-y-1.5 col-span-1">
                            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Bill Type</label>
                            <select 
                              value={aiBillType}
                              onChange={(e) => setAiBillType(e.target.value)}
                              className={cn(
                                "w-full px-4 py-3 rounded-xl border text-sm font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors appearance-none cursor-pointer",
                                theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                              )}
                            >
                              {["Restaurant", "Food", "Taxi", "Cab", "Bus", "Train", "Flight", "Fuel", "Groceries", "Medical", "Shopping", "Utilities", "Internet", "Recharge", "Hotel", "Entertainment"].map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>

                          {/* Ledger Category selection */}
                          <div className="space-y-1.5 col-span-1">
                            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Category</label>
                            <select 
                              value={aiCategory}
                              onChange={(e) => setAiCategory(e.target.value)}
                              className={cn(
                                "w-full px-4 py-3 rounded-xl border text-sm font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors appearance-none cursor-pointer",
                                theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                              )}
                            >
                              {["Food", "Transport", "Utilities", "Shopping", "Entertainment", "Health", "Education", "Salary", "Other"].map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>

                          {/* Description field */}
                          <div className="space-y-1.5 col-span-2">
                            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Generated Description</label>
                            <input 
                              type="text"
                              value={aiDescription}
                              onChange={(e) => setAiDescription(e.target.value)}
                              className={cn(
                                "w-full px-4 py-3 rounded-xl border text-sm font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors",
                                theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-white" : "border-slate-200 bg-slate-50 text-slate-900"
                              )}
                            />
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-zinc-900/60 font-sans">
                          <button
                            type="button"
                            onClick={() => {
                              vibrate();
                              setAiWorkflowStep('group');
                              setAiFile(null);
                              setAiFilePreviewUrl('');
                              setAiConstructionModal(null);
                            }}
                            className={cn(
                              "flex-1 py-3 rounded-xl font-bold text-xs tracking-wide border cursor-pointer active:scale-95 transition-all text-center flex items-center justify-center gap-1.5",
                              theme === 'dark' 
                                ? "border-zinc-800 text-slate-400 hover:bg-zinc-900" 
                                : "border-slate-200 text-slate-500 hover:bg-slate-50"
                            )}
                          >
                            <Trash2 size={13} />
                            Discard
                          </button>
                          
                          <button
                            type="button"
                            onClick={async () => {
                              vibrate();
                              await handleSaveAiEntry();
                            }}
                            className={cn(
                              "flex-[2] py-3 rounded-xl font-black text-xs tracking-wide shadow-md active:scale-95 text-center flex items-center justify-center gap-1.5 cursor-pointer text-white",
                              theme === 'dark' 
                                ? "bg-indigo-600 md:hover:bg-indigo-500 md:transition-colors shadow-indigo-950/50" 
                                : "bg-indigo-600 md:hover:bg-indigo-700 md:transition-colors shadow-indigo-100"
                            )}
                          >
                            <Check size={13} />
                            SAVE ENTRY
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Completion Step */}
                {aiWorkflowStep === 'completion' && (
                  <div className="space-y-6 text-center py-6">
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1] }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-sm"
                    >
                      <Check size={40} strokeWidth={3} className="text-emerald-500" />
                    </motion.div>

                    <div className="space-y-2">
                      <h3 className={cn(
                        "text-xl font-extrabold tracking-tight",
                        theme === 'dark' ? "text-white" : "text-zinc-900"
                      )}>Receipt imported successfully.</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-xs max-w-xs mx-auto leading-relaxed">
                        Your split entry has been successfully verified, parsed, and logged to your cashbook ledger.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 max-w-xs mx-auto pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          vibrate();
                          setAiWorkflowStep('group');
                          setAiGroupSize(1);
                          setIsUploading(false);
                          setHandwrittenQueue([]);
                          setCurrentQueueIndex(0);
                          setAiConstructionModal(null);
                          const slug = getBookSlug(activeBook?.name || '', activeBook?.id || '');
                          navigate(`/cashbooks/${slug}/entries`);
                        }}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs tracking-wide cursor-pointer transition-all shadow-md text-center"
                      >
                        Review Entry
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          vibrate();
                          setAiWorkflowStep('group');
                          setAiGroupSize(1);
                          setIsUploading(false);
                          setHandwrittenQueue([]);
                          setCurrentQueueIndex(0);
                        }}
                        className={cn(
                          "w-full py-2.5 rounded-xl font-bold text-xs tracking-wide cursor-pointer transition-all border text-center",
                          theme === 'dark'
                            ? "border-zinc-800 text-zinc-350 bg-zinc-900/60 hover:bg-zinc-850"
                            : "border-slate-200 text-slate-650 bg-slate-50 hover:bg-slate-100"
                        )}
                      >
                        Upload Another Receipt
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>

      {/* AI Drop Zone Modal */}
      <AnimatePresence>
        {showDropZone && (
          <div className={cn(
            "fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-md transition-colors duration-300",
            theme === 'dark' ? "bg-black/70" : "bg-slate-900/40"
          )}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className={cn(
                "w-full max-w-md rounded-3xl p-8 shadow-2xl space-y-6 transition-colors duration-300",
                theme === 'dark' ? "bg-zinc-950" : "bg-white border border-slate-100"
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className={cn(
                  "text-xl font-bold transition-colors duration-300",
                  theme === 'dark' ? "text-white" : "text-black"
                )}>Drop Images</h3>
                <button 
                  onClick={() => setShowDropZone(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files) {
                    processFiles(e.dataTransfer.files);
                    setShowDropZone(false);
                  }
                }}
                onClick={() => triggerUploadSelector('ai')}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer group",
                  theme === 'dark' ? "border-indigo-900/50 bg-indigo-900/5 hover:bg-indigo-900/10" : "border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50/50"
                )}
              >
                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                  <Upload size={32} />
                </div>
                <div className="text-center">
                  <p className={cn(
                    "font-bold transition-colors duration-300",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>Drag & Drop images here</p>
                  <p className={cn(
                    "text-sm transition-colors duration-300",
                    theme === 'dark' ? "text-slate-400" : "text-slate-500"
                  )}>or click to browse files</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl text-amber-700 dark:text-amber-400 text-xs">
                <div className="shrink-0"><Loader2 size={14} className="animate-spin" /></div>
                <p>AI will process images one by one. Max 5 images allowed.</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Book Modal */}
      <AnimatePresence>
        {isCreatingBook && (
          <div className={cn(
            "fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300",
            theme === 'dark' ? "bg-black/60" : "bg-slate-900/40"
          )}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "w-full max-w-md rounded-3xl p-6 shadow-2xl transition-colors duration-300",
                theme === 'dark' ? "bg-zinc-950" : "bg-white"
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={cn(
                  "text-xl font-bold transition-colors duration-300",
                  theme === 'dark' ? "text-white" : "text-black"
                )}>Create New Book</h3>
                <button onClick={() => { setIsCreatingBook(false); setCreateBookError(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleCreateBook} className="space-y-4">
                {createBookError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl flex items-start gap-2 text-xs font-semibold dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400 animate-shake">
                    <AlertCircle size={15} className="shrink-0 text-rose-500 mt-0.5 dark:text-rose-400" />
                    <span className="flex-1 leading-relaxed">{createBookError}</span>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Book Name</label>
                  <input
                    autoFocus
                    type="text"
                    placeholder="e.g., Personal, Business"
                    value={newBookName}
                    onChange={(e) => {
                      setNewBookName(e.target.value);
                      if (createBookError) setCreateBookError(null);
                    }}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                      theme === 'dark' ? "bg-slate-800 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-black"
                    )}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Creation Date</label>
                  <input
                    type="text"
                    disabled
                    value={new Date().toLocaleDateString()}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border outline-none cursor-not-allowed",
                      theme === 'dark' ? "bg-slate-800/50 border-slate-800 text-slate-500" : "bg-slate-100 border-slate-200 text-slate-400"
                    )}
                  />
                </div>
                <button
                  type="submit"
                  className={cn(
                    "w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all",
                    theme === 'dark' ? "shadow-none" : "shadow-lg shadow-indigo-100"
                  )}
                >
                  Create Book
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Book Modal */}
      <AnimatePresence>
        {isEditingBook && (
          <div className={cn(
            "fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300",
            theme === 'dark' ? "bg-black/60" : "bg-slate-900/40"
          )}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "w-full max-w-md rounded-3xl p-6 shadow-2xl transition-colors duration-300",
                theme === 'dark' ? "bg-zinc-950" : "bg-white"
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={cn(
                  "text-xl font-bold transition-colors duration-300",
                  theme === 'dark' ? "text-white" : "text-black"
                )}>Edit Book Name</h3>
                <button onClick={() => { setIsEditingBook(null); setEditBookError(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleUpdateBook} className="space-y-4">
                {editBookError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl flex items-start gap-2 text-xs font-semibold dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400 animate-shake">
                    <AlertCircle size={15} className="shrink-0 text-rose-500 mt-0.5 dark:text-rose-400" />
                    <span className="flex-1 leading-relaxed">{editBookError}</span>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Book Name</label>
                  <input
                    autoFocus
                    type="text"
                    value={editBookName}
                    onChange={(e) => {
                      setEditBookName(e.target.value);
                      if (editBookError) setEditBookError(null);
                    }}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
                      theme === 'dark' ? "bg-slate-800 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-black"
                    )}
                  />
                </div>
                <button
                  type="submit"
                  className={cn(
                    "w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all",
                    theme === 'dark' ? "shadow-none" : "shadow-lg shadow-indigo-100"
                  )}
                >
                  Save Changes
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Settings Modal */}
      {(() => {
        const handleSendLinkingOtp = async () => {
          if (!supabase || !session?.user) return;
          if (!phoneNumberToLink) {
            setProfileError('Please enter a valid phone number.');
            return;
          }
          
          setProfileLoading(true);
          setProfileError(null);
          setProfileSuccess(null);
          
          // Disable phone linking and trigger coming soon flow
          setShowPhoneLinkingComingSoon(true);
          setProfileLoading(false);
          return;
        };

        const handleVerifyLinkingOtp = async () => {
          setProfileError('Phone number linking is currently under development.');
          return;
        };

        const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
          if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) {
              setProfileError('Please select a valid image file (JPG, PNG, WebP).');
              return;
            }
            if (file.size > 10 * 1024 * 1024) {
              setProfileError('Image size should be less than 10MB.');
              return;
            }
            setAvatarFile(file);
            const preview = URL.createObjectURL(file);
            setAvatarPreview(preview);
            setProfileError(null);
          }
        };

        const handleRemoveAvatar = () => {
          setAvatarFile(null);
          setAvatarPreview(null);
          setUserAvatarUrl(null);
          try { localStorage.removeItem('trackbook_avatar'); } catch (e) {}
        };

        const handleSaveProfileName = async () => {
          if (!supabase || !session?.user) return;
          setProfileLoading(true);
          setProfileError(null);
          setProfileSuccess(null);
          
          try {
            let finalAvatarUrl = userAvatarUrl;
            if (avatarFile) {
              try {
                const profileFolder = await getUserProfileCloudinaryFolder(session?.user);
                const uploadedUrl = await uploadToCloudinary(avatarFile, profileFolder);
                if (uploadedUrl) {
                  finalAvatarUrl = uploadedUrl;
                  setUserAvatarUrl(uploadedUrl);
                  try { localStorage.setItem('trackbook_avatar', uploadedUrl); } catch (e) {}
                }
              } catch (uploadErr) {
                console.warn('Profile image upload failed, falling back to preview URL:', uploadErr);
                if (avatarPreview) {
                  finalAvatarUrl = avatarPreview;
                  setUserAvatarUrl(avatarPreview);
                  try { localStorage.setItem('trackbook_avatar', avatarPreview); } catch (e) {}
                }
              }
            } else if (avatarPreview === null && !userAvatarUrl) {
              finalAvatarUrl = null;
            }

            try {
              const { error: authErr } = await supabase.auth.updateUser({
                data: { full_name: userName, avatar_url: finalAvatarUrl }
              });
              if (authErr) console.warn('Auth user metadata update note:', authErr);
            } catch (e) {}
            
            try {
              const { error: profErr } = await supabase.from('profiles').upsert({
                id: session.user.id,
                email: session.user.email || null,
                full_name: userName,
                avatar_url: finalAvatarUrl,
                phone: session.user.phone || null,
                phone_verified: session.user.phone_confirmed_at ? true : false,
                updated_at: new Date().toISOString()
              }, { onConflict: 'id' });
              
              if (profErr) {
                console.warn('Profiles table sync note:', profErr);
                if (profErr.code === '42703' || profErr.message?.includes('column')) {
                  await supabase.from('profiles').upsert({
                    id: session.user.id,
                    email: session.user.email || null,
                    full_name: userName,
                    phone: session.user.phone || null,
                    phone_verified: session.user.phone_confirmed_at ? true : false,
                  }, { onConflict: 'id' });
                }
              }
            } catch (dbErr) {
              console.warn('Profiles table sync failed:', dbErr);
            }
            
            setProfileSuccess('Profile updated successfully!');
            setTimeout(() => {
              setIsEditingName(false);
              setAvatarFile(null);
              setAvatarPreview(null);
              setProfileSuccess(null);
            }, 1200);
          } catch (err: any) {
            console.error('Error saving profile settings:', err);
            setProfileError(err.message || 'Failed to save changes.');
          } finally {
            setProfileLoading(false);
          }
        };

        const handleCloseProfileModal = () => {
          setIsEditingName(false);
          setAvatarFile(null);
          setAvatarPreview(null);
          setLinkingMode('view');
          setPhoneNumberToLink('');
          setLinkingOtp('');
          setLinkingOtpSent(false);
          setProfileError(null);
          setProfileSuccess(null);
        };

        return (
          <AnimatePresence>
            {isEditingName && (
              <div className={cn(
                "fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300",
                theme === 'dark' ? "bg-black/60" : "bg-slate-900/40"
              )}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={cn(
                    "w-full max-w-md rounded-3xl p-6 shadow-2xl transition-colors duration-300",
                    theme === 'dark' ? "bg-slate-900 border border-slate-800" : "bg-white border border-slate-100"
                  )}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      {linkingMode !== 'view' && (
                        <button 
                          onClick={() => {
                            setLinkingMode('view');
                            setLinkingOtpSent(false);
                            setProfileError(null);
                            setProfileSuccess(null);
                          }}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors cursor-pointer",
                            theme === 'dark' ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-600"
                          )}
                        >
                          <ArrowLeft size={16} />
                        </button>
                      )}
                      <h3 className={cn(
                        "text-lg font-extrabold transition-colors duration-300",
                        theme === 'dark' ? "text-white" : "text-slate-900"
                      )}>
                        {linkingMode === 'view' ? 'Profile Settings' :
                         linkingMode === 'link' ? 'Link Phone Number' : 'Change Phone Number'}
                      </h3>
                    </div>
                    <button onClick={handleCloseProfileModal} className={cn(
                      "p-2 rounded-full transition-colors cursor-pointer",
                      theme === 'dark' ? "hover:bg-slate-800" : "hover:bg-slate-100"
                    )}>
                      <X size={20} className="text-slate-400" />
                    </button>
                  </div>

                  {/* Errors / Success Status lines */}
                  <AnimatePresence mode="wait">
                    {profileError && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 flex items-start gap-2.5"
                      >
                        <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={14} />
                        <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 leading-normal">
                          {profileError}
                        </span>
                      </motion.div>
                    )}
                    {profileSuccess && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="mb-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 flex items-start gap-2.5"
                      >
                        <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={14} />
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 leading-normal">
                          {profileSuccess}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {linkingMode === 'view' ? (
                    <div className="space-y-4">
                      {/* Name input */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">Your Name</label>
                        <input
                          type="text"
                          value={userName}
                          onChange={(e) => setUserName(e.target.value)}
                          placeholder="Your full name"
                          className={cn(
                            "w-full px-4 py-3 rounded-2xl border outline-none text-xs font-semibold focus:ring-4 transition-all",
                            theme === 'dark' 
                              ? "border-slate-800 bg-slate-900 text-white focus:border-indigo-500 focus:ring-indigo-950/40" 
                              : "border-slate-200 bg-slate-50 text-slate-800 focus:border-indigo-500 focus:ring-indigo-100"
                          )}
                        />
                      </div>

                      {/* Profile Picture (WhatsApp DP Style under Your Name) */}
                      <div className="space-y-2 pt-1">
                        <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">Profile Picture</label>
                        
                        <div className={cn(
                          "p-4 rounded-2xl border flex items-center gap-4 transition-colors",
                          theme === 'dark' ? "bg-slate-950/40 border-slate-800" : "bg-slate-50/70 border-slate-200/80"
                        )}>
                          {/* Round WhatsApp DP Avatar */}
                          <div className="relative group shrink-0">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full ring-4 ring-indigo-500/20 overflow-hidden bg-indigo-600 flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-md relative aspect-square">
                              {avatarPreview || userAvatarUrl ? (
                                <img 
                                  src={avatarPreview || userAvatarUrl || ''} 
                                  alt="Profile Avatar" 
                                  className="w-full h-full object-cover rounded-full"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="select-none">{userName && userName.length > 0 ? userName[0].toUpperCase() : 'U'}</span>
                              )}
                              
                              {/* Hover Overlay */}
                              <label 
                                htmlFor="profile-avatar-input"
                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[10px] font-bold cursor-pointer transition-opacity backdrop-blur-[1px] rounded-full"
                              >
                                <Camera size={18} className="mb-0.5" />
                                <span>Change</span>
                              </label>
                            </div>
                            
                            {/* Floating camera button (WhatsApp style badge) */}
                            <label
                              htmlFor="profile-avatar-input"
                              className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-full shadow-lg border-2 border-white dark:border-slate-900 cursor-pointer transition-all"
                              title="Upload profile picture"
                            >
                              <Camera size={13} />
                            </label>
                            
                            <input 
                              id="profile-avatar-input"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleAvatarFileSelect}
                            />
                          </div>

                          {/* Action details & buttons */}
                          <div className="flex flex-col items-start gap-1 flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                              {avatarPreview || userAvatarUrl ? 'Custom Profile Photo' : 'Add an image'}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                              Same as WhatsApp DP. JPG, PNG or WebP.
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <label
                                htmlFor="profile-avatar-input"
                                className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl text-[11px] font-bold cursor-pointer transition-all inline-flex items-center gap-1.5 border border-indigo-200/50 dark:border-indigo-800/40 select-none"
                              >
                                <ImagePlus size={13} />
                                <span>{avatarPreview || userAvatarUrl ? 'Change Photo' : 'Add an image'}</span>
                              </label>
                              {(avatarPreview || userAvatarUrl) && (
                                <button
                                  type="button"
                                  onClick={handleRemoveAvatar}
                                  className="px-2.5 py-1.5 text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl text-[11px] font-bold transition-all cursor-pointer select-none"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Email (Read Only) */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">Email Address</label>
                        <div className="relative">
                          <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            readOnly
                            disabled
                            value={session?.user?.email || 'No email registered (Phone Auth)'}
                            className={cn(
                              "w-full pl-10 pr-4 py-3 rounded-2xl border outline-none text-xs font-semibold select-all cursor-not-allowed opacity-75",
                              theme === 'dark' 
                                ? "border-slate-800/80 bg-slate-950/40 text-slate-400" 
                                : "border-slate-150 bg-slate-100/50 text-slate-500"
                            )}
                          />
                        </div>
                        <span className="text-[8.5px] font-bold text-slate-400 dark:text-slate-500 block ml-1">
                          Email cannot be modified
                        </span>
                      </div>

                      {/* Phone linking status section */}
                      <div className="p-4 rounded-2xl border border-dashed flex flex-col gap-3 transition-colors duration-300 mt-2 bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-slate-400" />
                            <span className={cn(
                              "text-xs font-extrabold uppercase tracking-wider",
                              theme === 'dark' ? "text-slate-300" : "text-slate-700"
                            )}>Phone Authentication</span>
                          </div>
                          {userPhoneVerified ? (
                            <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
                              ✓ Verified Mobile Number
                            </span>
                          ) : userPhone ? (
                            <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-yellow-100 text-yellow-850 dark:bg-yellow-950/30 dark:text-yellow-400 border border-yellow-200">
                              Unverified
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              Unlinked
                            </span>
                          )}
                        </div>

                        {userPhone ? (
                          <div className="flex flex-col gap-2 mt-1">
                            <div className="flex items-center justify-between gap-3 bg-slate-100/30 dark:bg-zinc-900/30 p-2.5 rounded-xl border border-slate-150/50 dark:border-zinc-800/50">
                              <div className="flex items-center gap-2">
                                <Lock size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
                                <span className="text-xs font-mono font-black tracking-wider text-slate-800 dark:text-slate-200">
                                  {userPhone}
                                </span>
                              </div>
                            </div>
                            <p className="text-[9.5px] font-bold text-rose-500 dark:text-rose-400 bg-rose-500/5 p-2.5 rounded-xl border border-rose-500/10 leading-normal mt-1">
                              ⚠️ This mobile number is permanently linked to your account. For security reasons it cannot be changed without administrator verification.
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 mt-1">
                            <p className="text-[10.5px] font-bold text-slate-400 dark:text-slate-500 leading-normal">
                              Link your phone number to sign in instantly with dynamic SMS OTP.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setShowPhoneLinkingComingSoon(true);
                              }}
                              className="text-[10.5px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:underline text-left cursor-pointer self-start"
                            >
                              Link Phone Number
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Primary Actions */}
                      <div className="pt-2">
                        <button
                          disabled={profileLoading}
                          onClick={handleSaveProfileName}
                          className={cn(
                            "w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-500/10",
                            theme === 'dark' ? "shadow-none" : ""
                          )}
                        >
                          {profileLoading ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            'Save Settings'
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* OTP flow UI for Link/Change phone number */
                    <div className="space-y-4">
                      {!linkingOtpSent ? (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">Phone Number</label>
                            <CountryCodePicker
                              selectedCountry={linkingSelectedCountry}
                              onSelectCountry={setLinkingSelectedCountry}
                              phoneNumber={phoneNumberToLink}
                              onPhoneNumberChange={setPhoneNumberToLink}
                              theme={theme === 'dark' ? 'dark' : 'light'}
                              isDesktop={false}
                            />
                            <span className="text-[8.5px] font-bold text-slate-400 dark:text-slate-500 block ml-1 leading-normal">
                              Select your country code and enter your mobile number.
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={profileLoading}
                            onClick={handleSendLinkingOtp}
                            className={cn(
                              "w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-500/10",
                              theme === 'dark' ? "shadow-none" : ""
                            )}
                          >
                            {profileLoading ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              'Send Verification OTP'
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">6-Digit SMS Verification OTP</label>
                            <div className="relative">
                              <Key size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                autoFocus
                                maxLength={6}
                                value={linkingOtp}
                                onChange={(e) => setLinkingOtp(e.target.value)}
                                placeholder="Enter 6-digit code"
                                className={cn(
                                  "w-full pl-10 pr-4 py-3 rounded-2xl border outline-none text-xs font-semibold focus:ring-4 transition-all text-center tracking-widest font-mono",
                                  theme === 'dark' 
                                    ? "border-slate-800 bg-slate-900 text-white focus:border-indigo-500 focus:ring-indigo-950/40" 
                                    : "border-slate-200 bg-slate-50 text-slate-800 focus:border-indigo-500 focus:ring-indigo-100"
                                )}
                              />
                            </div>
                            <div className="flex justify-between items-center px-1 pt-1">
                              <button
                                type="button"
                                onClick={() => setLinkingOtpSent(false)}
                                className="text-[9.5px] font-bold text-blue-600 hover:underline cursor-pointer"
                              >
                                Edit Phone Number
                              </button>
                              <button
                                type="button"
                                onClick={handleSendLinkingOtp}
                                className="text-[9.5px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:underline cursor-pointer"
                              >
                                Resend SMS OTP
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={profileLoading}
                            onClick={handleVerifyLinkingOtp}
                            className={cn(
                              "w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/10",
                              theme === 'dark' ? "shadow-none" : ""
                            )}
                          >
                            {profileLoading ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              'Verify & Link'
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>

                {/* Security Confirmation Modal */}
                <AnimatePresence>
                  {showPhoneSecurityModal && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={cn(
                          "w-full max-w-sm rounded-3xl p-6 shadow-2xl border",
                          theme === 'dark' ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-150 text-slate-900"
                        )}
                      >
                        <h4 className="text-sm font-extrabold uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Lock size={15} className="text-indigo-500" />
                          Link Mobile Number
                        </h4>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                          After verification this mobile number will become part of your account authentication methods. Ensure you are using your permanent mobile number.
                        </p>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setShowPhoneSecurityModal(false)}
                            className={cn(
                              "flex-1 py-3 rounded-2xl font-bold text-xs cursor-pointer transition-all border",
                              theme === 'dark' 
                                ? "bg-transparent border-slate-800 hover:bg-slate-800 text-slate-300" 
                                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600"
                            )}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowPhoneSecurityModal(false);
                              setLinkingMode('link');
                              setPhoneNumberToLink('');
                              setLinkingOtp('');
                              setLinkingOtpSent(false);
                              setProfileError(null);
                              setProfileSuccess(null);
                            }}
                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs cursor-pointer transition-all shadow-md shadow-indigo-500/15"
                          >
                            Continue
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </AnimatePresence>
        );
      })()}

      {/* Mobile Linking Coming Soon Modal */}
      <AnimatePresence>
        {showPhoneLinkingComingSoon && (
          <PhoneComingSoonModal
            isOpen={showPhoneLinkingComingSoon}
            onClose={() => setShowPhoneLinkingComingSoon(false)}
            type="link"
            theme={theme === 'dark' ? 'dark' : 'light'}
          />
        )}
      </AnimatePresence>

      {/* Automation Mail Beta Confirmation Modal */}
      <AnimatePresence>
        {isAutomationMailConfirmOpen && (
          <div className={cn(
            "fixed inset-0 z-[110] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300",
            theme === 'dark' ? "bg-black/60" : "bg-indigo-900/10"
          )}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={cn(
                "w-full max-w-md rounded-3xl border p-6 space-y-6 shadow-2xl relative overflow-hidden",
                theme === 'dark' ? "bg-[#12131a] border-zinc-800 text-[#c5c6c7]" : "bg-white border-slate-200 text-slate-800"
              )}
            >
              {/* Background gradient blur */}
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
              
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 rounded-2xl text-indigo-500 border border-indigo-500/10 shrink-0">
                  <Mail size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={cn(
                      "font-black text-lg uppercase tracking-wide",
                      theme === 'dark' ? "text-slate-100" : "text-slate-900"
                    )}>
                      🚀 Automation Mail
                    </h3>
                    <span className="px-2 py-0.5 text-[9px] font-extrabold bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-full uppercase tracking-widest border border-indigo-500/10">BETA</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className={cn(
                  "text-sm space-y-3 leading-relaxed",
                  theme === 'dark' ? "text-slate-300" : "text-slate-600"
                )}>
                  <p>This feature is currently available as a Beta Version.</p>
                  <p>We're continuously improving it and adding more enterprise automation features.</p>
                  <p>Thank you for helping us test the experience.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => { vibrate(5); setIsAutomationMailConfirmOpen(false); }}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer",
                    theme === 'dark' 
                      ? "bg-zinc-900 border border-zinc-800 text-slate-300 hover:bg-zinc-850 hover:text-slate-200" 
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    vibrate(10);
                    setIsAutomationMailConfirmOpen(false);
                    navigate('/automation-mail');
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/15"
                >
                  Continue to Beta
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transaction Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className={cn(
            "fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300",
            theme === 'dark' ? "bg-black/60" : "bg-indigo-900/10"
          )}>
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className={cn(
                "relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden transition-colors duration-300",
                theme === 'dark' ? "bg-zinc-950" : "bg-white"
              )}
            >
              {/* Quick Add Success Overlay */}
              <AnimatePresence>
                {quickAddSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] sm:text-xs font-black tracking-widest px-5 py-2.5 rounded-full shadow-xl z-50 flex items-center gap-2 border border-emerald-500/30"
                  >
                    <CheckSquare size={13} className="animate-bounce" />
                    <span>ENTRY SAVED &amp; COMPLETED! ADDING NEXT...</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Modal Header */}
              <div className={cn(
                "flex items-center justify-between p-4 sm:p-6 border-b transition-colors duration-300",
                theme === 'dark' ? "border-slate-800" : "border-slate-100"
              )}>
                <div className="flex flex-col gap-1">
                  <h3 className={cn(
                    "text-xl sm:text-2xl font-bold transition-colors duration-300",
                    theme === 'dark' ? "text-white" : "text-slate-800"
                  )}>
                    {editingTransaction 
                      ? (showForm === 'in' ? 'Edit Cash In' : 'Edit Cash Out') 
                      : (showForm === 'in' ? 'Add Cash In' : 'Add Cash Out')}
                  </h3>
                  {editingTransaction && getTransactionSource(editingTransaction) === 'Imported' && (
                    <span className="text-[9px] sm:text-[10px] font-extrabold text-sky-600 dark:text-sky-400 mt-1 uppercase tracking-widest flex items-center gap-1 bg-sky-50 dark:bg-sky-950/30 px-2.5 py-1 rounded-lg border border-sky-100 dark:border-sky-900/30 w-max select-none">
                      ✓ Imported Entry
                    </span>
                  )}
                  {editingTransaction && getTransactionSource(editingTransaction) === 'AI' && (
                    <span className="text-[9px] sm:text-[10px] font-extrabold text-amber-600 dark:text-amber-400 mt-1 uppercase tracking-widest flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg border border-amber-100 dark:border-amber-900/30 w-max select-none">
                      <Sparkles size={11} /> AI Generated Entry
                    </span>
                  )}
                </div>
                <button onClick={resetForm} className={cn(
                  "p-2 rounded-full transition-colors",
                  theme === 'dark' ? "hover:bg-slate-800" : "hover:bg-slate-100"
                )}>
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[80vh] overflow-y-auto no-scrollbar">
                {/* Type Tabs */}
                <div className="flex flex-col gap-4">
                  <div className={cn(
                    "p-1 rounded-xl flex gap-1 transition-colors duration-300",
                    theme === 'dark' ? "bg-slate-800" : "bg-slate-100"
                  )}>
                    <button
                      type="button"
                      onClick={() => setShowForm('in')}
                      className={cn(
                        "flex-1 py-2 sm:py-3 rounded-lg font-bold transition-all text-xs sm:text-sm",
                        showForm === 'in' 
                          ? (theme === 'dark' ? "bg-slate-700 text-emerald-400 shadow-sm" : "bg-white text-emerald-600 shadow-sm")
                          : (theme === 'dark' ? "text-slate-400 hover:bg-slate-700/50" : "text-slate-500 hover:bg-slate-200/50")
                      )}
                    >
                      CASH IN
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm('out')}
                      className={cn(
                        "flex-1 py-2 sm:py-3 rounded-lg font-bold transition-all text-xs sm:text-sm",
                        showForm === 'out' 
                          ? (theme === 'dark' ? "bg-slate-700 text-rose-400 shadow-sm" : "bg-white text-rose-600 shadow-sm")
                          : (theme === 'dark' ? "text-slate-400 hover:bg-slate-700/50" : "text-slate-500 hover:bg-slate-200/50")
                      )}
                    >
                      CASH OUT
                    </button>
                  </div>
                </div>

                <form onSubmit={handleAddTransaction} className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Time</label>
                      <input
                        type="datetime-local"
                        value={transactionDate}
                        onChange={(e) => setTransactionDate(e.target.value)}
                        tabIndex={-1}
                        className={cn(
                          "w-full h-[52px] px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium transition-colors duration-300",
                          theme === 'dark' ? "bg-slate-800 text-white" : "bg-slate-50 text-black"
                        )}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount (₹)</label>
                      <input
                        ref={amountInputRef}
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        tabIndex={1}
                        className={cn(
                          "w-full h-[52px] px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium transition-colors duration-300",
                          theme === 'dark' ? "bg-slate-800 text-white" : "bg-slate-50 text-black"
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                      <div className="space-y-2">
                        <div className="relative">
                          <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            tabIndex={2}
                            className={cn(
                              "w-full h-[52px] px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium appearance-none transition-colors duration-300",
                              theme === 'dark' ? "bg-slate-800 text-white" : "bg-slate-50 text-black"
                            )}
                          >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                        {category === 'Custom' && (
                          <input
                            type="text"
                            placeholder="Enter custom category"
                            value={customCategory}
                            onChange={(e) => setCustomCategory(e.target.value)}
                            tabIndex={2}
                            className={cn(
                              "w-full h-[52px] px-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all",
                              theme === 'dark' ? "bg-slate-800 border-indigo-900/30 text-white" : "bg-slate-50 border-indigo-100 text-black"
                            )}
                          />
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mode</label>
                      <div className="space-y-2">
                        <div className="relative">
                          <select
                            value={mode}
                            onChange={(e) => setMode(e.target.value)}
                            tabIndex={3}
                            className={cn(
                              "w-full h-[52px] px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium appearance-none transition-colors duration-300",
                              theme === 'dark' ? "bg-slate-800 text-white" : "bg-slate-50 text-black"
                            )}
                          >
                            {MODES.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                        {mode === 'Custom' && (
                          <input
                            type="text"
                            placeholder="Enter custom mode"
                            value={customMode}
                            onChange={(e) => setCustomMode(e.target.value)}
                            tabIndex={3}
                            className={cn(
                              "w-full h-[52px] px-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all",
                              theme === 'dark' ? "bg-slate-800 border-indigo-900/30 text-white" : "bg-slate-50 border-indigo-100 text-black"
                            )}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Details</label>
                    <textarea
                      ref={descriptionInputRef}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Enter transaction details"
                      rows={2}
                      tabIndex={4}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium resize-none transition-colors duration-300",
                        theme === 'dark' ? "bg-slate-800 text-white" : "bg-slate-50 text-black"
                      )}
                    />
                  </div>

                  {/* Image Layout Selection */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Image Layout in PDF</label>
                    <div className={cn(
                      "p-1 rounded-xl flex gap-1 transition-colors duration-300",
                      theme === 'dark' ? "bg-slate-800" : "bg-slate-100"
                    )}>
                      <button
                        type="button"
                        disabled={selectedImages.length < 2}
                        onClick={() => setImageLayout('merge')}
                        className={cn(
                          "flex-1 py-2 rounded-lg font-bold transition-all text-[10px] flex items-center justify-center gap-2",
                          selectedImages.length < 2
                            ? "opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-500 bg-slate-100/30 dark:bg-slate-800/20"
                            : imageLayout === 'merge' 
                              ? (theme === 'dark' ? "bg-slate-700 text-indigo-400 shadow-sm" : "bg-white text-indigo-600 shadow-sm")
                              : (theme === 'dark' ? "text-slate-400 hover:bg-slate-700/50" : "text-slate-500 hover:bg-slate-200/50")
                        )}
                        title={selectedImages.length < 2 ? "Upload at least 2 images to enable MERGE layout" : ""}
                      >
                        <LayoutGrid size={14} />
                        MERGE (Side by Side)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageLayout('split')}
                        className={cn(
                          "flex-1 py-2 rounded-lg font-bold transition-all text-[10px] flex items-center justify-center gap-2",
                          imageLayout === 'split' 
                            ? (theme === 'dark' ? "bg-slate-700 text-indigo-400 shadow-sm" : "bg-white text-indigo-600 shadow-sm")
                            : (theme === 'dark' ? "text-slate-400 hover:bg-slate-700/50" : "text-slate-500 hover:bg-slate-200/50")
                        )}
                      >
                        <List size={14} />
                        SPLIT (Page by Page)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bills / Attachments (Max 5)</label>
                    <div className="space-y-3">
                      {selectedImages.length > 0 && (
                        <div className="space-y-4">
                          {/* Merge Preview if selected */}
                          {imageLayout === 'merge' && selectedImages.length > 1 && (
                            <div className={cn(
                              "p-3 rounded-2xl border border-dashed transition-colors duration-300",
                              theme === 'dark' ? "bg-indigo-950/20 border-indigo-900/50" : "bg-indigo-50/50 border-indigo-200"
                            )}>
                              <p className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-1">
                                <Sparkles size={10} />
                                PDF MERGE PREVIEW
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {selectedImages.map((img, i) => (
                                  <div key={i} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                    <OptimizedImage src={img} alt="preview" className="w-full h-full object-cover" type="preview" />
                                    <div className="absolute bottom-1 right-1 bg-black/50 text-[6px] text-white px-1 rounded">P.{Math.floor(i/2) + 1}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-3">
                            {selectedImages.map((img, i) => (
                              <div key={i} className="relative group w-20 h-20 sm:w-24 sm:h-24">
                                <div 
                                  onClick={() => setSelectedFormatIndex(i)}
                                  className={cn(
                                    "w-full h-full rounded-xl overflow-hidden border cursor-pointer transition-all duration-300 relative bg-slate-100 dark:bg-zinc-800",
                                    selectedFormatIndex === i 
                                      ? "border-emerald-500 ring-4 ring-emerald-500/20" 
                                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                  )}
                                >
                                  <OptimizedImage 
                                    src={img} 
                                    alt="preview" 
                                    type="preview"
                                    className="w-full h-full object-cover" 
                                  />
                                </div>
                                
                                {/* Reorder Controls - Always Visible on Hover, but semi-visible always */}
                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-0.5 pointer-events-none">
                                  <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); moveImage(i, 'up'); }}
                                    disabled={i === 0}
                                    className={cn(
                                      "p-0.5 bg-black/60 hover:bg-black/90 text-white rounded-full transition-all pointer-events-auto",
                                      i === 0 ? "opacity-0" : "opacity-60 group-hover:opacity-100"
                                    )}
                                  >
                                    <ChevronLeft size={12} />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); moveImage(i, 'down'); }}
                                    disabled={i === selectedImages.length - 1}
                                    className={cn(
                                      "p-0.5 bg-black/60 hover:bg-black/90 text-white rounded-full transition-all pointer-events-auto",
                                      i === selectedImages.length - 1 ? "opacity-0" : "opacity-60 group-hover:opacity-100"
                                    )}
                                  >
                                    <ChevronRight size={12} />
                                  </button>
                                </div>

                                <button 
                                  type="button"
                                  onClick={() => {
                                    removeImage(i);
                                    if (selectedFormatIndex >= selectedImages.length - 1) {
                                      setSelectedFormatIndex(Math.max(0, selectedImages.length - 2));
                                    }
                                  }}
                                  className={cn(
                                    "absolute -top-1.5 -right-1.5 p-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-full transition-all z-20 shadow-md border border-white dark:border-zinc-900 flex items-center justify-center cursor-pointer"
                                  )}
                                  title="Remove image"
                                >
                                  <X size={10} className="stroke-[3]" />
                                </button>
                                
                                <div className="absolute bottom-1 right-1 bg-black/50 text-[8px] text-white px-1.5 rounded-full">
                                  {i + 1}
                                </div>
                              </div>
                            ))}
                            {selectedImages.length < 5 && (
                              <button 
                                type="button"
                                onClick={() => triggerUploadSelector('transaction')}
                                className={cn(
                                  "w-20 h-20 sm:w-24 sm:h-24 flex flex-col items-center justify-center border-2 border-dashed rounded-xl text-slate-400 hover:border-emerald-500 hover:text-emerald-500 transition-all gap-1",
                                  theme === 'dark' ? "border-slate-800 bg-zinc-900/40" : "border-slate-200 bg-slate-50/50"
                                )}
                              >
                                <Plus size={20} />
                                <span className="text-[8px] font-black uppercase tracking-wider">Add</span>
                              </button>
                            )}
                          </div>

                          {/* Formatting Panel for Selected Image */}
                          {selectedImages[selectedFormatIndex] && (
                            (() => {
                              return (
                                <div className={cn(
                                  "p-4 rounded-xl border border-slate-100 dark:border-zinc-800 flex items-center justify-between",
                                  theme === 'dark' ? "bg-zinc-900/40" : "bg-slate-50/50"
                                )}>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                                      Attachment #{selectedFormatIndex + 1} Selected
                                    </span>
                                  </div>

                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      disabled={isEditingLoading}
                                      onClick={handleReeditImage}
                                      className="py-1.5 px-3 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-400 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                                    >
                                      {isEditingLoading ? (
                                        <Loader2 size={12} className="animate-spin" />
                                      ) : (
                                        <Crop size={12} />
                                      )}
                                      Edit Image
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleOpenPreview(selectedImages);
                                        setPreviewIndex(selectedFormatIndex);
                                        setPreviewRotation(0);
                                        setPreviewZoom(1);
                                      }}
                                      className="py-1.5 px-3 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-400 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                                    >
                                      <ZoomIn size={12} />
                                      View Fullscreen
                                    </button>
                                  </div>
                                </div>
                              );
                            })()
                          )}
                        </div>
                      )}
                      
                      {selectedImages.length === 0 && (
                        <div 
                          tabIndex={5}
                          onClick={() => triggerUploadSelector('transaction')}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerUploadSelector('transaction'); } }}
                          className={cn(
                            "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:border-indigo-300 transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-indigo-500",
                            theme === 'dark' ? "border-slate-800 hover:border-indigo-500" : "border-slate-200"
                          )}
                        >
                          <div className={cn(
                            "p-2 rounded-full text-slate-400 group-hover:text-indigo-500 transition-colors",
                            theme === 'dark' ? "bg-slate-800" : "bg-slate-50"
                          )}>
                            <Upload size={24} />
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-500 transition-colors">
                            Click to upload bills (Max 5)
                          </p>
                        </div>
                      )}
                      <input 
                        type="file"
                        multiple
                        accept="image/*"
                        ref={multiFileInputRef}
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      tabIndex={7}
                      disabled={isSubmitting}
                      onClick={resetForm}
                      className="flex-1 py-3 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      tabIndex={6}
                      disabled={isSubmitting}
                      onClick={() => { vibrate(30); setSubmitAndAddNew(false); }}
                      className={cn(
                        "flex-1 py-3 rounded-xl font-bold text-white transition-all active:scale-95 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed",
                        isSubmitting ? "bg-slate-400" : (
                          showForm === 'in' 
                            ? (theme === 'dark' ? "bg-emerald-600 hover:bg-emerald-700 shadow-none" : "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100")
                            : (theme === 'dark' ? "bg-rose-600 hover:bg-rose-700 shadow-none" : "bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-100")
                        )
                      )}
                    >
                      {isSubmitting ? "Saving..." : (editingTransaction ? 'Save Changes' : 'Save')}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Processing Overlay */}
      <AnimatePresence mode="wait">
        {isUploading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-indigo-600 text-white"
          >
            <div className="text-center space-y-6 px-6">
              <div className="relative flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full"
                />
              </div>
              <div className="space-y-2">
                <AnimatePresence mode="wait">
                  <motion.h3 
                    key={uploadingMessage}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-2xl font-bold tracking-tight"
                  >
                    {uploadingMessage}
                  </motion.h3>
                </AnimatePresence>
                <p className="text-indigo-100/80 text-sm max-w-[280px] mx-auto">
                  AI is reading your receipt and extracting details
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Transaction Saving/Updating Modal */}
      <AnimatePresence>
        {progressModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={cn(
                "relative w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center overflow-hidden border transition-all duration-300",
                theme === 'dark' 
                  ? "bg-zinc-950/90 border-slate-800/80" 
                  : "bg-white border-slate-200"
              )}
            >
              {/* Star-sparkle glow background effect */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Success, Loading, or Error Circular Header */}
              <div className="relative w-24 h-24 flex items-center justify-center mt-2">
                {/* Outer Circular loader svg */}
                <svg className="w-full h-full transform -rotate-90 absolute">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    strokeWidth="4"
                    stroke="currentColor"
                    fill="transparent"
                    className={cn(
                      theme === 'dark' ? "text-slate-800/40" : "text-slate-200"
                    )}
                  />
                  <motion.circle
                    cx="48"
                    cy="48"
                    r="40"
                    strokeWidth="4"
                    stroke="currentColor"
                    fill="transparent"
                    strokeDasharray={251.2}
                    initial={{ strokeDashoffset: 251.2 }}
                    animate={{ strokeDashoffset: 251.2 - (251.2 * progressModal.progress) / 100 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className={cn(
                      progressModal.errorMsg ? "text-rose-500" : progressModal.success ? "text-emerald-400" : "text-indigo-500"
                    )}
                  />
                </svg>

                {/* Inner Icon */}
                <div className="relative z-10 flex items-center justify-center">
                  {progressModal.success ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400"
                    >
                      <Check size={24} className="stroke-[3]" />
                    </motion.div>
                  ) : progressModal.errorMsg ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-400/30 flex items-center justify-center text-rose-400"
                    >
                      <AlertCircle size={24} />
                    </motion.div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 relative">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 border-2 border-indigo-400/10 border-t-indigo-400/50 rounded-full"
                      />
                      <Sparkles size={20} className="animate-pulse" />
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Percentage Text */}
              <div className="mt-4 flex flex-col items-center">
                <span className={cn(
                  "text-3xl font-black font-mono tracking-tight",
                  progressModal.errorMsg ? "text-rose-400" : progressModal.success ? "text-emerald-400" : (theme === 'dark' ? "text-white" : "text-slate-900")
                )}>
                  {progressModal.progress}%
                </span>
                
                {/* Horizontal Progress bar */}
                <div className={cn(
                  "w-56 h-1.5 rounded-full overflow-hidden mt-3 border transition-all",
                  theme === 'dark' ? "bg-slate-900 border-slate-800/40" : "bg-slate-100 border-slate-200"
                )}>
                  <motion.div 
                    className={cn(
                      "h-full rounded-full",
                      progressModal.errorMsg ? "bg-rose-500" : progressModal.success ? "bg-emerald-400" : "bg-gradient-to-r from-indigo-500 to-indigo-400"
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressModal.progress}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Titles and Subtitles */}
              <div className="mt-6 space-y-2 px-2">
                <h3 className={cn(
                  "text-lg font-black tracking-tight",
                  theme === 'dark' ? "text-white" : "text-slate-900"
                )}>
                  {progressModal.success ? (
                    progressModal.type === 'create' ? "✓ Entry saved successfully" : "✓ Entry updated successfully"
                  ) : progressModal.errorMsg ? (
                    "Couldn't save your entry"
                  ) : (
                    progressModal.type === 'create' ? "Saving your entry..." : "Updating your entry..."
                  )}
                </h3>
                
                <p className={cn(
                  "text-xs leading-relaxed font-medium",
                  theme === 'dark' ? "text-slate-400" : "text-slate-600"
                )}>
                  {progressModal.success ? (
                    "Your secure ledger has been successfully updated."
                  ) : progressModal.errorMsg ? (
                    "Couldn't save your entry. Please check your connection and retry."
                  ) : (
                    progressModal.type === 'create' 
                      ? (selectedImages.some(img => img.startsWith('blob:')) 
                          ? "Your receipt is being securely uploaded to TrackBook Cloud." 
                          : "Saving your transaction ledger entry securely.")
                      : "Saving your latest changes securely."
                  )}
                </p>
              </div>

              {/* Steps Timeline checklist */}
              <div className={cn(
                "mt-8 w-full max-w-[280px] rounded-2xl p-4 text-left space-y-3.5 border transition-all duration-300",
                theme === 'dark' 
                  ? "bg-slate-900/40 border-slate-800/40" 
                  : "bg-slate-50 border-slate-150"
              )}>
                {progressModal.steps.map((step, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs font-bold tracking-tight">
                    <span className={cn(
                      "transition-colors duration-200 font-sans",
                      step.status === 'success' ? (theme === 'dark' ? "text-emerald-400" : "text-emerald-600") :
                      step.status === 'loading' ? (theme === 'dark' ? "text-white" : "text-slate-900") :
                      step.status === 'error' ? (theme === 'dark' ? "text-rose-400" : "text-rose-600") : 
                      (theme === 'dark' ? "text-slate-500" : "text-slate-400")
                    )}>
                      {step.label}
                    </span>
                    
                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                      {step.status === 'success' && (
                        <span className={cn(
                          "flex items-center gap-1",
                          theme === 'dark' ? "text-emerald-400" : "text-emerald-600"
                        )}>
                          <Check size={12} className="stroke-[3]" />
                          <span>Done</span>
                        </span>
                      )}
                      {step.status === 'loading' && (
                        <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 animate-pulse">
                          <Loader2 size={11} className="animate-spin" />
                          <span>Active</span>
                        </span>
                      )}
                      {step.status === 'pending' && (
                        <span className={cn(
                          theme === 'dark' ? "text-slate-600" : "text-slate-400"
                        )}>Waiting</span>
                      )}
                      {step.status === 'error' && (
                        <span className="text-rose-600 dark:text-rose-500 font-black">Failed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Error Actions */}
              {progressModal.errorMsg && (
                <div className="mt-8 flex gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      vibrate(30);
                      saveTransaction();
                    }}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black tracking-widest uppercase cursor-pointer transition-all active:scale-95 shadow-lg shadow-indigo-600/10"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      vibrate(20);
                      setProgressModal(null);
                    }}
                    className="flex-1 py-3 border border-slate-800 hover:bg-slate-900 text-slate-300 rounded-xl text-xs font-black tracking-widest uppercase cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Gallery Preview Modal */}
      <AnimatePresence>
        {previewImages && (
          <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-xl flex flex-col">
            {/* Gallery Header */}
            <div className="flex items-center justify-between p-4 text-white">
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleClosePreview}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                >
                  <X size={24} />
                </button>
                <div>
                  <p className="font-bold">Attachment Preview</p>
                  <div className="flex flex-col text-xs text-slate-400 gap-0.5 mt-0.5">
                    <p>{previewIndex + 1} of {previewImages.length}</p>
                    {(() => {
                      const activePreviewTx = activeBook?.transactions.find(tx => tx.id === previewTransactionId);
                      const activeAttDetail = activePreviewTx?.attachment_details?.find(att => att.file_url === previewImages[previewIndex]) || activePreviewTx?.attachment_details?.[previewIndex];
                      if (!activeAttDetail) return null;
                      return (
                        <div className="flex flex-col gap-0.5 mt-1 border-t border-white/10 pt-1">
                          {(activeAttDetail.created_at || activePreviewTx?.created_at) && (
                            <p className="flex items-center gap-1 text-slate-350">
                              <Clock size={10} className="text-indigo-400 shrink-0" />
                              <span>Uploaded: <strong>{formatDateTime12h(activeAttDetail.created_at || activePreviewTx?.created_at)}</strong></span>
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setPreviewZoom(prev => Math.max(0.5, prev - 0.25))}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                  title="Zoom Out"
                  disabled={previewValidationStatus[previewIndex] === false}
                >
                  <ZoomOut size={20} />
                </button>
                <button 
                  onClick={() => setPreviewZoom(prev => Math.min(3, prev + 0.25))}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                  title="Zoom In"
                  disabled={previewValidationStatus[previewIndex] === false}
                >
                  <ZoomIn size={20} />
                </button>
                <button 
                  onClick={handleDownloadAttachment}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-white"
                  title="Download Original"
                >
                  <Download size={20} />
                </button>
              </div>
            </div>

            {/* Main Preview Area */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
              {isPreviewValidating && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm text-white">
                  <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-sm font-bold animate-pulse text-indigo-300">Validating Receipt Accessibility...</p>
                </div>
              )}

              {!isPreviewValidating && previewValidationStatus[previewIndex] === false ? (
                <div className="flex flex-col items-center justify-center p-8 max-w-md bg-zinc-900/90 border border-zinc-800 rounded-2xl text-center shadow-2xl mx-4 relative z-10">
                  <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mb-6 border border-rose-500/20">
                    <CloudOff size={32} />
                  </div>
                  <h3 className="text-lg font-black text-slate-100 mb-2">This receipt couldn't be previewed.</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-6">
                    The receipt attachment could not be accessed. This can happen if the image is private, storage is unavailable, or you are offline.
                  </p>
                  <div className="flex items-center gap-3 w-full">
                    <button
                      onClick={() => handleRetryPreview(previewIndex)}
                      className="flex-1 py-3 px-4 rounded-xl bg-indigo-650 hover:bg-indigo-600 active:scale-95 text-xs font-bold text-white transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <RotateCw size={14} />
                      <span>Retry</span>
                    </button>
                    <button
                      onClick={() => handleOpenOriginal(previewIndex)}
                      className="flex-1 py-3 px-4 rounded-xl bg-zinc-850 hover:bg-zinc-850 text-slate-200 border border-zinc-700 active:scale-95 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Download size={14} />
                      <span>Open Original</span>
                    </button>
                  </div>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={previewIndex}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ 
                      opacity: 1, 
                      scale: previewZoom,
                      rotate: previewRotation
                    }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="relative max-w-full max-h-full p-4"
                  >
                    <OptimizedImage 
                      src={previewImages[previewIndex]} 
                      alt="preview" 
                      type="fullscreen"
                      className="max-w-full max-h-[80vh] object-contain shadow-2xl rounded-lg"
                      referrerPolicy="no-referrer"
                    />
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Navigation Arrows */}
              {previewImages.length > 1 && (
                <>
                  <button 
                    onClick={() => {
                      setPreviewIndex(prev => (prev - 1 + previewImages.length) % previewImages.length);
                      setPreviewRotation(0);
                      setPreviewZoom(1);
                    }}
                    className="absolute left-4 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white backdrop-blur-md transition-all cursor-pointer"
                  >
                    <ChevronLeft size={32} />
                  </button>
                  <button 
                    onClick={() => {
                      setPreviewIndex(prev => (prev + 1) % previewImages.length);
                      setPreviewRotation(0);
                      setPreviewZoom(1);
                    }}
                    className="absolute right-4 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white backdrop-blur-md transition-all cursor-pointer"
                  >
                    <ChevronRight size={32} />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails Strip */}
            {previewImages.length > 1 && (
              <div className="p-6 flex justify-center gap-2 overflow-x-auto no-scrollbar">
                {previewImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setPreviewIndex(i);
                      setPreviewRotation(0);
                      setPreviewZoom(1);
                    }}
                    className={cn(
                      "w-16 h-16 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer",
                      previewIndex === i 
                        ? (theme === 'dark' ? "border-indigo-500 scale-110 shadow-none" : "border-indigo-500 scale-110 shadow-lg shadow-indigo-500/20") 
                        : "border-transparent opacity-50 hover:opacity-100"
                    )}
                  >
                    <OptimizedImage src={img} alt="thumb" className="w-full h-full object-cover" type="preview" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </AnimatePresence>
      {/* Report Generation Overlay */}
      <AnimatePresence>
        {reportLoading && (
          <div className={cn(
            "fixed inset-0 z-[300] flex items-center justify-center backdrop-blur-xl transition-colors duration-300",
            theme === 'dark' ? "bg-slate-950/80" : "bg-slate-900/60"
          )}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className={cn(
                "rounded-3xl shadow-2xl p-6 sm:p-8 max-w-sm w-full mx-4 border flex flex-col items-center text-center",
                theme === 'dark' ? "bg-zinc-950 border-zinc-900 shadow-black/80" : "bg-white border-slate-100 shadow-slate-200/50"
              )}
            >
              {/* Animated 3D-style Spreadsheet Graphic (for Excel) */}
              {reportLoading.type === 'excel' && (
                <div className="w-48 h-36 relative flex items-center justify-center mb-2 overflow-hidden">
                  <motion.div 
                    initial={{ rotateX: 12, rotateY: -12, scale: 0.85 }}
                    animate={{ rotateX: [12, 8, 12], rotateY: [-12, -16, -12], scale: [0.85, 0.88, 0.85] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    style={{ transformStyle: "preserve-3d" }}
                    className="w-36 h-26 bg-emerald-950/20 border-2 border-emerald-500/30 rounded-2xl relative p-3 shadow-2xl shadow-emerald-500/5 flex flex-col justify-between overflow-hidden"
                  >
                    {/* Shiny/glow effect scanning across sheet */}
                    <motion.div 
                      initial={{ left: "-150%" }}
                      animate={{ left: "150%" }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent -skew-x-12 z-10"
                    />

                    {/* Spreadsheet headers */}
                    <div className="grid grid-cols-4 gap-1.5 border-b border-emerald-500/20 pb-2">
                      <div className="h-1.5 rounded bg-emerald-500/40 col-span-1" />
                      <div className="h-1.5 rounded bg-emerald-500/20 col-span-2" />
                      <div className="h-1.5 rounded bg-emerald-500/30 col-span-1" />
                    </div>

                    {/* Spreadsheet Rows flying/entering */}
                    <div className="flex-1 flex flex-col justify-center gap-2 pt-2">
                      {[
                        { delay: 0, width: "w-24", color: "bg-emerald-500/40" },
                        { delay: 0.2, width: "w-16", color: "bg-emerald-500/25" },
                        { delay: 0.4, width: "w-20", color: "bg-emerald-400/30" }
                      ].map((row, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ x: -45, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{
                            delay: row.delay,
                            duration: 0.8,
                            repeat: Infinity,
                            repeatDelay: 1,
                            ease: "easeOut"
                          }}
                          className={`h-2 rounded-full ${row.color} ${row.width}`}
                        />
                      ))}
                    </div>

                    {/* 3D floating Excel tag */}
                    <motion.div
                      animate={{ y: [-1, 2, -1], rotate: [0, 4, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute -right-1 -bottom-1 w-9 h-9 bg-emerald-600 text-white rounded-xl shadow-lg flex items-center justify-center border border-emerald-400/20 z-20"
                    >
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                        <path d="M10 3v18M4 10h17" />
                      </svg>
                    </motion.div>
                  </motion.div>
                </div>
              )}

              {/* Animated 3D-style Document Stack Graphic (for PDF) */}
              {reportLoading.type === 'pdf' && (
                <div className="w-48 h-36 relative flex items-center justify-center mb-2 overflow-hidden">
                  <div style={{ perspective: "800px" }} className="relative w-36 h-26">
                    {/* Page 3 (Deepest) */}
                    <motion.div 
                      animate={{ rotate: [-6, -4, -6], y: [1, 0, 1] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-0 bg-indigo-950/5 border border-indigo-500/10 rounded-2xl transform translate-x-2 -translate-y-2 select-none pointer-events-none"
                    />
                    {/* Page 2 (Middle) */}
                    <motion.div 
                      animate={{ rotate: [-3, -1, -3], y: [-1, 0, -1] }}
                      transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-0 bg-indigo-950/10 border border-indigo-500/20 rounded-2xl transform translate-x-1 -translate-y-1 select-none pointer-events-none"
                    />
                    {/* Page 1 (Top Active Page) */}
                    <motion.div 
                      initial={{ rotate: 0, scale: 0.95 }}
                      animate={{ rotate: [0, 1, 0], scale: [0.95, 0.97, 0.95] }}
                      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-0 bg-indigo-950/15 border border-indigo-500/30 rounded-2xl p-2.5 flex flex-col gap-1.5 overflow-hidden shadow-2xl"
                    >
                      {/* Scan gradient sweep */}
                      <motion.div 
                        initial={{ top: "-150%" }}
                        animate={{ top: "150%" }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-indigo-400/15 to-transparent -skew-y-3 z-10"
                      />

                      {/* Header layout */}
                      <div className="flex gap-1.5 items-center">
                        <div className="w-2.5 h-2.5 rounded bg-indigo-500/40 flex-shrink-0" />
                        <div className="w-16 h-1.5 rounded bg-indigo-500/20" />
                      </div>

                      {/* Moving entries landing inside */}
                      <div className="flex flex-col gap-1.5 mt-1">
                        {[
                          { delay: 0, iconColor: "bg-emerald-500/30", textWidth: "w-20" },
                          { delay: 0.25, iconColor: "bg-rose-500/30", textWidth: "w-24" },
                          { delay: 0.5, iconColor: "bg-indigo-500/30", textWidth: "w-14" }
                        ].map((item, idx) => (
                          <motion.div 
                            key={idx}
                            initial={{ y: -20, opacity: 0, scale: 0.85 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            transition={{
                              delay: item.delay,
                              duration: 0.5,
                              repeat: Infinity,
                              repeatDelay: 1,
                              type: "spring",
                              stiffness: 90
                            }}
                            className="flex gap-1.5 items-center"
                          >
                            <div className={`w-2 h-2 rounded-full ${item.iconColor}`} />
                            <div className={`h-1 rounded ${item.textWidth} bg-indigo-300/15`} />
                          </motion.div>
                        ))}
                      </div>

                      {/* Photo attachments simulation in document bottom */}
                      <div className="absolute right-2.5 bottom-2.5 flex gap-1 items-end">
                        <div className="w-4 h-4 rounded border border-dashed border-indigo-500/30 bg-indigo-500/5 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-indigo-400/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="M21 15l-5-5L5 21" />
                          </svg>
                        </div>
                        <div className="w-8 h-1 rounded bg-indigo-500/20" />
                      </div>
                    </motion.div>

                    {/* Floating PDF badge */}
                    <motion.div
                      animate={{ y: [-1, 2, -1], rotate: [0, -4, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute -right-2 -bottom-2 w-9 h-9 bg-indigo-600 text-white rounded-xl shadow-lg flex items-center justify-center border border-indigo-400/20 z-20"
                    >
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </motion.div>
                  </div>
                </div>
              )}

              {/* Progress Dial Widget */}
              <div className="relative inline-block mt-4">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="transparent"
                    className={theme === 'dark' ? "text-zinc-800" : "text-slate-150"}
                  />
                  <motion.circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={251.2}
                    initial={{ strokeDashoffset: 251.2 }}
                    animate={{ strokeDashoffset: 251.2 - (251.2 * reportLoading.progress) / 100 }}
                    className={reportLoading.type === 'excel' ? "text-emerald-500" : "text-indigo-500"}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={cn(
                    "text-xl font-black transition-colors duration-300",
                    theme === 'dark' ? "text-white" : "text-slate-900"
                  )}>{reportLoading.progress}%</span>
                </div>
              </div>

              {/* Dynamic Status Display details */}
              <div className="space-y-1.5 mt-4">
                <h3 className={cn(
                  "text-lg font-black transition-colors duration-300 tracking-tight",
                  theme === 'dark' ? "text-white" : "text-slate-900"
                )}>
                  {reportLoading.type === 'excel' ? (
                    reportLoading.progress <= 30 ? "Preparing entries..." : 
                    reportLoading.progress <= 75 ? "Generating Excel sheet..." : 
                    "Exporting file..."
                  ) : (
                    reportLoading.progress <= 30 ? "Preparing report pages..." : 
                    reportLoading.progress <= 60 ? "Rendering PDF..." : 
                    reportLoading.progress <= 90 ? "Adding entries into document..." : 
                    "Almost ready..."
                  )}
                </h3>
                <p className={cn(
                  "text-xs font-semibold px-4 transition-colors duration-300 max-w-xs leading-relaxed",
                  theme === 'dark' ? "text-zinc-400" : "text-slate-500"
                )}>
                  Please keep this page open. We are constructing your beautiful report dynamically.
                </p>
                {reportLoading.message && (
                  <p className="text-xs font-mono font-black text-rose-500 dark:text-rose-400 mt-2 px-4 select-none">
                    {reportLoading.message}
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Help & Support Dialog */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border transition-colors duration-300",
                theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
              )}
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-indigo-600 text-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <HelpCircle size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight">Help & Support</h3>
                    <p className="text-xs text-indigo-100 font-medium uppercase tracking-widest">AI Assistant</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setIsHelpOpen(false); setHelpQuery(''); setHelpResponse(''); }}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="space-y-4">
                  <label className={cn(
                    "text-sm font-black uppercase tracking-widest transition-colors duration-300",
                    theme === 'dark' ? "text-slate-500" : "text-black"
                  )}>Ask anything about the app</label>
                  <div className="relative">
                    <textarea
                      value={helpQuery}
                      onChange={(e) => setHelpQuery(e.target.value)}
                      placeholder="How do I add a transaction? How to export reports?"
                      className={cn(
                        "w-full border-2 rounded-2xl p-4 outline-none focus:border-indigo-500 transition-all resize-none h-32",
                        theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-slate-50 border-slate-100 text-black"
                      )}
                    />
                    <button
                      onClick={() => { vibrate(); setAiConstructionModal('ask'); }}
                      className="absolute bottom-3 right-3 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none"
                    >
                      <MessageSquare size={18} />
                      Ask AI
                    </button>
                  </div>
                </div>

                {helpResponse && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-800/50"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">AI Response</span>
                    </div>
                    <div className={cn(
                      "text-sm leading-relaxed prose prose-slate dark:prose-invert max-w-none transition-colors duration-300",
                      theme === 'dark' ? "text-slate-300" : "text-black"
                    )}>
                      <ReactMarkdown>{helpResponse}</ReactMarkdown>
                    </div>
                  </motion.div>
                )}

                <div className={cn(
                  "p-4 rounded-2xl border transition-colors duration-300 flex items-center justify-between gap-3 text-left-side",
                  theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-100"
                )}>
                  <div>
                    <h4 className={cn("text-xs font-black uppercase tracking-wider", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>
                      AI Engine Configuration
                    </h4>
                    <p className="text-[10px] text-emerald-500 dark:text-emerald-400 mt-0.5 font-bold">
                      ● Active & Integrated
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                  <p className="text-slate-400 text-xs font-medium mb-2">Need more help?</p>
                  <a 
                    href="mailto:triptraccker@gmail.com"
                    className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black hover:underline transition-all"
                  >
                    mail to triptraccker@gmail.com
                    <ArrowRight size={14} />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSubmitting && (
          <div className={cn(
            "fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-md transition-colors duration-300",
            theme === 'dark' ? "bg-black/80" : "bg-slate-900/40"
          )}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "rounded-3xl p-8 shadow-2xl text-center space-y-6 max-w-xs w-full border transition-colors duration-300",
                theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-100"
              )}
            >
              <div className="relative w-20 h-20 mx-auto">
                <div className={cn(
                  "absolute inset-0 border-4 rounded-full transition-colors duration-300",
                  theme === 'dark' ? "border-indigo-900/30" : "border-indigo-100"
                )} />
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="text-indigo-600 animate-pulse" size={32} />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className={cn(
                  "text-xl font-black transition-colors duration-300",
                  theme === 'dark' ? "text-white" : "text-black"
                )}>{submitAndAddNew ? "Your entry is being saved..." : (submittingMessage || "Saving your entry...")}</h3>
                <p className={cn(
                  "text-sm font-medium transition-colors duration-300",
                  theme === 'dark' ? "text-slate-400" : "text-slate-600"
                )}>Please wait a moment...</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* Bulk Transaction Delete Confirmation Modal */}
      <AnimatePresence>
        {showBulkTransactionDeleteConfirm && (
          <div className={cn(
            "fixed inset-0 z-[150] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300 overflow-y-auto",
            theme === 'dark' ? "bg-black/60" : "bg-slate-900/40"
          )}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center space-y-4 transition-colors duration-300",
                theme === 'dark' ? "bg-zinc-950" : "bg-white"
              )}
            >
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className={cn(
                  "text-xl font-bold transition-colors duration-300",
                  theme === 'dark' ? "text-white" : "text-black"
                )}>Delete Selected Entries?</h3>
                <p className={cn(
                  "text-sm transition-colors duration-300",
                  theme === 'dark' ? "text-slate-400" : "text-black"
                )}>
                  Are you sure you want to delete <span className="font-bold text-rose-600">{selectedTransactions.size}</span> entries? This action cannot be undone.
                </p>
                <div className="pt-2 text-left flex justify-center">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs select-none">
                    <input 
                      type="checkbox" 
                      checked={deleteConfirmed} 
                      onChange={(e) => setDeleteConfirmed(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-800 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-slate-500 dark:text-slate-400 font-bold">I confirm this deletion</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => { setShowBulkTransactionDeleteConfirm(false); }}
                  className={cn(
                    "flex-1 py-3 border rounded-xl font-bold transition-all cursor-pointer",
                    theme === 'dark' ? "border-slate-800 text-slate-400 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBulkDelete}
                  disabled={!deleteConfirmed}
                  className={cn(
                    "flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-lg shadow-rose-100 dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  )}
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Merge Transactions Confirmation Modal */}
      <AnimatePresence>
        {showMergeConfirmDialog && (
          <div className={cn(
            "fixed inset-0 z-[150] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300 overflow-y-auto",
            theme === 'dark' ? "bg-black/60" : "bg-slate-900/40"
          )}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 transition-colors duration-300",
                theme === 'dark' ? "bg-zinc-950 text-white" : "bg-white text-black"
              )}
            >
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center">
                <Merge size={24} />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-lg font-extrabold tracking-tight">Merge Selected Entries?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Merge <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedTransactions.size}</span> selected transactions into a single new transaction.
                </p>
              </div>

              <div className="space-y-3.5 pt-1">
                {/* Description Input */}
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Description</label>
                  <input
                    type="text"
                    value={mergeDescription}
                    onChange={(e) => setMergeDescription(e.target.value)}
                    placeholder="Enter merged description"
                    className={cn(
                      "w-full px-4.5 h-11 border-2 rounded-xl outline-none focus:border-indigo-500 transition-all text-sm font-semibold",
                      theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-slate-50 border-slate-100 text-black"
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Category Select */}
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Category</label>
                    <select
                      value={mergeCategory}
                      onChange={(e) => setMergeCategory(e.target.value)}
                      className={cn(
                        "w-full px-4 h-11 border-2 rounded-xl outline-none focus:border-indigo-500 transition-all text-sm font-semibold appearance-none bg-no-repeat bg-[right_12px_center]",
                        theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-slate-50 border-slate-100 text-black"
                      )}
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Transaction Type Select */}
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</label>
                    <select
                      value={mergeType}
                      onChange={(e) => setMergeType(e.target.value as any)}
                      className={cn(
                        "w-full px-4 h-11 border-2 rounded-xl outline-none focus:border-indigo-500 transition-all text-sm font-semibold appearance-none bg-no-repeat bg-[right_12px_center]",
                        theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-slate-50 border-slate-100 text-black"
                      )}
                    >
                      <option value="out">Cash Out (-)</option>
                      <option value="in">Cash In (+)</option>
                    </select>
                  </div>
                </div>

                {/* Total Merged Amount Preview */}
                <div className={cn(
                  "p-3.5 rounded-xl flex items-center justify-between border border-dashed transition-colors duration-300",
                  theme === 'dark' ? "bg-zinc-900/40 border-zinc-800" : "bg-slate-50/50 border-slate-200"
                )}>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Merged Total Amount:</span>
                  <span className={cn(
                    "text-base font-black font-mono",
                    mergeType === 'in' ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-450"
                  )}>
                    {mergeType === 'in' ? '+' : '-'}{formatCurrency(
                      books.find(b => b.id === activeBookId)
                        ?.transactions.filter(t => selectedTransactions.has(t.id))
                        .reduce((sum, t) => sum + t.amount, 0) || 0
                    )}
                  </span>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-955/20 border border-rose-200/50 text-rose-650 dark:text-rose-400 text-xs font-semibold text-left">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowMergeConfirmDialog(false)}
                  disabled={isMerging}
                  className={cn(
                    "flex-1 py-3 border rounded-xl font-bold transition-all cursor-pointer text-sm disabled:opacity-50",
                    theme === 'dark' ? "border-slate-800 text-slate-400 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleMergeTransactions}
                  disabled={isMerging}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-650/50 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 dark:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2 text-sm disabled:cursor-not-allowed"
                >
                  {isMerging ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Merging...
                    </>
                  ) : (
                    'Confirm Merge'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Delete Confirmation Modal */}
      <AnimatePresence>
        {showBulkDeleteConfirm && (
          <div className={cn(
            "fixed inset-0 z-[150] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300 overflow-y-auto",
            theme === 'dark' ? "bg-black/60" : "bg-slate-900/40"
          )}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center space-y-4 transition-colors duration-300",
                theme === 'dark' ? "bg-zinc-950" : "bg-white"
              )}
            >
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className={cn(
                  "text-xl font-bold transition-colors duration-300",
                  theme === 'dark' ? "text-white" : "text-black"
                )}>Delete Selected Books?</h3>
                <p className={cn(
                  "text-sm transition-colors duration-300",
                  theme === 'dark' ? "text-slate-400" : "text-black"
                )}>
                  Are you sure you want to delete <span className="font-bold text-rose-600">{selectedBooks.size}</span> cashbooks? This action cannot be undone.
                </p>
                <div className="pt-2 text-left flex justify-center">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs select-none">
                    <input 
                      type="checkbox" 
                      checked={deleteConfirmed} 
                      onChange={(e) => setDeleteConfirmed(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-800 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-slate-500 dark:text-slate-400 font-bold">I confirm this deletion</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => { setShowBulkDeleteConfirm(false); }}
                  className={cn(
                    "flex-1 py-3 border rounded-xl font-bold transition-all cursor-pointer",
                    theme === 'dark' ? "border-slate-800 text-slate-400 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBulkDeleteBooks}
                  disabled={!deleteConfirmed}
                  className={cn(
                    "flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-lg shadow-rose-100 dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  )}
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Exit App Confirmation Modal */}
      <AnimatePresence>
        {showExitConfirm && (
          <div className={cn(
            "fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300",
            theme === 'dark' ? "bg-black/60" : "bg-indigo-900/10"
          )}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center space-y-4 transition-colors duration-300",
                theme === 'dark' ? "bg-zinc-950" : "bg-white"
              )}
            >
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mx-auto",
                theme === 'dark' ? "bg-indigo-900/20 text-indigo-400" : "bg-indigo-50 text-indigo-600"
              )}>
                <LogOut size={32} />
              </div>
              <div className="space-y-2">
                <h3 className={cn(
                  "text-xl font-bold transition-colors duration-300",
                  theme === 'dark' ? "text-white" : "text-black"
                )}>Exit App?</h3>
                <p className={cn(
                  "text-sm transition-colors duration-300",
                  theme === 'dark' ? "text-slate-400" : "text-black"
                )}>
                  Do you want to exit the application?
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowExitConfirm(false)}
                  className={cn(
                    "flex-1 py-3 border rounded-xl font-bold transition-all",
                    theme === 'dark' ? "border-slate-800 text-slate-400 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    // In a real app, this might close the window or navigate away
                    // Here we'll just sign out or similar, or just close the modal
                    // The user specifically asked for "Exit" button
                    window.close(); 
                    // Fallback if window.close() is blocked
                    setShowExitConfirm(false);
                  }}
                  className={cn(
                    "flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all",
                    theme === 'dark' ? "shadow-none" : "shadow-lg shadow-indigo-100"
                  )}
                >
                  Exit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Entries Modal */}
      <AnimatePresence>
        {showShareModal && (
          <div className={cn(
            "fixed inset-0 z-[150] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300",
            theme === 'dark' ? "bg-black/60" : "bg-slate-900/40"
          )}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={cn(
                "w-full max-w-md rounded-3xl p-6 shadow-2xl relative space-y-6 transition-colors duration-300",
                theme === 'dark' ? "bg-zinc-950 border border-zinc-900" : "bg-white"
              )}
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-900 pb-3">
                <h3 className={cn(
                  "text-xl font-black transition-colors duration-300",
                  theme === 'dark' ? "text-white" : "text-slate-800"
                )}>
                  {generatedCode ? "Share Code Available" : "Share Selected Entries"}
                </h3>
                <button
                  onClick={() => { setShowShareModal(false); setGeneratedCode(''); setShareExpiryTime(null); setCountdownText(''); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {shareError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2 font-bold antialiased">
                  <AlertCircle size={16} />
                  <span>{shareError}</span>
                </div>
              )}

              {!generatedCode ? (
                <>
                  <p className={cn(
                    "text-sm transition-colors duration-300 leading-relaxed",
                    theme === 'dark' ? "text-slate-400" : "text-slate-600"
                  )}>
                    You are generating a secure share code to import these entries into another TrackBook cashbook.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                    <div className={cn(
                      "p-4 rounded-2xl text-center transition-colors duration-300 border flex flex-col justify-center items-center",
                      theme === 'dark' ? "bg-zinc-900/40 border-zinc-900" : "bg-slate-50 border-slate-100"
                    )}>
                      <div className="text-[10px] uppercase font-black tracking-wider text-slate-400">Entries</div>
                      <div className={cn("text-lg font-black mt-1", theme === 'dark' ? "text-indigo-400" : "text-indigo-600")}>
                        {selectedList.length}
                      </div>
                    </div>
                    <div className={cn(
                      "p-4 rounded-2xl text-center transition-colors duration-300 border flex flex-col justify-center items-center",
                      theme === 'dark' ? "bg-zinc-900/40 border-zinc-900" : "bg-emerald-50/40 border-emerald-100/50"
                    )}>
                      <div className="text-[10px] uppercase font-black tracking-wider text-emerald-500">Cash In</div>
                      <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                        {formatCurrency(selectedTotals.in)}
                      </div>
                    </div>
                    <div className={cn(
                      "p-4 rounded-2xl text-center transition-colors duration-300 border flex flex-col justify-center items-center",
                      theme === 'dark' ? "bg-zinc-900/40 border-zinc-900" : "bg-rose-50/40 border-rose-100/50"
                    )}>
                      <div className="text-[10px] uppercase font-black tracking-wider text-rose-500">Cash Out</div>
                      <div className="text-lg font-black text-rose-600 dark:text-rose-450 mt-1 break-all">
                        {formatCurrency(selectedTotals.out)}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowShareModal(false)}
                      className={cn(
                        "flex-1 py-3 border rounded-xl font-bold transition-all cursor-pointer text-xs sm:text-sm text-center",
                        theme === 'dark' ? "border-slate-800 text-slate-400 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerateShareCode}
                      disabled={isGenerating}
                      className={cn(
                        "flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm",
                        isGenerating && "opacity-55 cursor-not-allowed"
                      )}
                    >
                      {isGenerating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Generating...
                        </>
                      ) : (
                        "Generate Share Code"
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-6 text-center">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Share Code</div>
                      <div className={cn(
                        "text-3xl sm:text-4xl font-extrabold tracking-widest font-mono p-4 rounded-2xl transition-all select-all flex items-center justify-center gap-3 border border-indigo-100 relative",
                        theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-indigo-400" : "bg-indigo-50/50 border-indigo-100 text-indigo-600"
                      )}>
                        {generatedCode}
                      </div>
                    </div>
                    {countdownText && (
                      <div className={cn(
                        "text-xs font-black px-3.5 py-1.5 rounded-full inline-block animate-pulse font-mono tracking-wider transition-colors duration-300 border",
                        countdownText.includes('expired')
                          ? "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200/50"
                          : "bg-amber-100/80 dark:bg-amber-950/45 text-[#1f2937] dark:text-amber-300 border-amber-300 dark:border-amber-900/60"
                      )}>
                        {countdownText}
                      </div>
                    )}
                  </div>

                  <p className={cn(
                    "text-xs leading-relaxed max-w-sm mx-auto",
                    theme === 'dark' ? "text-slate-400" : "text-slate-500"
                  )}>
                    Give this code to anyone you want to share these entries with. They can import it instantly inside TrackBook under <span className="font-bold">Import Shared Entries</span>.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      onClick={handleCopy}
                      disabled={countdownText.includes('expired')}
                      className={cn(
                        "flex-1 py-3 border rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs sm:text-sm",
                        countdownText.includes('expired')
                          ? "opacity-50 cursor-not-allowed border-slate-200 text-slate-400 dark:border-zinc-850 dark:text-zinc-600"
                          : theme === 'dark'
                            ? "border-slate-800 text-slate-300 hover:bg-slate-850 cursor-pointer"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                      )}
                    >
                      {copied ? (
                        <>
                          <Check className="text-indigo-600 dark:text-indigo-400" size={16} />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          Copy Code
                        </>
                      )}
                    </button>
                    {countdownText.includes('expired') ? (
                      <button
                        disabled
                        className="flex-1 py-3 bg-slate-100 dark:bg-zinc-900 border border-slate-250/10 text-slate-400 dark:text-zinc-650 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-not-allowed text-xs sm:text-sm text-center"
                      >
                        Expired
                      </button>
                    ) : (
                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent('Import my TrackBook entries using this code:\n\n' + generatedCode + '\n\nOpen TrackBook → Import Shared Entries')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-3 bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm text-center shadow-lg shadow-emerald-500/10"
                      >
                        <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm11.951-21.734c-5.382 0-9.761 4.377-9.765 9.761-.001 2.059.537 4.07 1.558 5.839l.24.417-1.033 3.774 3.861-1.013.407.242c1.71 1.015 3.693 1.55 5.733 1.552h.005c5.381 0 9.761-4.377 9.765-9.762.002-2.61-1.013-5.063-2.87-6.921-1.856-1.857-4.31-2.871-6.932-2.872zm4.721 13.43c-.259-.13-1.533-.757-1.77-.843-.238-.087-.41-.13-.582.13-.172.26-.665.843-.815 1.016-.15.174-.3.195-.559.066-.259-.13-1.096-.404-2.088-1.291-.772-.69-1.293-1.543-1.444-1.803-.15-.26-.016-.401.114-.53.117-.116.259-.303.39-.453.13-.15.172-.259.259-.433.086-.174.043-.324-.022-.454-.064-.13-.581-1.402-.796-1.921-.21-.506-.44-.437-.582-.444-.137-.007-.294-.008-.452-.008-.158 0-.417.06-.635.297-.218.238-.832.813-.832 1.984s.854 2.302.973 2.459c.119.157 1.68 2.565 4.07 3.593.57.245 1.014.391 1.359.502.571.181 1.09.155 1.5.094.457-.068 1.533-.626 1.748-1.23.216-.604.216-1.124.152-1.23-.065-.107-.238-.172-.497-.303z" />
                        </svg>
                        Share via WhatsApp
                      </a>
                    )}
                  </div>

                  <button
                    onClick={() => { setShowShareModal(false); setGeneratedCode(''); setShareExpiryTime(null); setCountdownText(''); }}
                    className={cn(
                      "w-full py-2.5 border rounded-xl font-bold transition-all text-xs cursor-pointer",
                      theme === 'dark' ? "border-slate-800 hover:bg-slate-900 text-slate-400" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    Close Action Window
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sticky Mobile/Tablet Action Bar */}
      <AnimatePresence>
        {selectedTransactions.size > 0 && activeBookId && (
          <motion.div
            initial={{ y: "150%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "150%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className={cn(
              "lg:hidden fixed bottom-6 left-4 right-4 max-w-sm mx-auto rounded-[24px] p-4.5 pb-5 backdrop-blur-xl border z-[100] transition-colors duration-300 shadow-[0_16px_50px_rgba(0,0,0,0.3)]",
              theme === 'dark' 
                ? "bg-zinc-950/85 border-zinc-800/80 text-white" 
                : "bg-white/90 border-slate-200/60 text-slate-900"
            )}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100/80 dark:border-zinc-900/60 mb-3">
              <span className={cn(
                "text-[10px] font-extrabold tracking-widest uppercase",
                theme === 'dark' ? "text-zinc-400" : "text-slate-500"
              )}>
                Selected ({selectedTransactions.size})
              </span>
              <div className="flex items-center gap-1.5 font-bold font-mono text-[11px]">
                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                  +{formatCurrency(selectedTotals.in)}
                </span>
                <span className="text-slate-300 dark:text-zinc-800">/</span>
                <span className="text-rose-600 dark:text-rose-450 font-extrabold">
                  -{formatCurrency(selectedTotals.out)}
                </span>
              </div>
            </div>
            <div className={cn("grid gap-2", selectedTransactions.size >= 2 ? "grid-cols-5" : "grid-cols-4")}>
              <button
                onClick={toggleSelectAll}
                className={cn(
                  "flex flex-col items-center justify-center h-16 rounded-[18px] transition-all font-bold font-sans text-[10px] tracking-wider uppercase gap-1.5 duration-150 active:scale-95 cursor-pointer border",
                  selectedTransactions.size === filteredTransactions.length
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                    : theme === 'dark'
                      ? "border-zinc-800 text-slate-200 bg-zinc-900/60 hover:bg-zinc-850"
                      : "border-slate-150 text-slate-700 bg-slate-50/50 hover:bg-slate-100/50"
                )}
              >
                <CheckSquare size={16} />
                <span>All</span>
              </button>
              <button
                onClick={() => setSelectedTransactions(new Set())}
                className={cn(
                  "flex flex-col items-center justify-center h-16 rounded-[18px] transition-all font-bold font-sans text-[10px] tracking-wider uppercase gap-1.5 duration-150 active:scale-95 cursor-pointer border",
                  theme === 'dark'
                    ? "border-zinc-800 text-slate-200 bg-zinc-900/60 hover:bg-zinc-850"
                    : "border-slate-150 text-slate-700 bg-slate-50/50 hover:bg-slate-100/50"
                )}
              >
                <Square size={16} />
                <span>None</span>
              </button>
              <button
                onClick={() => setShowShareModal(true)}
                className="flex flex-col items-center justify-center h-16 rounded-[18px] transition-all font-bold font-sans text-[10px] tracking-wider uppercase gap-1.5 bg-indigo-600 border border-indigo-650 text-white cursor-pointer hover:bg-indigo-700 active:scale-95 duration-150 shadow-lg shadow-indigo-600/20"
              >
                <Share size={16} />
                <span>Share</span>
              </button>
              <button
                onClick={() => { setShowBulkTransactionDeleteConfirm(true); setDeleteConfirmed(false); }}
                className="flex flex-col items-center justify-center h-16 rounded-[18px] transition-all font-bold font-sans text-[10px] tracking-wider uppercase gap-1.5 bg-rose-600 border border-rose-650 text-white cursor-pointer hover:bg-rose-700 active:scale-95 duration-150 shadow-lg shadow-rose-600/20"
              >
                <Trash size={16} />
                <span>Delete</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Shared Entries Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className={cn(
            "fixed inset-0 z-[150] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-300",
            theme === 'dark' ? "bg-black/60" : "bg-slate-900/40"
          )}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={cn(
                "w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 transition-colors duration-300 relative",
                theme === 'dark' ? "bg-zinc-950 border border-zinc-900" : "bg-white"
              )}
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-900 pb-3">
                <h3 className={cn(
                  "text-lg font-black transition-colors duration-300",
                  theme === 'dark' ? "text-white" : "text-black"
                )}>
                  Import Shared Entries
                </h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {importError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2 font-bold antialiased">
                  <AlertCircle size={16} />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccess ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                    <CheckSquare size={24} className="text-emerald-600 dark:text-emerald-450" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-850 dark:text-slate-100">Entries Imported!</h4>
                    <p className="text-xs text-slate-400 mt-1">Creating book and refreshing workspace...</p>
                    {importSummary && (
                      <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl text-left border border-indigo-100/30">
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          {importSummary.split(' | ')[0]}
                        </div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                          {importSummary.split(' | ')[1]}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!isImporting && importCode.trim()) {
                      handleImportSharedEntries();
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className={cn(
                        "text-[10px] uppercase font-black tracking-wider transition-colors duration-300",
                        theme === 'dark' ? "text-slate-400" : "text-slate-500"
                      )}>
                        Enter 5-Character Share Code
                      </label>
                      <input 
                        type="text"
                        placeholder="e.g. TBK-82KD1"
                        value={importCode}
                        onChange={(e) => setImportCode(e.target.value.toUpperCase())}
                        disabled={isImporting}
                        className={cn(
                          "w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-center font-bold font-mono text-lg tracking-widest",
                          theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white placeholder-slate-700" : "bg-white border-slate-200 text-black placeholder-slate-300"
                        )}
                        maxLength={10}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => setShowImportModal(false)}
                      disabled={isImporting}
                      className={cn(
                        "flex-1 py-3 border rounded-xl font-bold transition-all cursor-pointer text-xs sm:text-sm",
                        theme === 'dark' ? "border-slate-800 text-slate-400 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isImporting || !importCode.trim()}
                      className={cn(
                        "flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 dark:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm",
                        (isImporting || !importCode.trim()) && "opacity-55 cursor-not-allowed"
                      )}
                    >
                      {isImporting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Importing...
                        </>
                      ) : (
                        "Import Entries"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden AI File Input */}
      <input 
        type="file"
        multiple
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Hidden AI OCR File Input */}
      <input 
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg,image/*"
        ref={aiOcrFileInputRef}
        onChange={handleAiOcrFileSelected}
        className="hidden"
      />

      {/* Floating Download Manager Portal */}
      <DownloadCenter theme={theme} isOpen={showDownloadCenter} setIsOpen={setShowDownloadCenter} />

      {/* Premium Media Picker Action Sheet */}
      <MediaPickerSheet
        isOpen={isMediaPickerOpen}
        onClose={() => setIsMediaPickerOpen(false)}
        theme={theme}
        onSelectPhoto={() => {
          if (activeUploadTarget === 'ai') {
            fileInputRef.current?.click();
          } else if (activeUploadTarget === 'transaction') {
            multiFileInputRef.current?.click();
          }
        }}
        onCaptureCamera={(e) => {
          if (activeUploadTarget === 'ai') {
            handleFileUpload(e);
          } else if (activeUploadTarget === 'transaction') {
            handleImageUpload(e);
          }
        }}
      />

      {editorState && (
        <ImageEditorModal
          file={editorState.file}
          onDone={(editedFile) => {
            editorState.onDone(editedFile);
            setEditorState(null);
          }}
          onCancel={() => {
            editorState.onCancel();
            setEditorState(null);
          }}
          theme={theme as 'light' | 'dark'}
        />
      )}

      {/* Premium Undo Toast Overlay */}
      <AnimatePresence>
        {showUndoToast && undoAction && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2rem)] max-w-sm"
          >
            <div className={cn(
              "rounded-2xl border p-4.5 shadow-2xl flex flex-col gap-3 relative overflow-hidden transition-all duration-300",
              theme === 'dark' 
                ? "bg-zinc-950/95 border-zinc-800 text-white backdrop-blur-md" 
                : "bg-white/95 border-slate-200 text-slate-800 backdrop-blur-md shadow-indigo-150"
            )}>
              {/* Top border animated indicator */}
              <div className="absolute top-0 left-0 h-[3px] bg-indigo-600 transition-all duration-1000" style={{ width: `${(undoTimeLeft / 8) * 100}%` }} />
              
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2.5 rounded-xl shrink-0 flex items-center justify-center",
                    theme === 'dark' ? "bg-red-950/40 text-rose-400" : "bg-rose-50 text-rose-600"
                  )}>
                    <Trash2 size={18} className="animate-pulse" />
                  </div>
                  <div className="space-y-0.5 text-left">
                    <p className="text-xs font-black tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
                      Deleted {undoAction.type.includes('bulk') ? 'Items' : (undoAction.type === 'book' ? 'Cashbook' : 'Entry')}
                    </p>
                    <p className="text-sm font-bold truncate max-w-[180px]">
                      {undoAction.type === 'book' 
                        ? (undoAction.data.book?.name || undoAction.data.name) 
                        : undoAction.type === 'bulk_books' 
                          ? `${undoAction.data.length} Cashbooks`
                          : undoAction.type === 'bulk_transactions'
                            ? `${undoAction.data.length} Entries`
                            : (undoAction.data.description || 'Untitled Entry')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      vibrate(40);
                      try {
                        if (undoAction.type === 'book') {
                          // Restore cashbook metadata
                          setBooks(prevBooks => {
                            const next = [...prevBooks];
                            const insertIdx = undoAction.originalIndex !== undefined ? undoAction.originalIndex : next.length;
                            next.splice(insertIdx, 0, undoAction.data.book || undoAction.data);
                            return next;
                          });
                          // Restore entries cache
                          const bookId = undoAction.data.book?.id || undoAction.data.id;
                          if (undoAction.data.cachedEntries) {
                            entriesCache.set(bookId, undoAction.data.cachedEntries);
                          }
                          // Do NOT navigate or select! Fulfills user requirement of no automatic navigation!

                        } else if (undoAction.type === 'bulk_books') {
                          setBooks(prevBooks => {
                            const next = [...prevBooks];
                            const items = undoAction.data;
                            const sortedPairs = items.map((item: any, i: number) => ({
                              item,
                              index: undoAction.originalIndexes?.[i] ?? next.length
                            })).sort((a: any, b: any) => a.index - b.index);

                            sortedPairs.forEach((pair: any) => {
                              next.splice(pair.index, 0, pair.item.book);
                              if (pair.item.cachedEntries) {
                                entriesCache.set(pair.item.book.id, pair.item.cachedEntries);
                              }
                            });
                            return next;
                          });

                        } else if (undoAction.type === 'transaction') {
                          // Put back in active book transactions
                          setBooks(prevBooks => prevBooks.map(b => {
                            if (b.id === undoAction.parentBookId) {
                              const nextTx = [...b.transactions];
                              const insertIdx = undoAction.originalIndex !== undefined ? undoAction.originalIndex : 0;
                              nextTx.splice(insertIdx, 0, undoAction.data);
                              return { ...b, transactions: nextTx };
                            }
                            return b;
                          }));

                          // Update entries cache
                          const cached = entriesCache.get(undoAction.parentBookId || '');
                          if (cached) {
                            const nextCached = [...cached];
                            const entryForCache = {
                              id: undoAction.data.id,
                              amount: undoAction.data.amount,
                              type: undoAction.data.type,
                              description: undoAction.data.description,
                              category: undoAction.data.category,
                              mode: undoAction.data.mode,
                              date: undoAction.data.date,
                              cashbook_id: undoAction.parentBookId,
                              user_id: session?.user?.id
                            };
                            const insertIdx = undoAction.originalIndex !== undefined ? undoAction.originalIndex : 0;
                            nextCached.splice(insertIdx, 0, entryForCache);
                            entriesCache.set(undoAction.parentBookId || '', nextCached);
                          }

                        } else if (undoAction.type === 'bulk_transactions') {
                          // Put back in active book transactions
                          setBooks(prevBooks => prevBooks.map(b => {
                            if (b.id === undoAction.parentBookId) {
                              const nextTx = [...b.transactions];
                              const sortedPairs = undoAction.data.map((tx: any, i: number) => ({
                                tx,
                                index: undoAction.originalIndexes?.[i] ?? 0
                              })).sort((a: any, b: any) => a.index - b.index);

                              sortedPairs.forEach((pair: any) => {
                                nextTx.splice(pair.index, 0, pair.tx);
                              });
                              return { ...b, transactions: nextTx };
                            }
                            return b;
                          }));

                          // Update main entries cache
                          const cached = entriesCache.get(undoAction.parentBookId || '');
                          if (cached) {
                            const nextCached = [...cached];
                            const sortedPairs = undoAction.data.map((tx: any, i: number) => ({
                              tx,
                              index: undoAction.originalIndexes?.[i] ?? 0
                            })).sort((a: any, b: any) => a.index - b.index);

                            sortedPairs.forEach((pair: any) => {
                              nextCached.splice(pair.index, 0, pair.tx);
                            });
                            entriesCache.set(undoAction.parentBookId || '', nextCached);
                          }
                        }
                      } catch (err) {
                        console.error('Error undoing deletion:', err);
                      } finally {
                        setShowUndoToast(false);
                        setUndoAction(null);
                      }
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-black tracking-wider uppercase transition-all duration-200 shadow-sm grow-0 shrink-0 cursor-pointer",
                      theme === 'dark' 
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white" 
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    )}
                  >
                    UNDO
                  </button>
                  <button
                    onClick={() => {
                      if (undoAction) {
                        commitPendingDeletion(undoAction);
                      }
                      setShowUndoToast(false);
                      setUndoAction(null);
                    }}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors duration-200 shrink-0 cursor-pointer",
                      theme === 'dark' ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"
                    )}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Duplicate AI Entry Warning Modal */}
      <AnimatePresence>
        {showDuplicateAiWarning && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={showDuplicateAiWarning.onCancel}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center space-y-4 transition-colors duration-300 relative z-10",
                theme === 'dark' ? "bg-zinc-950 border border-zinc-850 text-white" : "bg-white border border-slate-100 text-slate-800"
              )}
            >
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-colors duration-300",
                theme === 'dark' ? "bg-amber-900/20 text-amber-400" : "bg-amber-50 text-amber-600"
              )}>
                <AlertCircle size={32} />
              </div>
              <div className="space-y-2">
                <h3 className={cn(
                  "text-xl font-bold transition-colors duration-300",
                  theme === 'dark' ? "text-slate-100" : "text-slate-800"
                )}>Duplicate Entry?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                  This image and entry are already added. Do you want to add it anyway?
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={showDuplicateAiWarning.onCancel}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={showDuplicateAiWarning.onConfirm}
                  className={cn(
                    "flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-all cursor-pointer",
                    theme === 'dark' ? "shadow-none" : "shadow-lg shadow-amber-100"
                  )}
                >
                  Add Anyway
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Background Scanning Success Toast */}
      <AnimatePresence>
        {backgroundScanResult && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[200] w-[calc(100%-2rem)] max-w-sm"
          >
            <div className={cn(
              "rounded-2xl border p-4 shadow-2xl flex items-center justify-between gap-3 relative overflow-hidden transition-all duration-300",
              theme === 'dark' 
                ? "bg-zinc-950/95 border-zinc-800 text-white backdrop-blur-md" 
                : "bg-white/95 border-slate-200 text-slate-800 backdrop-blur-md shadow-indigo-150"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2.5 rounded-xl shrink-0 flex items-center justify-center",
                  theme === 'dark' ? "bg-emerald-950/40 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                )}>
                  <CheckCircle2 size={18} className="animate-pulse" />
                </div>
                <div className="space-y-0.5 text-left">
                  <p className="text-xs font-black tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
                    AI TrackBook
                  </p>
                  <p className="text-sm font-bold">
                    {backgroundScanResult}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBackgroundScanResult(null)}
                className={cn(
                  "p-1.5 rounded-lg transition-colors duration-200 shrink-0 cursor-pointer",
                  theme === 'dark' ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"
                )}
              >
                <X size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp Share Modal */}
      <ShareWhatsAppModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        cashbookId={activeBook?.id || ''}
        cashbookName={activeBook?.name || ''}
        filteredTransactions={filteredTransactions}
        theme={theme}
      />
    </div>
  );
}
