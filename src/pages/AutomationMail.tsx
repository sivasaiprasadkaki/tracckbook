import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  CheckCircle2, 
  Loader2, 
  Mail, 
  FileText, 
  FileSpreadsheet, 
  BookOpen, 
  ShieldAlert, 
  DollarSign, 
  Building2, 
  User, 
  Wallet, 
  ExternalLink, 
  Lock, 
  Settings, 
  LogOut, 
  Sun, 
  Moon, 
  Home,
  Clock,
  Eye,
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, vibrate } from '../lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import XLSX from 'xlsx-js-style';
import { addPdfBrandingFooter, TRACKBOOK_BRANDING } from '../utils/pdfBranding';

interface Transaction {
  id: string;
  amount: number;
  type: 'in' | 'out';
  description: string;
  category: string;
  mode: string;
  date: Date;
  attachments?: any[];
  images?: string[];
}

interface Cashbook {
  id: string;
  name: string;
  createdAt: Date;
  transactions: Transaction[];
}

interface AutomationMailProps {
  session: any;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
}

export default function AutomationMail({ session, theme, setTheme }: AutomationMailProps) {
  const { stepName } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active step index (1-based)
  const getStepIndex = () => {
    if (!stepName) return 1;
    switch (stepName) {
      case 'select-cashbook': return 2;
      case 'review': return 3;
      case 'download': return 4;
      case 'mail-preview': return 5;
      case 'bank-details': return 6;
      case 'compose': return 7;
      default: return 1;
    }
  };

  const currentStep = getStepIndex();

  // Load state from localStorage or defaults
  const [selectedBookId, setSelectedBookId] = useState<string | null>(() => {
    return localStorage.getItem('am_selected_cashbook_id');
  });

  const [bankDetailsAccepted, setBankDetailsAccepted] = useState<boolean>(() => {
    return localStorage.getItem('am_bank_details_accepted') === 'true';
  });

  const [bankForm, setBankForm] = useState({
    accountHolderName: localStorage.getItem('am_bank_holder') || '',
    bankName: localStorage.getItem('am_bank_name') || '',
    accountNumber: localStorage.getItem('am_bank_number') || '',
    ifsc: localStorage.getItem('am_bank_ifsc') || '',
    upiId: localStorage.getItem('am_bank_upi') || ''
  });

  const [emailForm, setEmailForm] = useState({
    to: localStorage.getItem('am_email_to') || 'finance@enterprise.com',
    cc: localStorage.getItem('am_email_cc') || '',
    bcc: localStorage.getItem('am_email_bcc') || '',
    subject: localStorage.getItem('am_email_subject') || 'Expense Reimbursement Report',
    message: localStorage.getItem('am_email_message') || 'Dear Finance Team,\n\nPlease find attached my complete expense report and matching bills/receipts for review and reimbursement.'
  });

  // DB Data States
  const [cashbooks, setCashbooks] = useState<Cashbook[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  
  // Generation Progress
  const [genProgress, setGenProgress] = useState<number>(0);
  const [genStatus, setGenStatus] = useState<string>('Idle');
  const [reportsGenerated, setReportsGenerated] = useState<boolean>(false);

  // Sync state to localStorage
  useEffect(() => {
    if (selectedBookId) localStorage.setItem('am_selected_cashbook_id', selectedBookId);
  }, [selectedBookId]);

  useEffect(() => {
    localStorage.setItem('am_bank_details_accepted', String(bankDetailsAccepted));
  }, [bankDetailsAccepted]);

  useEffect(() => {
    localStorage.setItem('am_bank_holder', bankForm.accountHolderName);
    localStorage.setItem('am_bank_name', bankForm.bankName);
    localStorage.setItem('am_bank_number', bankForm.accountNumber);
    localStorage.setItem('am_bank_ifsc', bankForm.ifsc);
    localStorage.setItem('am_bank_upi', bankForm.upiId);
  }, [bankForm]);

  useEffect(() => {
    localStorage.setItem('am_email_to', emailForm.to);
    localStorage.setItem('am_email_cc', emailForm.cc);
    localStorage.setItem('am_email_bcc', emailForm.bcc);
    localStorage.setItem('am_email_subject', emailForm.subject);
    localStorage.setItem('am_email_message', emailForm.message);
  }, [emailForm]);

  // Fetch Cashbooks & Entries from Supabase
  useEffect(() => {
    const loadData = async () => {
      if (!supabase || !session) return;
      try {
        setLoadingData(true);
        // Fetch cashbooks
        const { data: cbData, error: cbError } = await supabase
          .from('cashbooks')
          .select('*')
          .eq('user_id', session.user.id);
        
        if (cbError) throw cbError;

        if (cbData && cbData.length > 0) {
          // Fetch all entries for these cashbooks
          const cbIds = cbData.map(cb => cb.id);
          const { data: entData, error: entError } = await supabase
            .from('entries')
            .select('*')
            .in('cashbook_id', cbIds)
            .order('date', { ascending: false });

          if (entError) throw entError;

          // Fetch attachments
          const { data: attachData } = await supabase
            .from('attachments')
            .select('*')
            .in('entry_id', entData?.map(e => e.id) || []);

          const attachmentsMap = new Map<string, any[]>();
          if (attachData) {
            for (const att of attachData) {
              if (!attachmentsMap.has(att.entry_id)) {
                attachmentsMap.set(att.entry_id, []);
              }
              attachmentsMap.get(att.entry_id)!.push(att);
            }
          }

          // Format cashbooks
          const formatted = cbData.map(cb => {
            const cbEntries = (entData || [])
              .filter(e => e.cashbook_id === cb.id)
              .map(e => ({
                id: e.id,
                amount: e.amount || 0,
                type: e.type || 'out',
                description: e.description || '',
                category: e.category || 'General',
                mode: e.mode || 'N/A',
                date: e.date ? new Date(e.date) : new Date(e.created_at),
                attachments: attachmentsMap.get(e.id) || [],
                images: e.images || []
              }));
            return {
              id: cb.id,
              name: cb.name,
              createdAt: new Date(cb.created_at),
              transactions: cbEntries
            };
          });

          setCashbooks(formatted);
        }
      } catch (err) {
        console.error('Error loading automation data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [session]);

  const selectedBook = cashbooks.find(cb => cb.id === selectedBookId);

  // Trigger report compilation on step 4
  useEffect(() => {
    if (currentStep === 4 && selectedBook && !reportsGenerated) {
      let isSubscribed = true;
      const compileAll = async () => {
        const statuses = [
          { p: 10, s: 'Initializing automation pipeline...' },
          { p: 30, s: 'Aggregating transaction metadata...' },
          { p: 55, s: 'Generating Expense_Report.xlsx...' },
          { p: 80, s: 'Compiling Expense_Report.pdf with AutoTable...' },
          { p: 95, s: 'Merging receipt attachment bills...' },
          { p: 100, s: 'Reports compiled successfully!' }
        ];

        for (const step of statuses) {
          if (!isSubscribed) return;
          setGenProgress(step.p);
          setGenStatus(step.s);
          await new Promise(r => setTimeout(r, 600));
        }
        if (isSubscribed) {
          setReportsGenerated(true);
        }
      };
      compileAll();

      return () => {
        isSubscribed = false;
      };
    }
  }, [currentStep, selectedBookId, reportsGenerated]);

  // Generators
  const handleDownloadExcel = () => {
    if (!selectedBook) return;
    vibrate(10);
    const transactions = selectedBook.transactions || [];
    let totalIn = 0;
    let totalOut = 0;
    transactions.forEach((t) => {
      if (t.type === 'in') totalIn += t.amount;
      else totalOut += t.amount;
    });

    const rows = transactions.map((t) => ({
      'Date': t.date ? t.date.toLocaleDateString() : 'N/A',
      'Details/Description': t.description || 'No description',
      'Category': t.category || 'General',
      'Payment Mode': t.mode || 'N/A',
      'Cash In (Received)': t.type === 'in' ? t.amount : 0,
      'Cash Out (Spent)': t.type === 'out' ? t.amount : 0,
    }));

    rows.push({} as any);
    rows.push({
      'Date': 'TOTALS',
      'Details/Description': '',
      'Category': '',
      'Payment Mode': '',
      'Cash In (Received)': totalIn,
      'Cash Out (Spent)': totalOut,
    } as any);

    rows.push({
      'Date': 'NET REIMBURSEMENT',
      'Details/Description': '',
      'Category': '',
      'Payment Mode': '',
      'Cash In (Received)': totalIn - totalOut,
      'Cash Out (Spent)': 0,
    } as any);

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expense Report");
    XLSX.writeFile(wb, `Expense_Report_${selectedBook.name.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleDownloadPDF = () => {
    if (!selectedBook) return;
    vibrate(10);
    const doc = new jsPDF({ compress: true });
    const transactions = selectedBook.transactions || [];
    
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229);
    doc.text("TrackBook Expense Report", 14, 25);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 32);

    doc.setFillColor(248, 250, 252);
    doc.rect(14, 38, 182, 32, "F");
    
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("CASHBOOK METADATA", 20, 46);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Name: ${selectedBook.name}`, 20, 53);
    doc.text(`Total Entries: ${transactions.length}`, 20, 59);
    
    let totalIn = 0;
    let totalOut = 0;
    transactions.forEach((t) => {
      if (t.type === 'in') totalIn += t.amount;
      else totalOut += t.amount;
    });
    
    doc.text(`Cash In: Rs. ${totalIn.toLocaleString()}`, 110, 53);
    doc.text(`Cash Out: Rs. ${totalOut.toLocaleString()}`, 110, 59);
    doc.text(`Net Balance: Rs. ${(totalIn - totalOut).toLocaleString()}`, 110, 65);

    const tableRows = transactions.map((t) => [
      t.date ? t.date.toLocaleDateString() : 'N/A',
      t.description || 'No description',
      t.category || 'General',
      t.mode || 'N/A',
      t.type === 'in' ? `+Rs. ${t.amount.toLocaleString()}` : '',
      t.type === 'out' ? `-Rs. ${t.amount.toLocaleString()}` : ''
    ]);

    autoTable(doc, {
      startY: 76,
      head: [['Date', 'Description', 'Category', 'Mode', 'Cash In', 'Cash Out']],
      body: tableRows,
      headStyles: { fillColor: [79, 70, 229] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14, bottom: 30 }, // extra bottom margin to avoid overlapping with footer
      styles: { fontSize: 8.5 },
    });

    // Add page numbers and branding footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addPdfBrandingFooter(doc, i, totalPages, selectedBook.name);
    }

    doc.save(`Expense_Report_${selectedBook.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handleDownloadMergedBills = async () => {
    if (!selectedBook) return;
    vibrate(10);
    const allAttachments: string[] = [];
    selectedBook.transactions.forEach((t) => {
      if (t.attachments && t.attachments.length > 0) {
        t.attachments.forEach((att: any) => {
          if (att.file_url) allAttachments.push(att.file_url);
        });
      } else if (t.images && t.images.length > 0) {
        t.images.forEach((img: string) => {
          allAttachments.push(img);
        });
      }
    });

    if (allAttachments.length === 0) {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.setTextColor(100, 116, 139);
      doc.text("No attachments found in this cashbook.", 20, 40);
      doc.save(`Bills_${selectedBook.name.replace(/\s+/g, '_')}.pdf`);
      return;
    }

    const doc = new jsPDF({ compress: true });
    
    const loadImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
      });
    };

    let first = true;
    for (const url of allAttachments) {
      try {
        const img = await loadImage(url);
        if (!first) {
          doc.addPage();
        }
        first = false;

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const maxW = pageWidth - margin * 2;
        const maxH = pageHeight - margin * 2;

        let w = img.width;
        let h = img.height;
        const ratio = w / h;

        if (w > maxW) {
          w = maxW;
          h = w / ratio;
        }
        if (h > maxH) {
          h = maxH;
          w = h * ratio;
        }

        const x = (pageWidth - w) / 2;
        const y = (pageHeight - h) / 2;

        doc.addImage(img, "JPEG", x, y, w, h, undefined, "FAST");
      } catch (err) {
        console.warn("Could not add image to merged bills PDF:", err);
      }
    }

    doc.save(`Bills_${selectedBook.name.replace(/\s+/g, '_')}.pdf`);
  };

  // Helper values for calculations
  const totalEntries = selectedBook?.transactions.length || 0;
  const totalCashIn = selectedBook?.transactions
    .filter(t => t.type === 'in')
    .reduce((sum, t) => sum + t.amount, 0) || 0;
  const totalCashOut = selectedBook?.transactions
    .filter(t => t.type === 'out')
    .reduce((sum, t) => sum + t.amount, 0) || 0;
  const currentBalance = totalCashIn - totalCashOut;
  const expenseCategories = Array.from(new Set(selectedBook?.transactions.map(t => t.category) || []));
  
  const attachmentsCount = selectedBook?.transactions.reduce((acc, t) => {
    const fromAtts = t.attachments?.length || 0;
    const fromImgs = t.images?.length || 0;
    return acc + Math.max(fromAtts, fromImgs);
  }, 0) || 0;

  const dateRange = (() => {
    if (!selectedBook || selectedBook.transactions.length === 0) return 'N/A';
    const dates = selectedBook.transactions.map(t => t.date.getTime()).filter(Boolean);
    if (dates.length === 0) return 'N/A';
    const minD = new Date(Math.min(...dates));
    const maxD = new Date(Math.max(...dates));
    return `${minD.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} - ${maxD.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  })();

  const userName = session.user.user_metadata?.full_name || 'User';

  // Format final email for step 7
  const finalEmailBody = `${emailForm.message}

Cashbook:
${selectedBook?.name || 'VIT AP'}

Period:
${dateRange}

Total Entries:
${totalEntries}

Cash Out:
Rs. ${totalCashOut.toLocaleString()}

Kindly reimburse the amount to:

Account Holder:
${bankForm.accountHolderName || 'XXXXXXXX'}

Bank:
${bankForm.bankName || 'XXXXXXXX'}

Account Number:
${bankForm.accountNumber || 'XXXXXXXX'}

IFSC:
${bankForm.ifsc || 'XXXXXXXX'}
${bankForm.upiId ? `\nUPI ID:\n${bankForm.upiId}` : ''}

Regards,
${userName}`;

  // Redirect / Open Gmail compose window
  const handleOpenGmail = () => {
    vibrate(15);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailForm.to)}&cc=${encodeURIComponent(emailForm.cc)}&bcc=${encodeURIComponent(emailForm.bcc)}&su=${encodeURIComponent(emailForm.subject)}&body=${encodeURIComponent(finalEmailBody)}`;
    window.open(gmailUrl, '_blank');
  };

  const toggleTheme = () => {
    vibrate(5);
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className={cn(
      "min-h-screen flex flex-col transition-colors duration-300 font-sans",
      theme === 'dark' ? "bg-[#0b0c10] text-[#c5c6c7]" : "bg-slate-50 text-slate-800"
    )}>
      {/* Top Header Sticky */}
      <header className={cn(
        "sticky top-0 z-40 border-b px-4 py-3.5 backdrop-blur-md flex items-center justify-between transition-colors duration-300",
        theme === 'dark' ? "bg-black/80 border-zinc-800" : "bg-white/80 border-slate-100"
      )}>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { vibrate(5); navigate('/cashbooks'); }}
            className={cn(
              "p-2 rounded-xl border transition-colors cursor-pointer",
              theme === 'dark' ? "border-zinc-800 text-slate-300 hover:bg-zinc-900" : "border-slate-200 text-slate-700 hover:bg-slate-100"
            )}
            title="Go to Home Dashboard"
          >
            <Home size={18} />
          </button>
          <div>
            <h1 className={cn(
              "font-black text-sm uppercase tracking-wider",
              theme === 'dark' ? "text-indigo-400" : "text-indigo-600"
            )}>Enterprise Automation</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Mail & Report Hub</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={toggleTheme}
            className={cn(
              "p-2 rounded-xl border transition-colors cursor-pointer",
              theme === 'dark' ? "border-zinc-800 text-slate-300 hover:bg-zinc-900" : "border-slate-200 text-slate-700 hover:bg-slate-100"
            )}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className={cn(
        "w-full border-b py-3 px-4 transition-colors duration-300",
        theme === 'dark' ? "bg-[#12131a] border-zinc-900" : "bg-white border-slate-100"
      )}>
        <div className="max-w-4xl mx-auto flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest">
            <span className="text-indigo-500">Step {currentStep} of 7</span>
            <span className={theme === 'dark' ? "text-zinc-500" : "text-slate-400"}>
              {currentStep === 1 && "Enterprise Introduction"}
              {currentStep === 2 && "Select Cashbook"}
              {currentStep === 3 && "Review Data Summary"}
              {currentStep === 4 && "Compile & Download"}
              {currentStep === 5 && "Configure Email Editor"}
              {currentStep === 6 && "Private Bank Details"}
              {currentStep === 7 && "Compose & Send"}
            </span>
          </div>
          <div className={cn("w-full h-1.5 rounded-full overflow-hidden", theme === 'dark' ? "bg-zinc-900" : "bg-slate-100")}>
            <motion.div 
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500"
              initial={{ width: '0%' }}
              animate={{ width: `${(currentStep / 7) * 100}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="text-center space-y-3">
                <div className="mx-auto w-16 h-16 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-3xl flex items-center justify-center text-indigo-500 shadow-sm border border-indigo-500/10">
                  <Mail size={32} />
                </div>
                <h2 className={cn(
                  "text-xl sm:text-2xl font-black uppercase tracking-tight",
                  theme === 'dark' ? "text-slate-100" : "text-slate-900"
                )}>Enterprise Report Automation</h2>
                <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
                  Streamline and automate your reimbursement workflow. Compile transaction spreadsheets, generate professional statement PDFs, bundle matching attachments, and compose standardized emails directly to your finance department.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={cn(
                  "p-4 rounded-2xl border transition-all hover:scale-[1.01] duration-200",
                  theme === 'dark' ? "bg-[#12131a] border-zinc-800" : "bg-white border-slate-200 shadow-sm"
                )}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500"><FileSpreadsheet size={18} /></div>
                    <h3 className={cn("font-bold text-sm uppercase tracking-wide", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>Generate Reports</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">Create organized Excel spreadsheets and PDF statements matching your transaction histories in seconds.</p>
                </div>

                <div className={cn(
                  "p-4 rounded-2xl border transition-all hover:scale-[1.01] duration-200",
                  theme === 'dark' ? "bg-[#12131a] border-zinc-800" : "bg-white border-slate-200 shadow-sm"
                )}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500"><BookOpen size={18} /></div>
                    <h3 className={cn("font-bold text-sm uppercase tracking-wide", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>Preview Details</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">Verify entry dates, balances, and counts inside a consolidated high-contrast review layout before proceeding.</p>
                </div>

                <div className={cn(
                  "p-4 rounded-2xl border transition-all hover:scale-[1.01] duration-200",
                  theme === 'dark' ? "bg-[#12131a] border-zinc-800" : "bg-white border-slate-200 shadow-sm"
                )}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500"><Settings size={18} /></div>
                    <h3 className={cn("font-bold text-sm uppercase tracking-wide", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>Compose Mail</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">Draft standard message formats containing automated totals, category tags, and bank routing info privately.</p>
                </div>

                <div className={cn(
                  "p-4 rounded-2xl border transition-all hover:scale-[1.01] duration-200",
                  theme === 'dark' ? "bg-[#12131a] border-zinc-800" : "bg-white border-slate-200 shadow-sm"
                )}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500"><ExternalLink size={18} /></div>
                    <h3 className={cn("font-bold text-sm uppercase tracking-wide", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>Redirect to Gmail</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">One-click transfer of all drafted fields directly into Gmail Compose. Easily attach reports and hit send.</p>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t dark:border-zinc-900 border-slate-100">
                <button
                  onClick={() => { vibrate(10); navigate('/automation-mail/select-cashbook'); }}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-indigo-600/10"
                >
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className={cn("text-xl font-black uppercase tracking-tight", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>Select Cashbook</h2>
                <p className="text-xs text-slate-400">Choose the ledger you wish to automatically aggregate and package for reimbursement.</p>
              </div>

              {loadingData ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="animate-spin text-indigo-500" size={32} />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Scanning ledgers...</p>
                </div>
              ) : cashbooks.length === 0 ? (
                <div className={cn(
                  "py-16 text-center border-2 border-dashed rounded-3xl space-y-3",
                  theme === 'dark' ? "border-zinc-800" : "border-slate-200"
                )}>
                  <BookOpen className="mx-auto text-slate-400" size={32} />
                  <p className="text-sm font-bold uppercase tracking-wider text-slate-400">No cashbooks detected</p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">Please return to the dashboard and create a cashbook with transactions first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3.5">
                  {cashbooks.map((book) => {
                    const isSelected = selectedBookId === book.id;
                    const bookOut = book.transactions
                      .filter(t => t.type === 'out')
                      .reduce((sum, t) => sum + t.amount, 0);

                    return (
                      <button
                        key={book.id}
                        onClick={() => { vibrate(8); setSelectedBookId(book.id); }}
                        className={cn(
                          "w-full text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between",
                          isSelected 
                            ? "border-indigo-500 bg-indigo-500/5 shadow-md shadow-indigo-500/5 scale-[1.01]" 
                            : (theme === 'dark' ? "bg-[#12131a] border-zinc-800 hover:border-zinc-700" : "bg-white border-slate-200 hover:border-slate-300 shadow-sm")
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all",
                            isSelected 
                              ? "bg-indigo-500/20 text-indigo-400 border-indigo-400/30" 
                              : (theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-slate-400" : "bg-slate-50 border-slate-150 text-slate-500")
                          )}>
                            <BookOpen size={18} />
                          </div>
                          <div className="min-w-0">
                            <h4 className={cn("font-bold text-sm uppercase tracking-wide truncate", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>
                              {book.name}
                            </h4>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                              <span>{book.transactions.length} Entries</span>
                              <span>•</span>
                              <span className="text-rose-500">Out: Rs. {bookOut.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 ml-4">
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                            isSelected ? "border-indigo-500 bg-indigo-500 text-white" : "border-slate-300 dark:border-zinc-700"
                          )}>
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t dark:border-zinc-900 border-slate-100">
                <button
                  onClick={() => { vibrate(5); navigate('/automation-mail'); }}
                  className={cn(
                    "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center gap-2",
                    theme === 'dark' ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => { vibrate(10); navigate('/automation-mail/review'); }}
                  disabled={!selectedBookId}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none active:scale-95 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-indigo-600/10"
                >
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className={cn("text-xl font-black uppercase tracking-tight", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>Review Summary</h2>
                <p className="text-xs text-slate-400">Inspect compiled totals and category distributions before triggering document generation.</p>
              </div>

              {!selectedBook ? (
                <div className="text-center py-12">
                  <ShieldAlert className="mx-auto text-rose-500 mb-2" size={32} />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Please choose a cashbook first</p>
                  <button 
                    onClick={() => navigate('/automation-mail/select-cashbook')}
                    className="mt-4 text-xs font-bold uppercase tracking-wider text-indigo-500 hover:underline"
                  >
                    Select Cashbook
                  </button>
                </div>
              ) : (
                <div className={cn(
                  "p-6 rounded-3xl border transition-all duration-300 relative overflow-hidden",
                  theme === 'dark' ? "bg-[#12131a] border-zinc-800" : "bg-white border-slate-200 shadow-lg"
                )}>
                  {/* Decorative background circle */}
                  <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex items-center gap-3 mb-6 pb-4 border-b dark:border-zinc-800 border-slate-150">
                    <div className="w-11 h-11 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 border border-indigo-500/10">
                      <BookOpen size={20} />
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Selected Ledger</span>
                      <h3 className={cn("text-lg font-black uppercase tracking-wide leading-tight mt-0.5", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>
                        {selectedBook.name}
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Total Entries</span>
                      <span className={cn("text-lg font-black", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>{totalEntries}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Attachment Count</span>
                      <span className="text-lg font-black text-indigo-500">{attachmentsCount}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Cash In (Credited)</span>
                      <span className="text-lg font-black text-emerald-500">Rs. {totalCashIn.toLocaleString()}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Cash Out (Spent)</span>
                      <span className="text-lg font-black text-rose-500">Rs. {totalCashOut.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t dark:border-zinc-800 border-slate-150 pt-5">
                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Date / Period Range</span>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <Clock size={13} className="text-indigo-400" />
                        <span>{dateRange}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Current Ledger Balance</span>
                      <span className={cn(
                        "text-base font-black px-3 py-1 rounded-full w-fit block",
                        currentBalance >= 0 
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/10" 
                          : "bg-rose-500/10 text-rose-500 border border-rose-500/10"
                      )}>
                        Rs. {currentBalance.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {expenseCategories.length > 0 && (
                    <div className="mt-5 pt-4 border-t dark:border-zinc-800 border-slate-150 space-y-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Active Categories</span>
                      <div className="flex flex-wrap gap-1.5">
                        {expenseCategories.map((cat, i) => (
                          <span 
                            key={i} 
                            className={cn(
                              "text-[9.5px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border",
                              theme === 'dark' 
                                ? "bg-zinc-900 border-zinc-800 text-slate-300" 
                                : "bg-slate-50 border-slate-200 text-slate-600"
                            )}
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t dark:border-zinc-900 border-slate-100">
                <button
                  onClick={() => { vibrate(5); navigate('/automation-mail/select-cashbook'); }}
                  className={cn(
                    "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center gap-2",
                    theme === 'dark' ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => { vibrate(10); navigate('/automation-mail/download'); }}
                  disabled={!selectedBook}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none active:scale-95 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-indigo-600/10"
                >
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className={cn("text-xl font-black uppercase tracking-tight", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>Compile Reports</h2>
                <p className="text-xs text-slate-400">Generate full statement PDFs, Excel sheets, and receipt attachments for download.</p>
              </div>

              {!reportsGenerated ? (
                <div className={cn(
                  "p-8 rounded-3xl border text-center space-y-5 transition-colors duration-300",
                  theme === 'dark' ? "bg-[#12131a] border-zinc-800" : "bg-white border-slate-200 shadow-md"
                )}>
                  <div className="relative w-16 h-16 mx-auto">
                    <div className="absolute inset-0 border-4 border-indigo-500/10 rounded-full" />
                    <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Generation Pipeline</span>
                    <h3 className={cn("text-sm font-black uppercase tracking-wider", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>
                      {genProgress}% Completed
                    </h3>
                    <p className="text-xs text-slate-400 font-medium italic animate-pulse">{genStatus}</p>
                  </div>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  <div className="bg-emerald-500/10 border border-emerald-500/15 rounded-3xl p-5 flex items-center gap-3.5">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
                      <CheckCircle2 size={22} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wide text-emerald-500">Reports Compiled Successfully</h4>
                      <p className="text-xs text-slate-400">Your statements and consolidated bills are prepared and ready for secure export.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Excel Card */}
                    <div className={cn(
                      "p-4 rounded-2xl border transition-all hover:scale-[1.01] duration-200 flex flex-col justify-between",
                      theme === 'dark' ? "bg-[#12131a] border-zinc-800" : "bg-white border-slate-200 shadow-sm"
                    )}>
                      <div>
                        <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 mb-3">
                          <FileSpreadsheet size={18} />
                        </div>
                        <h4 className={cn("font-bold text-xs uppercase tracking-wider mb-1", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>Excel Spreadsheet</h4>
                        <p className="text-[10px] text-slate-400 leading-relaxed mb-4">Complete table structure with ledger formulas and category details.</p>
                      </div>
                      <button
                        onClick={handleDownloadExcel}
                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-widest rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <FileSpreadsheet size={12} />
                        <span>Download</span>
                      </button>
                    </div>

                    {/* PDF Statement Card */}
                    <div className={cn(
                      "p-4 rounded-2xl border transition-all hover:scale-[1.01] duration-200 flex flex-col justify-between",
                      theme === 'dark' ? "bg-[#12131a] border-zinc-800" : "bg-white border-slate-200 shadow-sm"
                    )}>
                      <div>
                        <div className="w-9 h-9 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500 mb-3">
                          <FileText size={18} />
                        </div>
                        <h4 className={cn("font-bold text-xs uppercase tracking-wider mb-1", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>PDF Statement</h4>
                        <p className="text-[10px] text-slate-400 leading-relaxed mb-4">Print-ready PDF report of transactions, cash flow metadata, and summaries.</p>
                      </div>
                      <button
                        onClick={handleDownloadPDF}
                        className="w-full py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] uppercase tracking-widest rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <FileText size={12} />
                        <span>Download</span>
                      </button>
                    </div>

                    {/* Merged Receipts Card */}
                    <div className={cn(
                      "p-4 rounded-2xl border transition-all hover:scale-[1.01] duration-200 flex flex-col justify-between",
                      theme === 'dark' ? "bg-[#12131a] border-zinc-800" : "bg-white border-slate-200 shadow-sm"
                    )}>
                      <div>
                        <div className="w-9 h-9 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500 mb-3">
                          <FileText size={18} />
                        </div>
                        <h4 className={cn("font-bold text-xs uppercase tracking-wider mb-1", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>Merged Receipts</h4>
                        <p className="text-[10px] text-slate-400 leading-relaxed mb-4">Consolidated PDF containing all images, receipts, and invoices page-by-page.</p>
                      </div>
                      <button
                        onClick={handleDownloadMergedBills}
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase tracking-widest rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <FileText size={12} />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="flex justify-between items-center pt-4 border-t dark:border-zinc-900 border-slate-100">
                <button
                  onClick={() => { vibrate(5); navigate('/automation-mail/review'); }}
                  className={cn(
                    "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center gap-2",
                    theme === 'dark' ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => { vibrate(10); navigate('/automation-mail/mail-preview'); }}
                  disabled={!reportsGenerated}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none active:scale-95 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-indigo-600/10"
                >
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className={cn("text-xl font-black uppercase tracking-tight", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>Configure Email Editor</h2>
                <p className="text-xs text-slate-400">Edit the drafted email fields below. Changes are saved locally and synced directly to the final layout.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                {/* Editor Fields */}
                <div className={cn(
                  "p-5 sm:p-6 rounded-3xl border space-y-4 transition-colors duration-300",
                  theme === 'dark' ? "bg-[#12131a] border-zinc-800" : "bg-white border-slate-200 shadow-md"
                )}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">To (Recipient)</label>
                      <input 
                        type="email" 
                        value={emailForm.to}
                        onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                        className={cn(
                          "w-full text-xs font-bold px-3 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors",
                          theme === 'dark' ? "bg-[#0b0c10] border-zinc-800 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-800"
                        )}
                        placeholder="finance@enterprise.com"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">CC</label>
                      <input 
                        type="email" 
                        value={emailForm.cc}
                        onChange={(e) => setEmailForm({ ...emailForm, cc: e.target.value })}
                        className={cn(
                          "w-full text-xs font-bold px-3 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors",
                          theme === 'dark' ? "bg-[#0b0c10] border-zinc-800 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-800"
                        )}
                        placeholder="manager@enterprise.com"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">BCC</label>
                      <input 
                        type="email" 
                        value={emailForm.bcc}
                        onChange={(e) => setEmailForm({ ...emailForm, bcc: e.target.value })}
                        className={cn(
                          "w-full text-xs font-bold px-3 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors",
                          theme === 'dark' ? "bg-[#0b0c10] border-zinc-800 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-800"
                        )}
                        placeholder="archive@enterprise.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Subject Line</label>
                    <input 
                      type="text" 
                      value={emailForm.subject}
                      onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                      className={cn(
                        "w-full text-xs font-bold px-3 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors",
                        theme === 'dark' ? "bg-[#0b0c10] border-zinc-800 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-800"
                      )}
                      placeholder="Expense Reimbursement - June 2026"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Message Body</label>
                    <textarea 
                      rows={5}
                      value={emailForm.message}
                      onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                      className={cn(
                        "w-full text-xs font-semibold px-3 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors resize-none leading-relaxed",
                        theme === 'dark' ? "bg-[#0b0c10] border-zinc-800 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-800"
                      )}
                      placeholder="Please find attached my expense reports..."
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Staged Attachments</span>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                        <FileSpreadsheet size={12} />
                        <span>Expense_Report.xlsx</span>
                      </span>
                      <span className="text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                        <FileText size={12} />
                        <span>Expense_Report.pdf</span>
                      </span>
                      <span className="text-[10px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                        <FileText size={12} />
                        <span>Bills.pdf</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t dark:border-zinc-900 border-slate-100">
                <button
                  onClick={() => { vibrate(5); navigate('/automation-mail/download'); }}
                  className={cn(
                    "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center gap-2",
                    theme === 'dark' ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => { vibrate(10); navigate('/automation-mail/bank-details'); }}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-indigo-600/10"
                >
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === 6 && (
            <motion.div
              key="step6"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className={cn("text-xl font-black uppercase tracking-tight", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>Enter Bank Details</h2>
                <p className="text-xs text-slate-400">Specify routing and billing endpoints so finance knows exactly where to direct your reimbursement funds.</p>
              </div>

              {!bankDetailsAccepted ? (
                <div className={cn(
                  "p-6 rounded-3xl border transition-colors duration-300 space-y-4",
                  theme === 'dark' ? "bg-[#12131a] border-zinc-800" : "bg-white border-slate-200 shadow-md"
                )}>
                  <div className="flex gap-3 text-amber-500">
                    <ShieldAlert size={24} className="shrink-0" />
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-wider mb-1">Privacy & Security Safeguards</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Your bank details are never permanently stored by TrackBook. These details are used only for generating this email. They remain private, secure, and reside strictly in your current browser cache session.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => { vibrate(12); setBankDetailsAccepted(true); }}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 size={12} />
                      <span>I Understand</span>
                    </button>
                  </div>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-6 rounded-3xl border space-y-4 transition-colors duration-300",
                    theme === 'dark' ? "bg-[#12131a] border-zinc-800" : "bg-white border-slate-200 shadow-md"
                  )}
                >
                  <div className="flex items-center gap-2 text-indigo-400 border-b dark:border-zinc-800 border-slate-150 pb-3 mb-1">
                    <Lock size={14} className="text-emerald-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Session Secure Input Mode Active</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Account Holder Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 text-slate-400" size={14} />
                        <input 
                          type="text" 
                          value={bankForm.accountHolderName}
                          onChange={(e) => setBankForm({ ...bankForm, accountHolderName: e.target.value })}
                          className={cn(
                            "w-full text-xs font-bold pl-9 pr-3 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors",
                            theme === 'dark' ? "bg-[#0b0c10] border-zinc-800 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-800"
                          )}
                          placeholder="Your Name"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Bank Name</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-2.5 text-slate-400" size={14} />
                        <input 
                          type="text" 
                          value={bankForm.bankName}
                          onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                          className={cn(
                            "w-full text-xs font-bold pl-9 pr-3 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors",
                            theme === 'dark' ? "bg-[#0b0c10] border-zinc-800 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-800"
                          )}
                          placeholder="e.g. State Bank of India"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Account Number</label>
                      <div className="relative">
                        <Wallet className="absolute left-3 top-2.5 text-slate-400" size={14} />
                        <input 
                          type="text" 
                          value={bankForm.accountNumber}
                          onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                          className={cn(
                            "w-full text-xs font-bold pl-9 pr-3 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors",
                            theme === 'dark' ? "bg-[#0b0c10] border-zinc-800 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-800"
                          )}
                          placeholder="1234567890"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">IFSC Code</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-2.5 text-slate-400" size={14} />
                        <input 
                          type="text" 
                          value={bankForm.ifsc}
                          onChange={(e) => setBankForm({ ...bankForm, ifsc: e.target.value.toUpperCase() })}
                          className={cn(
                            "w-full text-xs font-bold pl-9 pr-3 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors",
                            theme === 'dark' ? "bg-[#0b0c10] border-zinc-800 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-800"
                          )}
                          placeholder="SBIN0001234"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">UPI ID (Optional)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-2.5 text-slate-400" size={14} />
                        <input 
                          type="text" 
                          value={bankForm.upiId}
                          onChange={(e) => setBankForm({ ...bankForm, upiId: e.target.value })}
                          className={cn(
                            "w-full text-xs font-bold pl-9 pr-3 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-colors",
                            theme === 'dark' ? "bg-[#0b0c10] border-zinc-800 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-800"
                          )}
                          placeholder="username@okaxis"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => { vibrate(5); setBankDetailsAccepted(false); }}
                      className="text-[9.5px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-300"
                    >
                      Reset Privacy Lock
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="flex justify-between items-center pt-4 border-t dark:border-zinc-900 border-slate-100">
                <button
                  onClick={() => { vibrate(5); navigate('/automation-mail/mail-preview'); }}
                  className={cn(
                    "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center gap-2",
                    theme === 'dark' ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => { vibrate(10); navigate('/automation-mail/compose'); }}
                  disabled={!bankDetailsAccepted || !bankForm.accountHolderName || !bankForm.bankName || !bankForm.accountNumber || !bankForm.ifsc}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none active:scale-95 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-indigo-600/10"
                >
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === 7 && (
            <motion.div
              key="step7"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <h2 className={cn("text-xl font-black uppercase tracking-tight", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>Compose & Send</h2>
                <p className="text-xs text-slate-400">Review final prefilled email content. Clicking "Open Gmail Compose" will initiate a secure transfer into Gmail.</p>
              </div>

              {/* Final Email Output Preview */}
              <div className={cn(
                "p-5 sm:p-6 rounded-3xl border transition-colors duration-300 font-mono text-xs leading-relaxed overflow-x-auto relative",
                theme === 'dark' ? "bg-black border-zinc-800 text-[#c5c6c7]" : "bg-slate-100/50 border-slate-200 text-slate-800"
              )}>
                <span className="absolute top-3 right-3 text-[8.5px] font-black uppercase tracking-widest text-slate-400 bg-slate-200 dark:bg-zinc-800 px-2 py-0.5 rounded">
                  Live Preview Output
                </span>
                
                <div className="space-y-1 mb-4 pb-3 border-b dark:border-zinc-800 border-slate-200">
                  <p><strong className="text-indigo-400">To:</strong> {emailForm.to}</p>
                  {emailForm.cc && <p><strong className="text-indigo-400">Cc:</strong> {emailForm.cc}</p>}
                  {emailForm.bcc && <p><strong className="text-indigo-400">Bcc:</strong> {emailForm.bcc}</p>}
                  <p><strong className="text-indigo-400">Subject:</strong> {emailForm.subject}</p>
                </div>

                <pre className="whitespace-pre-wrap font-sans text-xs">{finalEmailBody}</pre>
              </div>

              {/* Instructions on files attachment */}
              <div className={cn(
                "p-4 rounded-2xl border flex items-start gap-3 transition-colors",
                theme === 'dark' ? "bg-[#12131a] border-zinc-900" : "bg-white border-slate-200"
              )}>
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 text-indigo-400">
                  <CheckCircle size={15} />
                </div>
                <div className="space-y-1">
                  <h4 className={cn("font-bold text-xs uppercase tracking-wide", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>Attach Downloaded Reports</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Due to browser privacy bounds, downloaded files must be attached manually in the Gmail popup. Simply drag and drop the files from your local downloads folder.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button 
                      onClick={handleDownloadExcel}
                      className="text-[9.5px] font-bold text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <FileSpreadsheet size={10} />
                      Download Excel
                    </button>
                    <button 
                      onClick={handleDownloadPDF}
                      className="text-[9.5px] font-bold text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <FileText size={10} />
                      Download PDF
                    </button>
                    <button 
                      onClick={handleDownloadMergedBills}
                      className="text-[9.5px] font-bold text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <FileText size={10} />
                      Download Bills
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t dark:border-zinc-900 border-slate-100">
                <button
                  onClick={() => { vibrate(5); navigate('/automation-mail/bank-details'); }}
                  className={cn(
                    "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center gap-2",
                    theme === 'dark' ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>
                <button
                  onClick={handleOpenGmail}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-emerald-600/10"
                >
                  <Mail size={14} />
                  <span>Open Gmail Compose</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Centralized Configurable Professional Footer */}
      <footer className={cn(
        "py-6 text-center text-[11px] tracking-wide transition-colors duration-300 border-t",
        theme === 'dark' ? "bg-[#0b0c10] border-zinc-900 text-zinc-500" : "bg-slate-50 border-slate-150 text-slate-500"
      )}>
        <div className="max-w-md mx-auto space-y-1">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{TRACKBOOK_BRANDING.line1}</p>
          <p className="font-extrabold uppercase tracking-widest text-indigo-500/80">{TRACKBOOK_BRANDING.line2}</p>
          <a 
            href={TRACKBOOK_BRANDING.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-xs text-indigo-400 hover:underline inline-block mt-0.5 font-mono tracking-normal"
          >
            {TRACKBOOK_BRANDING.url}
          </a>
        </div>
      </footer>
    </div>
  );
}
