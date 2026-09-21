import * as XLSX from 'xlsx';

export type TrackBookField = 
  | 'date'
  | 'description'
  | 'category'
  | 'amount'
  | 'type'
  | 'cash_in'
  | 'cash_out'
  | 'mode'
  | 'reference'
  | 'ignore';

export interface FieldDefinition {
  field: TrackBookField;
  label: string;
  required?: boolean;
  description: string;
}

export const TRACKBOOK_FIELDS: FieldDefinition[] = [
  { field: 'date', label: 'Date', required: true, description: 'Transaction Date (DD-MM-YYYY) [Mandatory]' },
  { field: 'description', label: 'Description', required: true, description: 'Transaction details or party [Mandatory]' },
  { field: 'category', label: 'Category', required: true, description: 'Expense or Income category [Mandatory]' },
  { field: 'cash_in', label: 'Cash In / Credit', required: true, description: 'Received / Income column [Mandatory Amount/Type]' },
  { field: 'cash_out', label: 'Cash Out / Debit', required: true, description: 'Spent / Expense column [Mandatory Amount/Type]' },
  { field: 'amount', label: 'Amount (Single Column)', required: true, description: 'Single amount column [Mandatory Amount]' },
  { field: 'type', label: 'Type (Cash In / Out)', required: true, description: 'Entry type column [Mandatory Type]' },
  { field: 'mode', label: 'Payment Mode', description: 'Cash, UPI, Card, Online, etc. (Optional)' },
  { field: 'reference', label: 'Bill / Reference No.', description: 'Optional invoice or voucher ID' },
  { field: 'ignore', label: 'Ignore / Do Not Import', description: 'Skip this column' }
];

export const STANDARD_TRACKBOOK_CATEGORIES = [
  'Food',
  'Transport',
  'Groceries',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Healthcare',
  'Travel',
  'Fuel',
  'Rent',
  'Salary',
  'Investment',
  'Business',
  'Freelance',
  'Gift',
  'Advance',
  'Education',
  'Personal',
  'Utilities',
  'Maintenance',
  'Office',
  'Other'
];

export interface MandatoryMappingStatus {
  date: { isMapped: boolean; columnName: string };
  description: { isMapped: boolean; columnName: string };
  category: { isMapped: boolean; columnName: string };
  amount: { isMapped: boolean; columnName: string; isDerived?: boolean };
  type: { isMapped: boolean; columnName: string; isDerived?: boolean };
  missingFields: ('Date' | 'Description' | 'Category' | 'Amount' | 'Type')[];
  isAllMandatoryMapped: boolean;
}

/**
 * Checks if the 5 mandatory TrackBook fields (Date, Description, Category, Amount, Type)
 * are mapped or derived from Excel columns.
 */
export function checkMandatoryColumns(headers: string[], mapping: ColumnMapping): MandatoryMappingStatus {
  let dateCol = -1;
  let descCol = -1;
  let catCol = -1;
  let amountCol = -1;
  let cashInCol = -1;
  let cashOutCol = -1;
  let typeCol = -1;

  Object.entries(mapping).forEach(([idxStr, field]) => {
    const idx = parseInt(idxStr, 10);
    if (field === 'date') dateCol = idx;
    else if (field === 'description') descCol = idx;
    else if (field === 'category') catCol = idx;
    else if (field === 'amount') amountCol = idx;
    else if (field === 'cash_in') cashInCol = idx;
    else if (field === 'cash_out') cashOutCol = idx;
    else if (field === 'type') typeCol = idx;
  });

  const missingFields: ('Date' | 'Description' | 'Category' | 'Amount' | 'Type')[] = [];

  const dateMapped = dateCol !== -1;
  if (!dateMapped) missingFields.push('Date');

  const descMapped = descCol !== -1;
  if (!descMapped) missingFields.push('Description');

  const catMapped = catCol !== -1;
  if (!catMapped) missingFields.push('Category');

  const hasSeparateCash = cashInCol !== -1 || cashOutCol !== -1;
  const amountMapped = amountCol !== -1 || hasSeparateCash;
  if (!amountMapped) missingFields.push('Amount');

  const typeMapped = typeCol !== -1 || hasSeparateCash;
  if (!typeMapped) missingFields.push('Type');

  return {
    date: {
      isMapped: dateMapped,
      columnName: dateMapped ? headers[dateCol] : 'NOT FOUND'
    },
    description: {
      isMapped: descMapped,
      columnName: descMapped ? headers[descCol] : 'NOT FOUND'
    },
    category: {
      isMapped: catMapped,
      columnName: catMapped ? headers[catCol] : 'NOT FOUND'
    },
    amount: {
      isMapped: amountMapped,
      columnName: amountCol !== -1 
        ? headers[amountCol] 
        : hasSeparateCash 
          ? [cashInCol !== -1 ? headers[cashInCol] : '', cashOutCol !== -1 ? headers[cashOutCol] : ''].filter(Boolean).join(' / ')
          : 'NOT FOUND',
      isDerived: amountCol === -1 && hasSeparateCash
    },
    type: {
      isMapped: typeMapped,
      columnName: typeCol !== -1 
        ? headers[typeCol] 
        : hasSeparateCash 
          ? `Derived from ${[cashInCol !== -1 ? headers[cashInCol] : '', cashOutCol !== -1 ? headers[cashOutCol] : ''].filter(Boolean).join(' & ')}`
          : 'NOT FOUND',
      isDerived: typeCol === -1 && hasSeparateCash
    },
    missingFields,
    isAllMandatoryMapped: missingFields.length === 0
  };
}

export interface ExcelSheetData {
  sheetName: string;
  headers: string[];
  headerRowIndex: number;
  dataRows: any[][];
  totalRows: number;
}

export interface ParsedEntry {
  rowNumber: number; // 1-based Excel row number
  date: Date | null;
  dateFormatted: string;
  description: string;
  category: string;
  type: 'in' | 'out';
  amount: number;
  mode: string;
  reference: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  rawValues: Record<string, any>;
}

export type ColumnMapping = Record<number, TrackBookField>;

/**
 * Parses Excel dates safely.
 * Strict handling for TrackBook DD-MM-YYYY standard.
 * Prevents accidental DD-MM-YYYY vs MM-DD-YYYY swapping.
 */
export function parseExcelDate(val: any): { date: Date | null; rawStr: string; formatted: string; isValid: boolean } {
  if (val === undefined || val === null || val === '') {
    return { date: null, rawStr: '', formatted: '', isValid: false };
  }

  // 1. If native Date object (from XLSX cellDates: true)
  if (val instanceof Date && !isNaN(val.getTime())) {
    const d = val.getDate();
    const m = val.getMonth() + 1;
    const y = val.getFullYear();
    const dayStr = String(d).padStart(2, '0');
    const monthStr = String(m).padStart(2, '0');
    // Normalize to mid-day (12:00:00) in local time to avoid timezone offset rolling into previous/next day
    const normalized = new Date(y, m - 1, d, 12, 0, 0);
    return {
      date: normalized,
      rawStr: `${dayStr}-${monthStr}-${y}`,
      formatted: `${dayStr}-${monthStr}-${y}`,
      isValid: true
    };
  }

  // 2. If numeric Excel serial number (e.g. 45170)
  if (typeof val === 'number' || (!isNaN(Number(val)) && !String(val).includes('-') && !String(val).includes('/') && !String(val).includes('.'))) {
    const num = Number(val);
    if (num > 1000 && num < 100000) {
      // Excel epoch: Dec 30 1899 (leap year bug correction = 25569 days to 1970-01-01)
      const dateObj = new Date(Math.round((num - 25569) * 86400 * 1000));
      // Correct for timezone offset
      const utcDate = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000);
      const d = utcDate.getDate();
      const m = utcDate.getMonth() + 1;
      const y = utcDate.getFullYear();
      const dayStr = String(d).padStart(2, '0');
      const monthStr = String(m).padStart(2, '0');
      return {
        date: new Date(y, m - 1, d, 12, 0, 0),
        rawStr: String(val),
        formatted: `${dayStr}-${monthStr}-${y}`,
        isValid: true
      };
    }
  }

  const str = String(val).trim();

  // 3. Pattern: DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) y += 2000;

    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1970 && y <= 2100) {
      const normalized = new Date(y, m - 1, d, 12, 0, 0);
      const dayStr = String(d).padStart(2, '0');
      const monthStr = String(m).padStart(2, '0');
      return {
        date: normalized,
        rawStr: str,
        formatted: `${dayStr}-${monthStr}-${y}`,
        isValid: true
      };
    }
  }

  // 4. Pattern: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      const normalized = new Date(y, m - 1, d, 12, 0, 0);
      const dayStr = String(d).padStart(2, '0');
      const monthStr = String(m).padStart(2, '0');
      return {
        date: normalized,
        rawStr: str,
        formatted: `${dayStr}-${monthStr}-${y}`,
        isValid: true
      };
    }
  }

  // 5. Fallback via Date.parse
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    const d = fallback.getDate();
    const m = fallback.getMonth() + 1;
    const y = fallback.getFullYear();
    const dayStr = String(d).padStart(2, '0');
    const monthStr = String(m).padStart(2, '0');
    return {
      date: new Date(y, m - 1, d, 12, 0, 0),
      rawStr: str,
      formatted: `${dayStr}-${monthStr}-${y}`,
      isValid: true
    };
  }

  return { date: null, rawStr: str, formatted: str, isValid: false };
}

/**
 * Parses numeric amounts safely.
 * Strips currency symbols (₹, Rs, $, etc.), commas, and extra spaces.
 */
export function parseExcelAmount(val: any): { amount: number; isValid: boolean; rawStr: string } {
  if (val === undefined || val === null || val === '') {
    return { amount: 0, isValid: false, rawStr: '' };
  }
  if (typeof val === 'number') {
    const amt = Math.abs(val);
    return {
      amount: isNaN(amt) ? 0 : amt,
      isValid: !isNaN(amt) && amt > 0,
      rawStr: String(val)
    };
  }
  const str = String(val).trim();
  const cleaned = str
    .replace(/[₹$€£]/g, '')
    .replace(/\b(rs\.?|inr|usd|eur|gbp)\b/gi, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .replace(/[()]/g, '');

  const parsed = parseFloat(cleaned);
  const isValid = !isNaN(parsed) && parsed > 0;
  return {
    amount: isNaN(parsed) ? 0 : Math.abs(parsed),
    isValid,
    rawStr: str
  };
}

/**
 * Auto-detects the header row inside raw Excel sheet matrix.
 * Skips blank rows or promotional title rows at the top.
 */
export function autoDetectHeaderRow(matrix: any[][]): { headerIndex: number; headers: string[] } {
  if (!matrix || matrix.length === 0) {
    return { headerIndex: 0, headers: [] };
  }

  // Keywords that strongly indicate header row
  const headerKeywords = [
    'date', 'time', 'amount', 'amt', 'particular', 'particulars', 'desc', 'description', 
    'category', 'type', 'mode', 'credit', 'debit', 'cr', 'dr', 'cash in', 'cash out', 
    'in', 'out', 'notes', 'remark', 'remarks', 'ref', 'bill', 'balance'
  ];

  let bestIndex = 0;
  let maxScore = -1;

  // Check top 15 rows
  const maxSearch = Math.min(matrix.length, 15);
  for (let i = 0; i < maxSearch; i++) {
    const row = matrix[i];
    if (!Array.isArray(row) || row.length === 0) continue;

    let score = 0;
    for (const cell of row) {
      if (cell !== undefined && cell !== null) {
        const text = String(cell).toLowerCase().trim();
        if (headerKeywords.some(k => text === k || text.includes(k))) {
          score++;
        }
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestIndex = i;
    }
  }

  // If score is at least 1, we found a confident header row
  const headerRow = matrix[bestIndex] || [];
  const headers = headerRow.map((cell, idx) => {
    const val = cell !== undefined && cell !== null ? String(cell).trim() : '';
    return val || `Column ${idx + 1}`;
  });

  return { headerIndex: bestIndex, headers };
}

/**
 * Automatically maps Excel column names to TrackBook fields based on heuristics.
 */
export function autoDetectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const usedFields = new Set<TrackBookField>();

  headers.forEach((header, idx) => {
    const h = header.toLowerCase().trim();

    // 1. Date
    if (!usedFields.has('date') && (
      h === 'date' || h === 'transaction date' || h === 'txn date' || h === 'entry date' || 
      h === 'dated' || h === 'payment date' || h.includes('date')
    )) {
      mapping[idx] = 'date';
      usedFields.add('date');
      return;
    }

    // 2. Separate Cash In / Credit
    if (!usedFields.has('cash_in') && (
      h === 'cash in' || h === 'cashin' || h === 'credit' || h === 'cr' || 
      h === 'income' || h === 'received' || h === 'deposit' || h === 'in'
    )) {
      mapping[idx] = 'cash_in';
      usedFields.add('cash_in');
      return;
    }

    // 3. Separate Cash Out / Debit
    if (!usedFields.has('cash_out') && (
      h === 'cash out' || h === 'cashout' || h === 'debit' || h === 'dr' || 
      h === 'expense' || h === 'spent' || h === 'paid' || h === 'withdrawal' || h === 'out'
    )) {
      mapping[idx] = 'cash_out';
      usedFields.add('cash_out');
      return;
    }

    // 4. Single Amount
    if (!usedFields.has('amount') && !usedFields.has('cash_in') && (
      h === 'amount' || h === 'amt' || h === 'net amount' || h === 'total' || 
      h === 'transaction amount' || h === 'txn amount' || h === 'value'
    )) {
      mapping[idx] = 'amount';
      usedFields.add('amount');
      return;
    }

    // 5. Type (Cash In / Out)
    if (!usedFields.has('type') && (
      h === 'type' || h === 'transaction type' || h === 'txn type' || 
      h === 'entry type' || h === 'cr/dr' || h === 'in/out' || h === 'flow'
    )) {
      mapping[idx] = 'type';
      usedFields.add('type');
      return;
    }

    // 6. Category
    if (!usedFields.has('category') && (
      h === 'category' || h === 'expense category' || h === 'cat' || 
      h === 'head' || h === 'account head' || h === 'tag'
    )) {
      mapping[idx] = 'category';
      usedFields.add('category');
      return;
    }

    // 7. Payment Mode
    if (!usedFields.has('mode') && (
      h === 'mode' || h === 'payment mode' || h === 'payment method' || 
      h === 'payment type' || h === 'method' || h === 'paid via' || h === 'channel'
    )) {
      mapping[idx] = 'mode';
      usedFields.add('mode');
      return;
    }

    // 8. Description / Remarks
    if (!usedFields.has('description') && (
      h === 'description' || h === 'particulars' || h === 'particular' || 
      h === 'details' || h === 'remark' || h === 'remarks' || h === 'narration' || 
      h === 'notes' || h === 'note' || h === 'desc' || h === 'party' || h === 'name' || h === 'vendor'
    )) {
      mapping[idx] = 'description';
      usedFields.add('description');
      return;
    }

    // 9. Reference / Bill No
    if (!usedFields.has('reference') && (
      h === 'reference' || h === 'ref' || h === 'ref no' || h === 'reference no' || 
      h === 'bill' || h === 'bill no' || h === 'bill number' || h === 'invoice' || 
      h === 'voucher' || h === 'voucher no' || h === 'cheque no' || h === 'utr'
    )) {
      mapping[idx] = 'reference';
      usedFields.add('reference');
      return;
    }

    // Default to ignore
    mapping[idx] = 'ignore';
  });

  return mapping;
}

/**
 * Normalizes payment mode to TrackBook standard or user text.
 */
export function normalizePaymentMode(val: any, fallback: string = 'Cash'): string {
  if (!val) return fallback;
  const str = String(val).trim();
  const lower = str.toLowerCase();
  if (lower.includes('upi') || lower.includes('gpay') || lower.includes('phonepe') || lower.includes('paytm')) {
    return 'UPI';
  }
  if (lower.includes('card') || lower.includes('credit') || lower.includes('debit')) {
    return 'Card';
  }
  if (lower.includes('cash')) {
    return 'Cash';
  }
  if (lower.includes('online') || lower.includes('bank') || lower.includes('neft') || lower.includes('rtgs') || lower.includes('imps') || lower.includes('transfer')) {
    return 'Online';
  }
  if (lower.includes('cheque') || lower.includes('check')) {
    return 'Custom';
  }
  return str || fallback;
}

/**
 * Converts a raw Excel sheet into validated TrackBook entries.
 * PRESERVES EXACT ROW ORDER.
 * Enforces mandatory Date, Description, Category, Amount, and Type.
 * NEVER auto-fills Category or Description.
 */
export function buildEntriesFromSheet(
  sheetData: ExcelSheetData,
  mapping: ColumnMapping,
  defaultMode: string = 'Cash'
): ParsedEntry[] {
  const result: ParsedEntry[] = [];
  const { dataRows, headers, headerRowIndex } = sheetData;

  // Determine mapped column indices
  let dateCol = -1;
  let amountCol = -1;
  let cashInCol = -1;
  let cashOutCol = -1;
  let typeCol = -1;
  let descCol = -1;
  let catCol = -1;
  let modeCol = -1;
  let refCol = -1;

  Object.entries(mapping).forEach(([colIdxStr, field]) => {
    const colIdx = parseInt(colIdxStr, 10);
    if (field === 'date') dateCol = colIdx;
    else if (field === 'amount') amountCol = colIdx;
    else if (field === 'cash_in') cashInCol = colIdx;
    else if (field === 'cash_out') cashOutCol = colIdx;
    else if (field === 'type') typeCol = colIdx;
    else if (field === 'description') descCol = colIdx;
    else if (field === 'category') catCol = colIdx;
    else if (field === 'mode') modeCol = colIdx;
    else if (field === 'reference') refCol = colIdx;
  });

  const hasSeparateCashColumns = cashInCol !== -1 || cashOutCol !== -1;

  dataRows.forEach((row, rowIdx) => {
    // 1-based Excel row number (headerRowIndex + 1 is header, so data starts at headerRowIndex + 2)
    const excelRowNumber = headerRowIndex + 2 + rowIdx;

    // Check if row is completely empty
    const isRowEmpty = row.every(cell => cell === undefined || cell === null || String(cell).trim() === '');
    if (isRowEmpty) return;

    const rawValues: Record<string, any> = {};
    headers.forEach((h, idx) => {
      rawValues[h] = row[idx];
    });

    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Date (MANDATORY)
    let parsedDate: Date | null = null;
    let dateFormatted = '';
    if (dateCol !== -1) {
      const dateRes = parseExcelDate(row[dateCol]);
      if (dateRes.isValid && dateRes.date) {
        // Sequential second offset based on row index:
        // Preserves identical calendar date (DD-MM-YYYY) while guaranteeing strict Excel row-order preservation
        // when chronological sort is executed!
        const baseTime = dateRes.date.getTime();
        parsedDate = new Date(baseTime + (rowIdx % 3600) * 1000);
        dateFormatted = dateRes.formatted;
      } else {
        errors.push('Date is missing or invalid');
        dateFormatted = dateRes.rawStr || 'Invalid Date';
      }
    } else {
      errors.push('Date is missing (no Date column mapped)');
      dateFormatted = 'Missing Date';
    }

    // 2. Amount & Type (MANDATORY)
    let amount = 0;
    let entryType: 'in' | 'out' = 'out';

    if (hasSeparateCashColumns) {
      const inVal = cashInCol !== -1 ? parseExcelAmount(row[cashInCol]) : { amount: 0, isValid: false, rawStr: '' };
      const outVal = cashOutCol !== -1 ? parseExcelAmount(row[cashOutCol]) : { amount: 0, isValid: false, rawStr: '' };

      const hasIn = inVal.isValid && inVal.amount > 0;
      const hasOut = outVal.isValid && outVal.amount > 0;

      if (hasIn && !hasOut) {
        amount = inVal.amount;
        entryType = 'in';
      } else if (hasOut && !hasIn) {
        amount = outVal.amount;
        entryType = 'out';
      } else if (hasIn && hasOut) {
        errors.push(`Ambiguous: Both Cash In (₹${inVal.amount}) and Cash Out (₹${outVal.amount}) contain values`);
      } else {
        errors.push('Amount is missing or zero');
      }
    } else if (amountCol !== -1) {
      const amtRes = parseExcelAmount(row[amountCol]);
      if (amtRes.isValid && amtRes.amount > 0) {
        amount = amtRes.amount;

        let determinedType: 'in' | 'out' | null = null;
        if (typeCol !== -1 && row[typeCol] !== undefined && row[typeCol] !== null) {
          const typeStr = String(row[typeCol]).toLowerCase().trim();
          if (['in', 'cash in', 'credit', 'cr', 'income', 'received', '+'].includes(typeStr)) {
            determinedType = 'in';
          } else if (['out', 'cash out', 'debit', 'dr', 'expense', 'paid', '-'].includes(typeStr)) {
            determinedType = 'out';
          } else if (typeStr) {
            errors.push(`Unrecognized Type value: "${row[typeCol]}"`);
          }
        } else if (typeof row[amountCol] === 'number' && row[amountCol] < 0) {
          determinedType = 'out';
        } else if (typeof row[amountCol] === 'string' && (row[amountCol].includes('-') || row[amountCol].includes('('))) {
          determinedType = 'out';
        }

        if (determinedType) {
          entryType = determinedType;
        } else if (!errors.some(e => e.includes('Type'))) {
          errors.push('Type is missing');
        }
      } else {
        errors.push('Amount is missing or zero');
      }
    } else {
      errors.push('Amount is missing (no Amount or Cash In/Out column mapped)');
      errors.push('Type is missing');
    }

    // 3. Description (MANDATORY: Never invent data like 'Excel Entry #X')
    let description = '';
    if (descCol !== -1 && row[descCol] !== undefined && row[descCol] !== null) {
      description = String(row[descCol]).trim();
    }
    if (!description) {
      errors.push('Description is missing');
    }

    // 4. Category (MANDATORY: Never auto-fill Category; must remain empty if not provided)
    let category = '';
    if (catCol !== -1 && row[catCol] !== undefined && row[catCol] !== null) {
      category = String(row[catCol]).trim();
    }
    if (!category) {
      errors.push('Category is missing');
    } else {
      const isKnown = STANDARD_TRACKBOOK_CATEGORIES.some(c => c.toLowerCase() === category.toLowerCase());
      if (!isKnown) {
        warnings.push(`Unknown category: "${category}"`);
      }
    }

    // 5. Mode (Optional payment mode, defaults to Cash)
    let mode = defaultMode;
    if (modeCol !== -1 && row[modeCol] !== undefined && row[modeCol] !== null) {
      mode = normalizePaymentMode(row[modeCol], defaultMode);
    }

    // 6. Reference (Optional bill/invoice ref)
    let reference = '';
    if (refCol !== -1 && row[refCol] !== undefined && row[refCol] !== null) {
      reference = String(row[refCol]).trim();
    }

    const isValid = errors.length === 0;

    result.push({
      rowNumber: excelRowNumber,
      date: parsedDate,
      dateFormatted,
      description,
      category,
      type: entryType,
      amount,
      mode,
      reference,
      isValid,
      errors,
      warnings,
      rawValues
    });
  });

  return result;
}

/**
 * Generates downloadable CSV error report for rows that failed validation or import.
 */
export function generateErrorReportCsv(failedEntries: ParsedEntry[]): string {
  const headers = ['Row Number', 'Status', 'Errors', 'Date', 'Description', 'Amount', 'Type', 'Category', 'Payment Mode'];
  const rows = failedEntries.map(e => [
    e.rowNumber,
    e.isValid ? 'Failed on Insert' : 'Validation Error',
    `"${e.errors.join('; ').replace(/"/g, '""')}"`,
    `"${e.dateFormatted}"`,
    `"${(e.description || '').replace(/"/g, '""')}"`,
    e.amount,
    e.type,
    `"${(e.category || '').replace(/"/g, '""')}"`,
    `"${(e.mode || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
}
