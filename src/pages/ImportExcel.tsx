import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { 
  ArrowLeft, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  X, 
  ChevronDown, 
  Check, 
  Loader2, 
  Download, 
  RefreshCw, 
  SlidersHorizontal, 
  Layers, 
  Wallet,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { cn, formatCurrency, safeUUID, vibrate } from '../lib/utils';
import { 
  ExcelSheetData, 
  ParsedEntry, 
  ColumnMapping, 
  TrackBookField,
  TRACKBOOK_FIELDS,
  STANDARD_TRACKBOOK_CATEGORIES,
  MandatoryMappingStatus,
  checkMandatoryColumns,
  autoDetectHeaderRow, 
  autoDetectColumnMapping, 
  buildEntriesFromSheet,
  generateErrorReportCsv 
} from '../utils/excelImportHelper';

interface ImportExcelProps {
  session: any;
  theme: 'light' | 'dark';
  setTheme: React.Dispatch<React.SetStateAction<'light' | 'dark'>>;
}

interface CashbookOption {
  id: string;
  name: string;
}

export default function ImportExcel({ session, theme }: ImportExcelProps) {
  const navigate = useNavigate();
  const { bookSlug: paramBookSlug } = useParams();
  const [searchParams] = useSearchParams();
  const queryBookId = searchParams.get('bookId');
  const queryBookSlug = searchParams.get('bookSlug');

  // Cashbook state
  const [cashbooks, setCashbooks] = useState<CashbookOption[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [loadingBooks, setLoadingBooks] = useState(true);

  // File & Sheet state
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [sheetData, setSheetData] = useState<ExcelSheetData | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  // Mapping & Config
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [showMappingDrawer, setShowMappingDrawer] = useState(false);
  const [defaultMode, setDefaultMode] = useState('Cash');

  // Preview & Filtering
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  // Row deletion and selection for preview
  const [deletedRowNumbers, setDeletedRowNumbers] = useState<Set<number>>(new Set());
  const [selectedRowNumbers, setSelectedRowNumbers] = useState<Set<number>>(new Set());
  const [undoToast, setUndoToast] = useState<{ message: string; rows: ParsedEntry[] } | null>(null);
  const [showMissingMandatoryPopup, setShowMissingMandatoryPopup] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Import Execution state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importCompleted, setImportCompleted] = useState(false);
  const [importResult, setImportResult] = useState<{
    successful: number;
    failed: number;
    failedEntries: ParsedEntry[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch user's cashbooks
  useEffect(() => {
    let isMounted = true;

    async function loadCashbooks() {
      if (!session?.user?.id) {
        setLoadingBooks(false);
        return;
      }

      try {
        // Try local storage cache first for instant response
        const localBooks: CashbookOption[] = [];
        try {
          const raw = localStorage.getItem('trackbook_cached_books_v1');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((b: any) => {
                if (b && b.id && b.name) localBooks.push({ id: b.id, name: b.name });
              });
            }
          }
        } catch {}

        if (localBooks.length > 0 && isMounted) {
          setCashbooks(localBooks);
        }

        // Supabase query
        if (supabase) {
          const { data: ownedBooks } = await supabase
            .from('cashbooks')
            .select('id, name')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

          if (ownedBooks && ownedBooks.length > 0 && isMounted) {
            setCashbooks(ownedBooks);
            
            // Determine active cashbook
            const target = queryBookId 
              ? ownedBooks.find(b => b.id === queryBookId)
              : (paramBookSlug || queryBookSlug)
                ? ownedBooks.find(b => b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === (paramBookSlug || queryBookSlug) || b.id === (paramBookSlug || queryBookSlug))
                : ownedBooks[0];

            if (target) {
              setSelectedBookId(target.id);
            } else if (ownedBooks[0]) {
              setSelectedBookId(ownedBooks[0].id);
            }
          } else if (localBooks.length > 0 && isMounted) {
            setSelectedBookId(localBooks[0].id);
          }
        }
      } catch (err) {
        console.warn('[ImportExcel] Error fetching cashbooks:', err);
      } finally {
        if (isMounted) setLoadingBooks(false);
      }
    }

    loadCashbooks();
    return () => { isMounted = false; };
  }, [session, queryBookId, paramBookSlug, queryBookSlug]);

  // 2. Parse Excel file when uploaded
  const handleFileProcess = async (selectedFile: File) => {
    setParsingError(null);
    setIsParsing(true);
    setFile(selectedFile);
    setImportCompleted(false);
    setImportResult(null);

    // Validate extension
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileName = selectedFile.name.toLowerCase();
    const hasValidExt = validExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidExt) {
      setParsingError('Unsupported format. Please upload a Microsoft Excel file (.xlsx, .xls) or .csv file.');
      setIsParsing(false);
      return;
    }

    // Validate size (max 50MB)
    if (selectedFile.size > 50 * 1024 * 1024) {
      setParsingError('File size exceeds the 50MB limit. Please upload a smaller file.');
      setIsParsing(false);
      return;
    }

    try {
      const buffer = await selectedFile.arrayBuffer();
      const wb = XLSX.read(buffer, {
        type: 'array',
        cellDates: true,
        dateNF: 'yyyy-mm-dd'
      });

      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        throw new Error('The uploaded Excel file contains no readable sheets.');
      }

      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      const firstSheet = wb.SheetNames[0];
      setActiveSheetName(firstSheet);
      parseSheetData(wb, firstSheet);
    } catch (err: any) {
      console.error('[ImportExcel] Parsing error:', err);
      setParsingError(err?.message || 'Failed to parse Excel file. Please ensure the file is not corrupted or password protected.');
    } finally {
      setIsParsing(false);
    }
  };

  // 3. Parse specific sheet
  const parseSheetData = (wb: XLSX.WorkBook, sheetName: string) => {
    try {
      const ws = wb.Sheets[sheetName];
      if (!ws) {
        setParsingError(`Sheet "${sheetName}" not found in workbook.`);
        return;
      }

      // Convert sheet to 2D array matrix with raw cell values and defval
      const matrix: any[][] = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: '',
        blankrows: false,
        raw: true
      });

      if (!matrix || matrix.length === 0) {
        setParsingError(`Sheet "${sheetName}" is empty. No rows detected.`);
        setSheetData(null);
        return;
      }

      // Detect header row
      const { headerIndex, headers } = autoDetectHeaderRow(matrix);
      const dataRows = matrix.slice(headerIndex + 1);

      if (dataRows.length === 0) {
        setParsingError(`Sheet "${sheetName}" has header columns but contains no data rows.`);
        setSheetData(null);
        return;
      }

      const sData: ExcelSheetData = {
        sheetName,
        headers,
        headerRowIndex: headerIndex,
        dataRows,
        totalRows: dataRows.length
      };

      setSheetData(sData);

      // Auto-detect column mapping
      const autoMap = autoDetectColumnMapping(headers);
      setColumnMapping(autoMap);
      setCurrentPage(1);

      // Reset row deletions & selections for the new sheet/file
      setDeletedRowNumbers(new Set());
      setSelectedRowNumbers(new Set());
      setUndoToast(null);

      // Check if any mandatory fields are missing and show clean, compact popup
      const status = checkMandatoryColumns(headers, autoMap);
      if (!status.isAllMandatoryMapped) {
        setShowMissingMandatoryPopup(true);
      }
    } catch (err: any) {
      console.error('[ImportExcel] Sheet parse error:', err);
      setParsingError(err?.message || 'Error parsing sheet data.');
    }
  };

  // Switch active sheet
  const handleSheetChange = (newSheetName: string) => {
    if (workbook && newSheetName !== activeSheetName) {
      setActiveSheetName(newSheetName);
      parseSheetData(workbook, newSheetName);
    }
  };

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      vibrate(10);
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleManualSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      vibrate(10);
      handleFileProcess(e.target.files[0]);
    }
  };

  // Mandatory TrackBook fields detection status
  const mandatoryStatus = useMemo<MandatoryMappingStatus>(() => {
    if (!sheetData) {
      return {
        date: { isMapped: false, columnName: 'NOT FOUND' },
        description: { isMapped: false, columnName: 'NOT FOUND' },
        category: { isMapped: false, columnName: 'NOT FOUND' },
        amount: { isMapped: false, columnName: 'NOT FOUND' },
        type: { isMapped: false, columnName: 'NOT FOUND' },
        missingFields: ['Date', 'Description', 'Category', 'Amount', 'Type'],
        isAllMandatoryMapped: false
      };
    }
    return checkMandatoryColumns(sheetData.headers, columnMapping);
  }, [sheetData, columnMapping]);

  // 4. Build parsed entries from current sheet & mapping
  const allParsedEntries = useMemo<ParsedEntry[]>(() => {
    if (!sheetData) return [];
    return buildEntriesFromSheet(sheetData, columnMapping, defaultMode);
  }, [sheetData, columnMapping, defaultMode]);

  // Active parsed entries (excluding rows deleted by the user from preview)
  const parsedEntries = useMemo<ParsedEntry[]>(() => {
    if (deletedRowNumbers.size === 0) return allParsedEntries;
    return allParsedEntries.filter(e => !deletedRowNumbers.has(e.rowNumber));
  }, [allParsedEntries, deletedRowNumbers]);

  // Counts dynamically recalculate when rows are removed
  const counts = useMemo(() => {
    const total = parsedEntries.length;
    let valid = 0;
    let invalid = 0;
    let warnings = 0;

    parsedEntries.forEach(e => {
      if (e.isValid) valid++;
      else invalid++;
      if (e.warnings.length > 0) warnings += e.warnings.length;
    });

    return { total, valid, invalid, warnings };
  }, [parsedEntries]);

  // Strict Import Eligibility: All rows must be valid, mandatory columns must be mapped
  const canImport = counts.total > 0 && counts.valid > 0 && counts.invalid === 0 && mandatoryStatus.isAllMandatoryMapped && !isImporting;

  // Filtered entries for preview
  const filteredEntries = useMemo(() => {
    if (previewFilter === 'valid') {
      return parsedEntries.filter(e => e.isValid);
    }
    if (previewFilter === 'invalid') {
      return parsedEntries.filter(e => !e.isValid);
    }
    return parsedEntries;
  }, [parsedEntries, previewFilter]);

  // Paginated entries
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredEntries.slice(start, start + rowsPerPage);
  }, [filteredEntries, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / rowsPerPage));

  // Auto-adjust page if current page exceeds total pages after deletion
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Auto-dismiss undo toast
  useEffect(() => {
    if (!undoToast) return;
    const timer = setTimeout(() => {
      setUndoToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [undoToast]);

  // Row selection helpers
  const isAllFilteredSelected = filteredEntries.length > 0 && filteredEntries.every(e => selectedRowNumbers.has(e.rowNumber));
  const isSomeFilteredSelected = filteredEntries.some(e => selectedRowNumbers.has(e.rowNumber)) && !isAllFilteredSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isSomeFilteredSelected;
    }
  }, [isSomeFilteredSelected]);

  const toggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedRowNumbers(prev => {
        const next = new Set(prev);
        filteredEntries.forEach(e => next.delete(e.rowNumber));
        return next;
      });
    } else {
      setSelectedRowNumbers(prev => {
        const next = new Set(prev);
        filteredEntries.forEach(e => next.add(e.rowNumber));
        return next;
      });
    }
  };

  const toggleSelectRow = (rowNumber: number) => {
    setSelectedRowNumbers(prev => {
      const next = new Set(prev);
      if (next.has(rowNumber)) {
        next.delete(rowNumber);
      } else {
        next.add(rowNumber);
      }
      return next;
    });
  };

  // Row deletion from preview (Does NOT modify original Excel file)
  const handleDeleteRow = (entry: ParsedEntry) => {
    vibrate(10);
    setDeletedRowNumbers(prev => {
      const next = new Set(prev);
      next.add(entry.rowNumber);
      return next;
    });
    setSelectedRowNumbers(prev => {
      if (!prev.has(entry.rowNumber)) return prev;
      const next = new Set(prev);
      next.delete(entry.rowNumber);
      return next;
    });
    setUndoToast({
      message: 'Row removed',
      rows: [entry]
    });
  };

  // Bulk row deletion from preview
  const handleDeleteSelectedRows = () => {
    if (selectedRowNumbers.size === 0) return;
    vibrate(15);
    const count = selectedRowNumbers.size;
    const deletedEntries = parsedEntries.filter(e => selectedRowNumbers.has(e.rowNumber));
    setDeletedRowNumbers(prev => {
      const next = new Set(prev);
      selectedRowNumbers.forEach(n => next.add(n));
      return next;
    });
    setSelectedRowNumbers(new Set());
    setUndoToast({
      message: `${count} ${count === 1 ? 'row' : 'rows'} removed`,
      rows: deletedEntries
    });
  };

  // Undo delete
  const handleUndoDelete = () => {
    if (!undoToast || undoToast.rows.length === 0) return;
    vibrate(10);
    const rowsToRestore = undoToast.rows.map(r => r.rowNumber);
    setDeletedRowNumbers(prev => {
      const next = new Set(prev);
      rowsToRestore.forEach(n => next.delete(n));
      return next;
    });
    setUndoToast(null);
  };

  // Reset all and upload another
  const handleReset = () => {
    setFile(null);
    setWorkbook(null);
    setSheetNames([]);
    setActiveSheetName('');
    setSheetData(null);
    setParsingError(null);
    setColumnMapping({});
    setDeletedRowNumbers(new Set());
    setSelectedRowNumbers(new Set());
    setUndoToast(null);
    setShowMissingMandatoryPopup(false);
    setImportCompleted(false);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 5. Execute Import into Supabase & Local Cache
  const handleExecuteImport = async () => {
    setShowConfirmModal(false);
    if (!selectedBookId || !canImport || !session?.user?.id) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportedCount(0);
    const validEntries = parsedEntries.filter(e => e.isValid);
    setImportTotal(validEntries.length);

    const targetBook = cashbooks.find(b => b.id === selectedBookId);
    const userName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User';
    const batchId = `EXCEL_${Date.now()}`;

    const failedItems: ParsedEntry[] = [];
    let successfulCount = 0;

    // Batch size: 50 entries per chunk for high reliability
    const chunkSize = 50;
    const totalChunks = Math.ceil(validEntries.length / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = validEntries.slice(i * chunkSize, (i + 1) * chunkSize);

      // Build database rows matching Supabase `entries` schema
      const insertRows = chunk.map(entry => {
        return {
          id: safeUUID(),
          cashbook_id: selectedBookId,
          user_id: session.user.id,
          user_name: userName,
          amount: entry.amount,
          type: (entry.type || 'out').toLowerCase() === 'in' ? 'in' : 'out',
          description: entry.description,
          category: entry.category,
          mode: entry.mode,
          date: (entry.date || new Date()).toISOString(),
          image_layout: 'split',
          is_imported: true,
          import_batch_id: batchId,
          source: 'Imported'
        };
      });

      try {
        if (supabase) {
          // Attempt 1: Full payload
          const { error: err1 } = await supabase.from('entries').insert(insertRows);

          if (err1) {
            console.warn('[ImportExcel] Attempt 1 failed:', err1.message);
            const isColumnError = err1.code === '42703' || 
                                  err1.code === 'PGRST204' ||
                                  err1.message?.includes('column') || 
                                  err1.message?.includes('does not exist');

            if (isColumnError) {
              // Attempt 2: Without is_imported, import_batch_id, source
              const baseRows = insertRows.map(({ is_imported, import_batch_id, source, user_name, ...rest }: any) => rest);
              const { error: err2 } = await supabase.from('entries').insert(baseRows);

              if (err2) {
                console.warn('[ImportExcel] Attempt 2 failed:', err2.message);
                // Attempt 3: Without image_layout
                const simpleRows = baseRows.map(({ image_layout, ...rest }) => rest);
                const { error: err3 } = await supabase.from('entries').insert(simpleRows);

                if (err3) {
                  console.error('[ImportExcel] Batch insert failed completely:', err3);
                  chunk.forEach(e => {
                    failedItems.push({
                      ...e,
                      errors: [...e.errors, `Database insert error: ${err3.message}`]
                    });
                  });
                  continue;
                }
              }
            } else {
              console.error('[ImportExcel] Supabase insert error:', err1);
              chunk.forEach(e => {
                failedItems.push({
                  ...e,
                  errors: [...e.errors, `Database error: ${err1.message}`]
                });
              });
              continue;
            }
          }
        }

        successfulCount += chunk.length;
        setImportedCount(successfulCount);
        const percent = Math.round(((i + 1) / totalChunks) * 100);
        setImportProgress(percent);
      } catch (err: any) {
        console.error('[ImportExcel] Chunk exception:', err);
        chunk.forEach(e => {
          failedItems.push({
            ...e,
            errors: [...e.errors, `Exception: ${err?.message || 'Network error'}`]
          });
        });
      }
    }

    // Save imported entries to local cache to ensure offline availability immediately
    try {
      const cacheKey = `trackbook_cached_entries_${selectedBookId}`;
      const existingRaw = localStorage.getItem(cacheKey);
      const existingEntries = existingRaw ? JSON.parse(existingRaw) : [];
      const newEntriesMapped = validEntries.slice(0, successfulCount).map(entry => ({
        id: safeUUID(),
        cashbook_id: selectedBookId,
        user_id: session.user.id,
        user_name: userName,
        amount: entry.amount,
        type: entry.type,
        description: entry.description,
        category: entry.category,
        mode: entry.mode,
        date: (entry.date || new Date()).toISOString(),
        source: 'Imported',
        is_imported: true
      }));

      // Prepend or merge
      localStorage.setItem(cacheKey, JSON.stringify([...newEntriesMapped, ...existingEntries]));
    } catch {}

    setIsImporting(false);
    setImportCompleted(true);
    setImportResult({
      successful: successfulCount,
      failed: failedItems.length + counts.invalid,
      failedEntries: [...failedItems, ...parsedEntries.filter(e => !e.isValid)]
    });
    vibrate([50, 100, 50]);
  };

  // Target Cashbook Object
  const targetBook = cashbooks.find(b => b.id === selectedBookId) || { id: '', name: 'Selected Cashbook' };
  const targetBookSlug = targetBook.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || targetBook.id;

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300 pb-16 w-full",
      theme === 'dark' ? "bg-black text-slate-100" : "bg-slate-50 text-slate-900"
    )}>
      {/* Top Sticky Header */}
      <header className={cn(
        "sticky top-0 z-30 border-b backdrop-blur-md px-4 sm:px-6 md:px-8 lg:px-10 py-3.5 transition-colors duration-300 w-full",
        theme === 'dark' 
          ? "bg-zinc-950/80 border-zinc-800/80 text-white" 
          : "bg-white/80 border-slate-200/80 text-slate-900"
      )}>
        <div className="w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                vibrate();
                if (selectedBookId) {
                  navigate(`/cashbooks/${targetBookSlug}`);
                } else {
                  navigate('/cashbooks');
                }
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 duration-150",
                theme === 'dark'
                  ? "bg-zinc-900 border-zinc-800 text-slate-300 hover:bg-zinc-800"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              )}
            >
              <ArrowLeft size={16} />
              <span>Back to Workflow</span>
            </button>

            <div className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-zinc-800" />

            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <FileSpreadsheet className="text-emerald-500 shrink-0" size={20} />
                <span>Import Excel</span>
              </h1>
            </div>
          </div>

          {/* Cashbook Target Selector */}
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-xs text-slate-500 dark:text-slate-400 font-medium">
              Target Cashbook:
            </span>
            <div className="relative">
              <select
                value={selectedBookId}
                onChange={(e) => setSelectedBookId(e.target.value)}
                disabled={isImporting || importCompleted}
                className={cn(
                  "pl-8 pr-7 py-1.5 rounded-xl border text-xs font-bold appearance-none cursor-pointer outline-none transition-all",
                  theme === 'dark'
                    ? "bg-zinc-900 border-zinc-800 text-emerald-400 focus:border-emerald-500"
                    : "bg-white border-slate-200 text-emerald-700 focus:border-emerald-500"
                )}
              >
                {cashbooks.map(cb => (
                  <option key={cb.id} value={cb.id} className="text-black dark:text-white">
                    {cb.name}
                  </option>
                ))}
              </select>
              <Wallet size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full px-4 sm:px-6 md:px-8 lg:px-10 py-5 space-y-5">

        {/* Hero Banner when no file is uploaded yet */}
        {!file && (
          <div className="text-center py-4 space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Import your Excel file into TrackBook
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
              Easily import transactions from bank statements, expense logs, or custom spreadsheets. 
              Review and verify every entry in a live preview before saving.
            </p>
          </div>
        )}

        {/* Parsing Error Banner */}
        {parsingError && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 flex items-start gap-3 text-sm font-semibold"
          >
            <AlertCircle size={20} className="shrink-0 text-rose-500 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-bold">Error reading file</p>
              <p className="text-xs text-rose-600 dark:text-rose-400">{parsingError}</p>
            </div>
            <button 
              onClick={() => setParsingError(null)}
              className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}

        {/* STEP 1: Upload Drop Zone */}
        {!file && (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer relative overflow-hidden group",
              dragActive 
                ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20 scale-[1.01]" 
                : theme === 'dark' 
                  ? "border-zinc-800 bg-zinc-950/50 hover:border-zinc-700 hover:bg-zinc-900/40" 
                  : "border-slate-300 bg-white hover:border-emerald-500 hover:bg-emerald-50/30"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={handleManualSelect}
              className="hidden"
            />

            <div className="max-w-md mx-auto space-y-4">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto transition-transform duration-200 group-hover:scale-110",
                dragActive 
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" 
                  : "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
              )}>
                {isParsing ? (
                  <Loader2 size={32} className="animate-spin" />
                ) : (
                  <Upload size={30} />
                )}
              </div>

              <div className="space-y-1">
                <p className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
                  {dragActive ? "Drop your Excel file here" : "Drag & Drop Excel File Here"}
                </p>
                <p className="text-xs text-slate-400">
                  or <span className="text-emerald-600 dark:text-emerald-400 font-bold underline">Browse Excel File</span> from your computer or phone
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-2">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-zinc-800">
                  .xlsx
                </span>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-zinc-800">
                  .xls
                </span>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-zinc-800">
                  .csv
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: File Details & Preview Table */}
        {file && !importCompleted && (
          <div className="w-full space-y-4 sm:space-y-5">
            
            {/* File & Sheet Info Bar */}
            <div className={cn(
              "w-full rounded-2xl border p-4 sm:p-5 transition-colors duration-300 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4",
              theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"
            )}>
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <FileSpreadsheet size={24} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black truncate text-slate-900 dark:text-white">
                    {file.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span>{(file.size / 1024).toFixed(1)} KB</span>
                    <span>•</span>
                    <span>{sheetNames.length} {sheetNames.length === 1 ? 'Sheet' : 'Sheets'}</span>
                    <span>•</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {counts.total} Detected {counts.total === 1 ? 'Entry' : 'Entries'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
                <button
                  onClick={() => setShowMappingDrawer(!showMappingDrawer)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer active:scale-95",
                    showMappingDrawer
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : theme === 'dark'
                        ? "bg-zinc-900 border-zinc-800 text-slate-300 hover:bg-zinc-800"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <SlidersHorizontal size={14} />
                  <span>Column Mapping</span>
                </button>

                <button
                  onClick={handleReset}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer active:scale-95",
                    theme === 'dark'
                      ? "border-zinc-800 text-slate-400 hover:bg-zinc-900"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <RefreshCw size={14} />
                  <span>Change File</span>
                </button>
              </div>
            </div>

            {/* Sheet Tabs (if file has multiple sheets) */}
            {sheetNames.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1 shrink-0">
                  <Layers size={14} /> Sheets:
                </span>
                {sheetNames.map(name => (
                  <button
                    key={name}
                    onClick={() => handleSheetChange(name)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border shrink-0",
                      activeSheetName === name
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : theme === 'dark'
                          ? "bg-zinc-900 border-zinc-800 text-slate-400 hover:bg-zinc-800"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            {/* Expandable Column Mapping Interface */}
            <AnimatePresence>
              {showMappingDrawer && sheetData && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn(
                    "rounded-2xl border p-5 space-y-4 overflow-hidden transition-colors duration-300",
                    theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"
                  )}
                >
                  <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-zinc-900">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <SlidersHorizontal size={16} className="text-indigo-500" />
                        <span>Map Excel Columns to TrackBook Fields</span>
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Ensure each Excel column points to the right TrackBook field. Columns not needed can be set to "Ignore".
                      </p>
                    </div>
                    <button
                      onClick={() => setShowMappingDrawer(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Compact note if mandatory fields are missing */}
                  {!mandatoryStatus.isAllMandatoryMapped && (
                    <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300">
                      <span className="font-semibold flex items-center gap-1.5">
                        <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                        Mandatory fields required: Date, Description, Category, Amount, Type
                      </span>
                      <span className="font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                        Missing: {mandatoryStatus.missingFields.join(', ')}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3.5">
                    {sheetData.headers.map((colHeader, colIdx) => {
                      const currentField = columnMapping[colIdx] || 'ignore';
                      return (
                        <div 
                          key={colIdx} 
                          className={cn(
                            "p-3 rounded-xl border space-y-1.5 transition-colors",
                            theme === 'dark' ? "bg-zinc-900/60 border-zinc-800" : "bg-slate-50 border-slate-200"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-slate-400">
                              Excel Column {colIdx + 1}
                            </span>
                            {currentField !== 'ignore' && (
                              <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5">
                                <Check size={10} /> Mapped
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold truncate text-slate-800 dark:text-slate-200" title={colHeader}>
                            "{colHeader}"
                          </p>

                          <select
                            value={currentField}
                            onChange={(e) => {
                              const newField = e.target.value as TrackBookField;
                              setColumnMapping(prev => ({
                                ...prev,
                                [colIdx]: newField
                              }));
                            }}
                            className={cn(
                              "w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold outline-none cursor-pointer transition-all",
                              currentField !== 'ignore'
                                ? "bg-white dark:bg-zinc-900 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                                : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-400"
                            )}
                          >
                            {TRACKBOOK_FIELDS.map(f => (
                              <option key={f.field} value={f.field}>
                                {f.label} {f.required ? '*' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  {/* Fallback Defaults for Missing Fields */}
                  <div className="pt-3 border-t border-slate-100 dark:border-zinc-900 flex flex-wrap items-center gap-4 text-xs">
                    <span className="font-bold text-slate-500">Optional default for unassigned payment mode:</span>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Payment Mode:</span>
                      <select
                        value={defaultMode}
                        onChange={(e) => setDefaultMode(e.target.value)}
                        className="px-2 py-1 rounded-md border text-xs font-semibold bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800"
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Card">Card</option>
                        <option value="Online">Online</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Counts Bar & Filtering */}
            <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {/* Counts */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-bold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                  Total Entries: <strong className="text-slate-900 dark:text-white">{counts.total}</strong>
                </span>

                <span className="font-bold px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  Valid: <strong>{counts.valid}</strong>
                </span>

                {counts.invalid > 0 && (
                  <span className="font-bold px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 flex items-center gap-1">
                    <AlertCircle size={13} />
                    Invalid: <strong>{counts.invalid}</strong>
                  </span>
                )}

                {/* Batch delete action when rows are selected */}
                {selectedRowNumbers.size > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteSelectedRows}
                    className="px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center gap-1.5 hover:bg-rose-200 dark:hover:bg-rose-900/80 transition-colors cursor-pointer active:scale-95 shadow-xs"
                  >
                    <Trash2 size={13} />
                    <span>Delete Selected ({selectedRowNumbers.size})</span>
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 self-stretch sm:self-auto bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs">
                <button
                  onClick={() => { setPreviewFilter('all'); setCurrentPage(1); }}
                  className={cn(
                    "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                    previewFilter === 'all'
                      ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  All ({counts.total})
                </button>
                <button
                  onClick={() => { setPreviewFilter('valid'); setCurrentPage(1); }}
                  className={cn(
                    "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                    previewFilter === 'valid'
                      ? "bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  Valid ({counts.valid})
                </button>
                {counts.invalid > 0 && (
                  <button
                    onClick={() => { setPreviewFilter('invalid'); setCurrentPage(1); }}
                    className={cn(
                      "px-3 py-1 rounded-lg font-bold transition-all cursor-pointer",
                      previewFilter === 'invalid'
                        ? "bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    )}
                  >
                    Invalid ({counts.invalid})
                  </button>
                )}
              </div>
            </div>

            {/* PREVIEW TABLE (Preserves Exact Row Order, Sticky Header, Scrollable) */}
            <div className={cn(
              "w-full rounded-2xl border shadow-sm overflow-hidden transition-colors duration-300 relative",
              theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"
            )}>
              <div className="w-full overflow-x-auto max-h-[620px] overflow-y-auto">
                <table className="w-full min-w-[1020px] text-left text-xs border-collapse">
                  {/* Sticky Table Header */}
                  <thead className={cn(
                    "sticky top-0 z-20 font-black uppercase text-[10px] tracking-wider border-b transition-colors",
                    theme === 'dark' 
                      ? "bg-zinc-900/95 border-zinc-800 text-slate-400 backdrop-blur-sm" 
                      : "bg-slate-100/95 border-slate-200 text-slate-600 backdrop-blur-sm"
                  )}>
                    <tr>
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          checked={isAllFilteredSelected}
                          onChange={toggleSelectAll}
                          className="rounded accent-emerald-600 cursor-pointer w-4 h-4"
                          title="Select all rows"
                          aria-label="Select all rows"
                        />
                      </th>
                      <th className="py-3 px-2 w-12 text-center">#</th>
                      <th className="py-3 px-3 w-24 whitespace-nowrap">Status</th>
                      <th className="py-3 px-3 w-28 whitespace-nowrap">Date</th>
                      <th className="py-3 px-4 min-w-[280px]">Description</th>
                      <th className="py-3 px-3 w-32 whitespace-nowrap">Category</th>
                      <th className="py-3 px-3 w-32 text-right whitespace-nowrap">Amount</th>
                      <th className="py-3 px-3 w-24 text-center whitespace-nowrap">Type</th>
                      <th className="py-3 px-3 w-24 whitespace-nowrap">Mode</th>
                      <th className="py-3 px-3 w-36 whitespace-nowrap">Reference</th>
                      <th className="py-3 px-3 w-16 text-center whitespace-nowrap">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 font-medium">
                    {paginatedEntries.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-400">
                          No entries found for this filter.
                        </td>
                      </tr>
                    ) : (
                      paginatedEntries.map((entry) => (
                        <tr 
                          key={entry.rowNumber}
                          className={cn(
                            "transition-colors",
                            selectedRowNumbers.has(entry.rowNumber)
                              ? "bg-indigo-50/60 dark:bg-indigo-950/40"
                              : !entry.isValid
                                ? "bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/80 dark:hover:bg-rose-950/30"
                                : theme === 'dark'
                                  ? "hover:bg-zinc-900/60"
                                  : "hover:bg-slate-50"
                          )}
                        >
                          {/* Selection Checkbox */}
                          <td className="py-2.5 px-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={selectedRowNumbers.has(entry.rowNumber)}
                              onChange={() => toggleSelectRow(entry.rowNumber)}
                              className="rounded accent-emerald-600 cursor-pointer w-4 h-4"
                              aria-label={`Select row ${entry.rowNumber}`}
                            />
                          </td>

                          {/* Row Number */}
                          <td className="py-2.5 px-2 w-12 text-center text-slate-400 font-mono text-[11px]">
                            {entry.rowNumber}
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3 w-24 whitespace-nowrap">
                            {entry.isValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-900/50">
                                <Check size={10} /> Valid
                              </span>
                            ) : (
                              <span 
                                title={entry.errors.join('; ')}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[10px] font-bold border border-rose-200 dark:border-rose-900/50 cursor-help"
                              >
                                <AlertCircle size={10} /> Invalid
                              </span>
                            )}
                          </td>

                          {/* Date */}
                          <td className="py-2.5 px-3 w-28 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {entry.dateFormatted}
                          </td>

                          {/* Description */}
                          <td className="py-2.5 px-4 text-slate-900 dark:text-slate-100 min-w-[280px]">
                            {entry.description ? (
                              <span title={entry.description} className="block truncate font-medium">{entry.description}</span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                                EMPTY ❌
                              </span>
                            )}
                            {!entry.isValid && entry.errors.length > 0 && (
                              <div className="text-[10px] text-rose-600 dark:text-rose-400 font-bold mt-1 space-y-0.5">
                                {entry.errors.map((err, i) => (
                                  <div key={i} className="flex items-center gap-1">
                                    <span>• {err}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {entry.warnings.length > 0 && (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5 space-y-0.5">
                                {entry.warnings.map((warn, i) => (
                                  <div key={i} className="flex items-center gap-1">
                                    <span>⚡ {warn}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Category */}
                          <td className="py-2.5 px-3 w-32 whitespace-nowrap">
                            {entry.category ? (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                                {entry.category}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-[10px] font-black border border-rose-300 dark:border-rose-800 tracking-wider">
                                EMPTY ❌
                              </span>
                            )}
                          </td>

                          {/* Amount */}
                          <td className={cn(
                            "py-2.5 px-3 w-32 text-right font-black font-mono text-xs whitespace-nowrap",
                            entry.amount > 0 && entry.type === 'in'
                              ? "text-emerald-600 dark:text-emerald-400"
                              : entry.amount > 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-slate-400"
                          )}>
                            {entry.amount > 0 ? (
                              `${entry.type === 'in' ? '+' : '-'} ₹${entry.amount.toLocaleString('en-IN')}`
                            ) : (
                              <span className="text-rose-500 font-bold text-[10px]">MISSING ❌</span>
                            )}
                          </td>

                          {/* Type */}
                          <td className="py-2.5 px-3 w-24 text-center whitespace-nowrap">
                            {entry.errors.some(e => e.toLowerCase().includes('type')) ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                Missing ❌
                              </span>
                            ) : (
                              <span className={cn(
                                "inline-block px-2 py-0.5 rounded-full text-[10px] font-bold",
                                entry.type === 'in'
                                  ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                                  : "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300"
                              )}>
                                {entry.type === 'in' ? 'Cash In' : 'Cash Out'}
                              </span>
                            )}
                          </td>

                          {/* Mode */}
                          <td className="py-2.5 px-3 w-24 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold">
                              {entry.mode}
                            </span>
                          </td>

                          {/* Reference */}
                          <td className="py-2.5 px-3 w-36 text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-[240px]">
                            {entry.reference || '—'}
                          </td>

                          {/* Action (Row Delete) */}
                          <td className="py-2.5 px-3 w-16 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(entry)}
                              title={`Remove row ${entry.rowNumber}`}
                              aria-label={`Remove row ${entry.rowNumber}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer active:scale-90"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination Bar */}
              {totalPages > 1 && (
                <div className={cn(
                  "p-3 border-t flex items-center justify-between text-xs font-semibold",
                  theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-600"
                )}>
                  <div>
                    Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, filteredEntries.length)} of {filteredEntries.length} entries
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1 rounded-lg border border-slate-200 dark:border-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="px-2 font-bold">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1 rounded-lg border border-slate-200 dark:border-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Bottom Action Bar */}
            <div className={cn(
              "sticky bottom-4 z-20 w-full rounded-2xl border p-4 shadow-xl backdrop-blur-md flex items-center justify-between gap-4 transition-colors",
              theme === 'dark' ? "bg-zinc-950/95 border-zinc-800 text-white" : "bg-white/95 border-slate-200 text-slate-900"
            )}>
              <button
                onClick={handleReset}
                className={cn(
                  "px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer active:scale-95",
                  theme === 'dark'
                    ? "border-zinc-800 text-slate-400 hover:bg-zinc-900"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                Cancel
              </button>

              <div className="flex items-center gap-3">
                {!canImport && (
                  <span className="hidden sm:inline text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1.5">
                    <AlertCircle size={14} />
                    <span>
                      {mandatoryStatus.missingFields.length > 0 
                        ? `Missing mandatory column: ${mandatoryStatus.missingFields.join(', ')}`
                        : counts.invalid > 0 
                          ? `Cannot import: ${counts.invalid} ${counts.invalid === 1 ? 'row is' : 'rows are'} incomplete`
                          : 'No importable entries detected'}
                    </span>
                  </span>
                )}

                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={!canImport}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 shadow-lg duration-150",
                    canImport
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 cursor-pointer active:scale-95"
                      : "bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none border border-slate-300 dark:border-zinc-700"
                  )}
                >
                  <FileSpreadsheet size={16} />
                  <span>
                    {mandatoryStatus.missingFields.length > 0
                      ? `Import Disabled (Missing ${mandatoryStatus.missingFields.join(', ')})`
                      : counts.invalid > 0
                        ? `Fix Required Fields (${counts.invalid} Incomplete)`
                        : counts.valid > 0
                          ? `Import ${counts.valid} Entries`
                          : "Import Disabled"}
                  </span>
                </button>
              </div>
            </div>

          </div>
        )}

        {/* STEP 3: Completed Result Screen */}
        {importCompleted && importResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "max-w-xl mx-auto rounded-3xl border p-6 sm:p-8 shadow-2xl text-center space-y-6 transition-colors",
              theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-900"
            )}
          >
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black tracking-tight">Import Complete</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your transactions have been processed and saved into <strong className="text-slate-800 dark:text-slate-200">{targetBook.name}</strong>.
              </p>
            </div>

            {/* Stats Breakdown */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase text-slate-400">Successfully Imported</span>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {importResult.successful}
                </p>
              </div>
              <div className="space-y-0.5 border-x border-slate-200 dark:border-zinc-800">
                <span className="text-[10px] font-black uppercase text-slate-400">Failed / Skipped</span>
                <p className={cn(
                  "text-xl font-black",
                  importResult.failed > 0 ? "text-rose-500" : "text-slate-400"
                )}>
                  {importResult.failed}
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase text-slate-400">Warnings</span>
                <p className={cn(
                  "text-xl font-black",
                  counts.warnings > 0 ? "text-amber-500" : "text-slate-400"
                )}>
                  {counts.warnings}
                </p>
              </div>
            </div>

            {/* Error Report Download Button (if any failed) */}
            {importResult.failedEntries.length > 0 && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-left flex items-center justify-between gap-3 text-xs">
                <div className="text-rose-700 dark:text-rose-300 font-semibold">
                  <span>{importResult.failedEntries.length} entries had validation or insert errors.</span>
                </div>
                <button
                  onClick={() => {
                    const csv = generateErrorReportCsv(importResult.failedEntries);
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', `Import_Errors_${file?.name || 'Excel'}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer text-xs"
                >
                  <Download size={13} />
                  <span>Download Error Report</span>
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => {
                  vibrate();
                  navigate(`/cashbooks/${targetBookSlug}`);
                }}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs sm:text-sm transition-all shadow-lg shadow-emerald-600/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <Eye size={16} />
                <span>View Imported Entries</span>
              </button>

              <button
                onClick={() => {
                  vibrate();
                  handleReset();
                }}
                className={cn(
                  "py-3 px-4 border rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer active:scale-95",
                  theme === 'dark' ? "border-zinc-800 text-slate-300 hover:bg-zinc-900" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                )}
              >
                Import Another File
              </button>
            </div>
          </motion.div>
        )}

      </main>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={cn(
                "w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 transition-colors duration-300",
                theme === 'dark' ? "bg-zinc-950 border border-zinc-900 text-white" : "bg-white border border-slate-100 text-black"
              )}
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FileSpreadsheet size={24} />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-black tracking-tight">
                  Confirm Excel Import
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  You are about to import <strong>{counts.valid} entries</strong> directly into cashbook <strong className="text-slate-800 dark:text-slate-200">"{targetBook.name}"</strong>.
                </p>
                {counts.invalid > 0 && (
                  <p className="text-xs text-rose-500 font-semibold mt-1">
                    Note: {counts.invalid} invalid rows will not be imported.
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className={cn(
                    "flex-1 py-3 border rounded-xl font-bold transition-all cursor-pointer text-xs sm:text-sm",
                    theme === 'dark' ? "border-zinc-800 text-slate-400 hover:bg-zinc-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleExecuteImport}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black transition-all cursor-pointer text-xs sm:text-sm shadow-lg shadow-emerald-600/20 active:scale-95"
                >
                  Confirm & Import
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Missing Mandatory Fields Compact Popup Notification */}
      <AnimatePresence>
        {showMissingMandatoryPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className={cn(
                "w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4 border transition-colors",
                theme === 'dark' 
                  ? "bg-zinc-950 border-zinc-800 text-white" 
                  : "bg-white border-slate-200 text-slate-900"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle size={20} />
                </div>
                <div className="space-y-1 min-w-0">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Mandatory fields required
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    Some required fields are missing. Date, Description, Category, Amount and Type are required for import.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowMissingMandatoryPopup(false)}
                  className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black hover:opacity-90 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Undo Toast for Deleted Rows */}
      <AnimatePresence>
        {undoToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900/95 text-white dark:bg-white/95 dark:text-slate-950 shadow-2xl backdrop-blur-md text-xs font-bold border border-slate-800 dark:border-slate-200"
          >
            <span>{undoToast.message}</span>
            <button
              type="button"
              onClick={handleUndoDelete}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black transition-colors cursor-pointer active:scale-95"
            >
              <RotateCcw size={12} />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={() => setUndoToast(null)}
              className="p-1 text-slate-400 hover:text-white dark:hover:text-slate-900 cursor-pointer"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Importing Progress Overlay */}
      <AnimatePresence>
        {isImporting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "w-full max-w-sm rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 text-center transition-colors",
                theme === 'dark' ? "bg-zinc-950 border border-zinc-900 text-white" : "bg-white border border-slate-100 text-black"
              )}
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <Loader2 size={30} className="animate-spin text-emerald-500" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black tracking-tight">Importing entries...</h3>
                <p className="text-xs text-slate-400">Please keep this window open</p>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-zinc-900 overflow-hidden border border-slate-200 dark:border-zinc-800">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-500">
                  <span>{importProgress}%</span>
                  <span>{importedCount} / {importTotal}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
