import React, { useState } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  List, 
  Sparkles, 
  Database, 
  RefreshCw,
  QrCode,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, vibrate } from '../lib/utils';
import { InAppSelect } from './InAppSelect';

interface SaaSImportsProps {
  theme: 'light' | 'dark';
  onNavigateSection: (section: any) => void;
  books: any[];
}

export default function SaaSImports({
  theme,
  onNavigateSection,
  books,
}: SaaSImportsProps) {

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [shareCodeInput, setShareCodeInput] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Mock parsed entries for Step 3 Preview
  const [previewEntries] = useState([
    { date: '2026-06-25', desc: 'Starbucks Coffee Corp', amount: 12.50, type: 'out', category: 'Food', mode: 'Card' },
    { date: '2026-06-25', desc: 'SaaS Platform License Invoice', amount: 145.00, type: 'out', category: 'Software', mode: 'Bank' },
    { date: '2026-06-26', desc: 'Client Consulting Milestone Deposit', amount: 2500.00, type: 'in', category: 'Sales', mode: 'Bank' },
    { date: '2026-06-27', desc: 'Uber Ride City Transit', amount: 24.80, type: 'out', category: 'Travel', mode: 'Card' }
  ]);

  const [importProgress, setImportProgress] = useState(0);

  // Drag hander
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      vibrate(10);
      setUploadedFileName(e.dataTransfer.files[0].name);
      setStep(2); // Auto jump to validation
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      vibrate(10);
      setUploadedFileName(e.target.files[0].name);
      setStep(2);
    }
  };

  const triggerImportSimulation = () => {
    vibrate(15);
    setStep(4);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      setImportProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          vibrate(30);
          setStep(5);
        }, 500);
      }
    }, 400);
  };

  const activeBookName = books.find(b => b.id === selectedBookId)?.name || "Primary Ledger";

  return (
    <div className={cn(
      "p-5 sm:p-6 rounded-sm border shadow-sm max-w-4xl mx-auto transition-colors duration-300",
      theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
    )}>
      
      {/* Step Progress indicators */}
      <div className="flex items-center justify-between border-b pb-5 mb-6 border-zinc-100 dark:border-zinc-800 overflow-x-auto scrollbar-none">
        {[
          { num: 1, label: 'Upload' },
          { num: 2, label: 'Validate' },
          { num: 3, label: 'Preview' },
          { num: 4, label: 'Import' },
          { num: 5, label: 'Completed' }
        ].map((s) => {
          const isCurrent = step === s.num;
          const isPassed = step > s.num;
          return (
            <div key={s.num} className="flex items-center gap-2 shrink-0">
              <span className={cn(
                "w-6 h-6 rounded-sm flex items-center justify-center text-xs font-semibold shrink-0 border transition-all",
                isCurrent 
                  ? "bg-emerald-600 border-emerald-600 text-white font-bold" 
                  : isPassed
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : theme === 'dark'
                      ? "bg-zinc-950 border-zinc-800 text-zinc-500"
                      : "bg-zinc-100 border-zinc-200 text-zinc-500"
              )}>
                {isPassed ? "✓" : s.num}
              </span>
              <span className={cn(
                "text-xs font-semibold whitespace-nowrap",
                isCurrent ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"
              )}>
                {s.label}
              </span>
              {s.num < 5 && <ArrowRight size={12} className="text-zinc-300 dark:text-zinc-700 mx-2" />}
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        
        {/* STEP 1: UPLOAD */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-6"
          >
            <div>
              <h3 className={cn("text-base font-semibold", theme === 'dark' ? "text-zinc-100" : "text-zinc-900")}>
                Upload Ledger Data Sources
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 font-normal">
                Import entries from bank Excel sheets, CSV exports, or sync-codes generated from secondary workspaces.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Drag drop zone */}
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-sm p-6 text-center transition-all flex flex-col items-center justify-center space-y-4 py-10",
                  dragActive 
                    ? "border-emerald-600 bg-emerald-500/5" 
                    : theme === 'dark'
                      ? "border-zinc-800 bg-zinc-950/40 hover:bg-zinc-850/40"
                      : "border-zinc-200 bg-zinc-50/20 hover:bg-zinc-50/50"
                )}
              >
                <div className="w-10 h-10 rounded-sm bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/15">
                  <Upload size={18} />
                </div>
                <div className="space-y-1">
                  <p className={cn("text-xs font-semibold", theme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>
                    Drag and drop file here
                  </p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-550 font-normal">
                    Supports Microsoft Excel (.xlsx), Comma Separated Values (.csv)
                  </p>
                </div>
                
                <label className="py-2 px-4 border border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-500/50 hover:bg-emerald-600 hover:text-white rounded-sm text-xs font-semibold transition-all cursor-pointer">
                  Browse Files
                  <input 
                    type="file" 
                    accept=".xlsx,.xls,.csv" 
                    className="hidden" 
                    onChange={handleFileSelect} 
                  />
                </label>
              </div>

              {/* Share Code Sync Column */}
              <div className={cn(
                "border rounded-sm p-5 flex flex-col justify-between space-y-4",
                theme === 'dark' ? "bg-zinc-950/50 border-zinc-800" : "bg-zinc-50/50 border-zinc-200"
              )}>
                <div className="space-y-2">
                  <h4 className={cn("text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5", )}>
                    <RefreshCw size={13} className="animate-spin" style={{ animationDuration: '6s' }} />
                    Workspace Share Sync Code
                  </h4>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal leading-relaxed">
                    Instantly replicate transaction ledgers from another peer or employee device. Input their unique alphanumeric cloud export code below.
                  </p>

                  <input 
                    type="text"
                    placeholder="Enter alphanumeric Sync Code (e.g. TBX_84F93)"
                    value={shareCodeInput}
                    onChange={(e) => setShareCodeInput(e.target.value.toUpperCase())}
                    className={cn(
                      "w-full px-3 py-2 text-xs rounded-sm border outline-none font-semibold tracking-widest text-center focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-800"
                    )}
                  />
                </div>

                <button
                  disabled={!shareCodeInput.trim()}
                  onClick={() => { vibrate(10); setUploadedFileName(`Sync_Code_${shareCodeInput}.xlsx`); setStep(2); }}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  Verify Sync Code
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 2: VALIDATE */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-6"
                      <div>
              <h3 className={cn("text-base font-semibold", theme === 'dark' ? "text-zinc-100" : "text-zinc-900")}>
                Data Field Column Mapping
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-550 mt-1 font-normal">
                We successfully detected and parsed 4 rows from **{uploadedFileName || "imported_ledger.csv"}**. Validate detected headers.
              </p>
            </div>

            {/* Validation Match Alerts */}
            <div className="space-y-3">
              {[
                { label: 'Date Column', value: 'Matched (Column A: "Date")' },
                { label: 'Amount Column', value: 'Matched (Column E: "Amount / Debit")' },
                { label: 'Merchant / Description', value: 'Matched (Column B: "Payee / Narration")' },
                { label: 'Payment Mode', value: 'Matched (Column D: "Mode / Type")' }
              ].map((m, i) => (
                <div 
                  key={i}
                  className={cn(
                    "p-3 rounded-sm border text-xs font-semibold flex items-center justify-between",
                    theme === 'dark' ? "bg-zinc-950/50 border-zinc-800" : "bg-zinc-50/50 border-zinc-200"
                  )}
                >
                  <span className="text-zinc-400 dark:text-zinc-500 font-normal">{m.label}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 size={13} />
                    {m.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Target Book Select */}
            <div className="space-y-1.5 max-w-sm">
              <label className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400 dark:text-zinc-550">
                Target Cashbook Workspace Destination
              </label>
              <InAppSelect
                id="target-cashbook-import-select"
                value={selectedBookId}
                onChange={(val) => setSelectedBookId(val)}
                options={[
                  { value: '', label: '-- Create New Cashbook --' },
                  ...books.map(b => ({ value: b.id, label: b.name }))
                ]}
                theme={theme}
                size="md"
                triggerClassName={cn(
                  "w-full px-3 py-2 text-xs rounded-sm border outline-none font-semibold focus:border-emerald-550 focus:ring-1 focus:ring-emerald-550",
                  theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-800"
                )}
              />
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between border-t pt-4 border-zinc-150 dark:border-zinc-800">
              <button
                onClick={() => { vibrate(10); setStep(1); }}
                className="py-1.5 px-4 rounded-sm text-xs font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-450 dark:hover:text-zinc-300 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft size={13} />
                Back
              </button>
              <button
                onClick={() => { vibrate(10); setStep(3); }}
                className="py-1.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                Preview Entries
                <ArrowRight size={13} />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: PREVIEW */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-6"
          >
            <div>
              <h3 className={cn("text-base font-semibold", theme === 'dark' ? "text-zinc-100" : "text-zinc-900")}>
                Ledger Sync Preview
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-550 mt-1 font-normal">
                Review verified parsed transaction logs below. Confirm they align correctly before committing into your database ledger.
              </p>
            </div>

            {/* Table Preview */}
            <div className={cn(
              "border rounded-sm overflow-hidden",
              theme === 'dark' ? "border-zinc-800 bg-zinc-950" : "border-zinc-200 bg-white"
            )}>
              <table className="w-full text-left text-xs font-semibold">
                <thead>
                  <tr className={cn(
                    "border-b text-[10px] uppercase font-semibold text-zinc-400 dark:text-zinc-500 tracking-wider",
                    theme === 'dark' ? "bg-zinc-900/50" : "bg-zinc-50/50"
                  )}>
                    <th className="p-2 px-3">Date</th>
                    <th className="p-2 px-3">Description</th>
                    <th className="p-2 px-3">Category</th>
                    <th className="p-2 px-3">Mode</th>
                    <th className="p-2 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150 dark:divide-zinc-900">
                  {previewEntries.map((item, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/5 dark:hover:bg-zinc-900/30">
                      <td className="p-2.5 px-3 font-medium text-zinc-400 dark:text-zinc-500">{item.date}</td>
                      <td className="p-2.5 px-3 font-semibold text-zinc-800 dark:text-zinc-200">{item.desc}</td>
                      <td className="p-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-sm text-[9px] font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100/40">
                          {item.category}
                        </span>
                      </td>
                      <td className="p-2.5 px-3 text-zinc-400 dark:text-zinc-500">{item.mode}</td>
                      <td className="p-2.5 px-3 text-right font-semibold text-zinc-800 dark:text-zinc-200">
                        <span className={cn(item.type === 'out' ? "text-rose-600" : "text-emerald-600")}>
                          {item.type === 'out' ? "-" : "+"}{formatCurrency(item.amount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between border-t pt-4 border-zinc-150 dark:border-zinc-800">
              <button
                onClick={() => { vibrate(10); setStep(2); }}
                className="py-1.5 px-4 rounded-sm text-xs font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft size={13} />
                Back
              </button>
              <button
                onClick={triggerImportSimulation}
                className="py-2 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/10"
              >
                <Database size={13} />
                Import {previewEntries.length} Records
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 4: IMPORT */}
        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-10 space-y-6"
          >
            <div className="w-12 h-12 rounded-sm bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/10 animate-spin mx-auto">
              <RefreshCw size={22} />
            </div>

            <div className="space-y-1">
              <h3 className={cn("text-sm font-semibold", theme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>
                Replicating Records & Writing to Local Cache...
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 font-normal">
                Securing transactional hashes, running duplicate detections, and updating ledger indexes.
              </p>
            </div>

            <div className="max-w-xs mx-auto">
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-sm h-1.5 overflow-hidden">
                <div 
                  className="h-full bg-emerald-600 rounded-sm transition-all duration-300" 
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold mt-2 block">
                {importProgress}% Completed
              </span>
            </div>
          </motion.div>
        )}

        {/* STEP 5: COMPLETED */}
        {step === 5 && (
          <motion.div
            key="step5"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8 space-y-5"
          >
            <div className="w-12 h-12 rounded-sm bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/15 mx-auto">
              <CheckCircle2 size={24} strokeWidth={2.5} />
            </div>

            <div className="space-y-1">
              <h3 className={cn("text-base font-semibold text-emerald-600 dark:text-emerald-400")}>
                Ledger Sync Completed Successfully
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-sm mx-auto font-normal leading-relaxed">
                Import complete. Verified **{previewEntries.length} new records** successfully committed to **{activeBookName}**.
              </p>
            </div>

            <div className="flex items-center gap-3 justify-center pt-2">
              <button
                onClick={() => { vibrate(10); setStep(1); setShareCodeInput(''); setUploadedFileName(''); }}
                className={cn(
                  "py-2 px-4 rounded-sm text-xs font-semibold transition-all cursor-pointer",
                  theme === 'dark' ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-750" : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                )}
              >
                Import More Data
              </button>
              
              <button
                onClick={() => { vibrate(10); onNavigateSection('cashbooks'); }}
                className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-sm cursor-pointer"
              >
                View Ledger
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
}
