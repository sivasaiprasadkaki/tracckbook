import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Send, 
  MessageSquare, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FileSpreadsheet, 
  FileText, 
  ArrowLeft, 
  ShieldCheck,
  Smartphone,
  ChevronRight,
  Clock
} from 'lucide-react';
import { backgroundExportManager } from '../services/exportManager';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface ShareWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashbookId: string;
  cashbookName: string;
  filteredTransactions: any[];
  theme: 'light' | 'dark';
}

type ModalStep = 'phone' | 'select_docs' | 'confirm' | 'sending' | 'success' | 'error';
type DeliveryStatus = 'Sent' | 'Delivered' | 'Read' | 'Failed';

export function ShareWhatsAppModal({
  isOpen,
  onClose,
  cashbookId,
  cashbookName,
  filteredTransactions,
  theme
}: ShareWhatsAppModalProps) {
  const [step, setStep] = useState<ModalStep>('phone');
  const [mobileNumber, setMobileNumber] = useState('');
  const [countryCode] = useState('+91');
  
  const [selectedDocs, setSelectedDocs] = useState<{ excel: boolean; pdf: boolean }>({
    excel: true,
    pdf: true
  });

  const [isPreparing, setIsPreparing] = useState(false);
  const [preparingMessage, setPreparingMessage] = useState('Preparing reports...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorGuidance, setErrorGuidance] = useState<string | null>(null);
  const [sentDocsList, setSentDocsList] = useState<string[]>([]);
  const [formattedPhone, setFormattedPhone] = useState('');

  // Track Meta message status from backend/database
  const [liveStatus, setLiveStatus] = useState<DeliveryStatus>('Sent');
  const [sentMessageIds, setSentMessageIds] = useState<string[]>([]);

  // Clean raw digits
  const rawDigits = mobileNumber.replace(/\D/g, '');
  const isValidPhone = rawDigits.length === 10;

  const handlePhoneNext = () => {
    if (!isValidPhone) return;
    const formatted = `${countryCode} ${rawDigits.slice(0, 5)} ${rawDigits.slice(5)}`;
    setFormattedPhone(formatted);
    setStep('select_docs');
  };

  const handleDocsNext = () => {
    if (!selectedDocs.excel && !selectedDocs.pdf) return;
    setStep('confirm');
  };

  const handleShareViaWhatsAppWeb = () => {
    const cleanCountryCode = countryCode.replace(/\+/g, '').replace(/\D/g, '') || '91';
    const fullPhone = `${cleanCountryCode}${rawDigits}`;
    const docTypesText = [];
    if (selectedDocs.excel) docTypesText.push('Excel Report');
    if (selectedDocs.pdf) docTypesText.push('PDF Report');
    const docList = docTypesText.length > 0 ? docTypesText.join(' & ') : 'Report';
    const messageText = `Hello! Here is the ${docList} for ${cashbookName || 'TrackBook Cashbook'} generated on TrackBook.`;
    const waUrl = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSendWhatsApp = async () => {
    setStep('sending');
    setIsPreparing(true);
    setPreparingMessage('Preparing reports...');
    setErrorMessage(null);
    setLiveStatus('Sent');

    if (!filteredTransactions || filteredTransactions.length === 0) {
      setErrorMessage('No transactions found to export in this cashbook.');
      setStep('error');
      setIsPreparing(false);
      return;
    }

    const docTypesToSend: ('excel' | 'pdf')[] = [];
    if (selectedDocs.excel) docTypesToSend.push('excel');
    if (selectedDocs.pdf) docTypesToSend.push('pdf');

    try {
      const reportsPayload: any = {};

      // 1. Prepare Excel if selected
      if (selectedDocs.excel) {
        setPreparingMessage('Preparing Excel report from cashbook entries...');
        try {
          const excelData = await backgroundExportManager.generateExcelReportData(cashbookName, filteredTransactions);
          reportsPayload.excel = {
            fileName: excelData.fileName,
            base64: excelData.base64
          };
        } catch (excelErr: any) {
          console.error('Excel generation error:', excelErr);
          setErrorMessage(excelErr?.message || 'Excel report could not be prepared.');
          setStep('error');
          setIsPreparing(false);
          return;
        }
      }

      // 2. Prepare PDF if selected
      if (selectedDocs.pdf) {
        setPreparingMessage('Preparing PDF report with attached receipts...');
        try {
          const pdfData = await backgroundExportManager.generatePdfReportData(cashbookName, filteredTransactions, true);
          reportsPayload.pdf = {
            fileName: pdfData.fileName,
            base64: pdfData.base64
          };
        } catch (pdfErr: any) {
          console.error('PDF generation error:', pdfErr);
          setErrorMessage(pdfErr?.message || 'Unable to generate the PDF report.');
          setStep('error');
          setIsPreparing(false);
          return;
        }
      }

      // 3. Dispatch directly to Supabase Edge Function 'share-whatsapp'
      setPreparingMessage('Sending reports via WhatsApp...');

      const payload = {
        cashbookId,
        cashbookName,
        phoneNumber: `${countryCode}${rawDigits}`,
        documents: docTypesToSend,
        reports: reportsPayload
      };

      let responseData: any = null;
      let isSuccess = false;
      let errorText = 'WhatsApp service is temporarily unavailable.';
      let extractedGuidance: string | null = null;

      try {
        if (supabase && supabase.functions) {
          const { data, error } = await supabase.functions.invoke('share-whatsapp', {
            body: payload
          });

          if (!error && data && data.success) {
            responseData = data;
            isSuccess = true;
          } else {
            let errObj = data;
            if (error && error.context) {
              try {
                const ctxJson = await error.context.json();
                if (ctxJson) errObj = ctxJson;
              } catch (_) {}
            }

            if (errObj && (errObj.meta_error_code || errObj.meta_error_message || errObj.error)) {
              if (errObj.guidance) extractedGuidance = errObj.guidance;
              if (errObj.meta_error_code) {
                const codeStr = `Meta Error ${errObj.meta_error_code}`;
                const subcodeStr = errObj.meta_error_subcode && errObj.meta_error_subcode !== 'NONE' ? ` (subcode ${errObj.meta_error_subcode})` : '';
                const statusStr = errObj.http_status ? ` [HTTP ${errObj.http_status}]` : '';
                const msgStr = errObj.meta_error_message || errObj.error || 'Unknown Meta API error';
                errorText = `${codeStr}${subcodeStr}${statusStr}: ${msgStr}`;
              } else {
                errorText = errObj.error;
              }
            } else if (error && error.message) {
              errorText = error.message;
            }
          }
        }
      } catch (edgeInvokeErr: any) {
        console.warn('Direct edge function invocation error:', edgeInvokeErr);
      }

      // Fallback via Express backend proxy if direct invoke did not return success
      if (!isSuccess && !responseData) {
        const response = await fetch('/api/reports/share-whatsapp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success) {
          responseData = data;
          isSuccess = true;
        } else if (data) {
          if (data.guidance) extractedGuidance = data.guidance;
          if (data.meta_error_code || data.meta_error_message) {
            const codeStr = `Meta Error ${data.meta_error_code || ''}`;
            const subcodeStr = data.meta_error_subcode && data.meta_error_subcode !== 'NONE' ? ` (subcode ${data.meta_error_subcode})` : '';
            const statusStr = data.http_status ? ` [HTTP ${data.http_status}]` : '';
            const msgStr = data.meta_error_message || data.error || 'Unknown Meta API error';
            errorText = `${codeStr}${subcodeStr}${statusStr}: ${msgStr}`;
          } else if (data.error) {
            errorText = data.error;
          }
        }
      }

      if (!isSuccess || !responseData) {
        const isAuthError = errorText.includes('190') || errorText.includes('401') || errorText.toLowerCase().includes('authentication error') || errorText.toLowerCase().includes('oauthexception');
        if (!extractedGuidance && isAuthError) {
          extractedGuidance = "WHATSAPP_ACCESS_TOKEN in Supabase Secrets is invalid, expired, or revoked. Please generate a fresh Permanent System User Access Token in Meta Developer Console -> System Users with 'whatsapp_business_messaging' permission, then update WHATSAPP_ACCESS_TOKEN in Supabase Secrets. You can also click 'Share via WhatsApp Web' below to send the report message directly.";
        }
        setErrorMessage(errorText);
        setErrorGuidance(extractedGuidance);
        setStep('error');
        setIsPreparing(false);
        return;
      }

      // 4. Handle success response from Meta acceptance
      const sentNames: string[] = [];
      if (selectedDocs.excel) sentNames.push('Excel Report');
      if (selectedDocs.pdf) sentNames.push('PDF Report');

      setSentDocsList(sentNames);
      setLiveStatus('Sent'); // Meta acceptance status is 'Sent', not 'Delivered'

      const msgIds = (responseData.results || responseData.documentsSent || []).map((r: any) => r.messageId).filter(Boolean);
      setSentMessageIds(msgIds);

      setStep('success');
      setIsPreparing(false);

    } catch (err: any) {
      console.error('WhatsApp Dispatch Catch Error:', err);
      setErrorMessage(err.message || 'WhatsApp service is temporarily unavailable.');
      setStep('error');
      setIsPreparing(false);
    }
  };

  // Poll database for real-time delivery webhook updates on message_id
  useEffect(() => {
    if (!isOpen || step !== 'success' || sentMessageIds.length === 0 || !supabase) return;

    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('whatsapp_messages')
          .select('status, error_message')
          .in('message_id', sentMessageIds);

        if (data && data.length > 0) {
          const statuses = data.map(d => (d.status || '').toLowerCase());
          if (statuses.includes('failed')) {
            setLiveStatus('Failed');
          } else if (statuses.includes('read')) {
            setLiveStatus('Read');
          } else if (statuses.includes('delivered')) {
            setLiveStatus('Delivered');
          }
        }
      } catch (err) {
        // quiet status check catch
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, step, sentMessageIds]);

  const handleResetAndClose = () => {
    setStep('phone');
    setMobileNumber('');
    setSelectedDocs({ excel: true, pdf: true });
    setErrorMessage(null);
    setLiveStatus('Sent');
    setSentMessageIds([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className={cn(
            "w-full max-w-md rounded-2xl border shadow-xl overflow-hidden flex flex-col transition-colors",
            theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
          )}
        >
          {/* Top Header Bar */}
          <div className={cn(
            "px-6 py-4 border-b flex items-center justify-between",
            theme === 'dark' ? "border-zinc-800 bg-zinc-900/50" : "border-slate-100 bg-slate-50/50"
          )}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <MessageSquare size={18} />
              </div>
              <div>
                <h3 className="font-bold text-base leading-tight">Share Reports via WhatsApp</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {cashbookName || 'Current Cashbook'}
                </p>
              </div>
            </div>

            <button
              onClick={handleResetAndClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            {/* STEP 1: Phone Number */}
            {step === 'phone' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Enter Mobile Number
                  </label>
                  
                  <div className="flex items-center gap-2">
                    {/* Country Code Badge */}
                    <div className={cn(
                      "px-3 py-2.5 rounded-xl border font-semibold text-sm flex items-center gap-1.5 shrink-0 select-none",
                      theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"
                    )}>
                      <span className="text-base">🇮🇳</span>
                      <span>{countryCode}</span>
                    </div>

                    {/* Number Input */}
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Smartphone size={16} />
                      </div>
                      <input
                        type="tel"
                        maxLength={10}
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="10-digit Mobile Number"
                        autoFocus
                        className={cn(
                          "w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all",
                          theme === 'dark'
                            ? "bg-zinc-900/80 border-zinc-800 text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                            : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                        )}
                      />
                    </div>
                  </div>
                  
                  {mobileNumber.length > 0 && !isValidPhone && (
                    <p className="text-xs text-amber-500 font-medium mt-1.5">
                      Please enter a valid 10-digit mobile number.
                    </p>
                  )}
                </div>

                <div className={cn(
                  "p-3.5 rounded-xl border text-xs flex items-start gap-2.5",
                  theme === 'dark' ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-300" : "bg-emerald-50/80 border-emerald-100 text-emerald-800"
                )}>
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Users are already authenticated in TrackBook. No OTP or mobile number verification is required.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    onClick={handleResetAndClose}
                    className={cn(
                      "px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors",
                      theme === 'dark' ? "hover:bg-zinc-900 text-slate-400" : "hover:bg-slate-100 text-slate-600"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePhoneNext}
                    disabled={!isValidPhone}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer",
                      isValidPhone 
                        ? "bg-emerald-600 hover:bg-emerald-700 active:scale-95" 
                        : "bg-slate-300 dark:bg-zinc-800 text-slate-500 dark:text-zinc-600 cursor-not-allowed opacity-60"
                    )}
                  >
                    <span>Next</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Document Selection */}
            {step === 'select_docs' && (
              <div className="space-y-5">
                <div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">Select Documents</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Choose which existing reports to send to <span className="font-semibold text-slate-700 dark:text-slate-300">{formattedPhone}</span>.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Option 1: Excel */}
                  <div
                    onClick={() => setSelectedDocs(prev => ({ ...prev, excel: !prev.excel }))}
                    className={cn(
                      "p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none",
                      selectedDocs.excel
                        ? theme === 'dark'
                          ? "bg-emerald-950/20 border-emerald-600 text-white"
                          : "bg-emerald-50/60 border-emerald-500 text-slate-900"
                        : theme === 'dark'
                          ? "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700"
                          : "bg-white border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                      selectedDocs.excel
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : theme === 'dark' ? "border-zinc-700 bg-zinc-800" : "border-slate-300 bg-white"
                    )}>
                      {selectedDocs.excel && <Check size={13} strokeWidth={3} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet size={16} className="text-emerald-600" />
                        <span className="font-bold text-sm">Excel Report</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        Full spreadsheet with entries, categories, payment modes, and totals.
                      </p>
                    </div>
                  </div>

                  {/* Option 2: PDF */}
                  <div
                    onClick={() => setSelectedDocs(prev => ({ ...prev, pdf: !prev.pdf }))}
                    className={cn(
                      "p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none",
                      selectedDocs.pdf
                        ? theme === 'dark'
                          ? "bg-emerald-950/20 border-emerald-600 text-white"
                          : "bg-emerald-50/60 border-emerald-500 text-slate-900"
                        : theme === 'dark'
                          ? "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700"
                          : "bg-white border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                      selectedDocs.pdf
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : theme === 'dark' ? "border-zinc-700 bg-zinc-800" : "border-slate-300 bg-white"
                    )}>
                      {selectedDocs.pdf && <Check size={13} strokeWidth={3} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-rose-600" />
                        <span className="font-bold text-sm">PDF Report</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        Formatted document with cashbook summary and attached receipts.
                      </p>
                    </div>
                  </div>
                </div>

                {!selectedDocs.excel && !selectedDocs.pdf && (
                  <p className="text-xs text-amber-500 font-medium">
                    Please select at least one document type to proceed.
                  </p>
                )}

                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={() => setStep('phone')}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer",
                      theme === 'dark' ? "hover:bg-zinc-900 text-slate-400" : "hover:bg-slate-100 text-slate-600"
                    )}
                  >
                    <ArrowLeft size={14} />
                    <span>Back</span>
                  </button>

                  <button
                    onClick={handleDocsNext}
                    disabled={!selectedDocs.excel && !selectedDocs.pdf}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer",
                      selectedDocs.excel || selectedDocs.pdf
                        ? "bg-emerald-600 hover:bg-emerald-700 active:scale-95"
                        : "bg-slate-300 dark:bg-zinc-800 text-slate-500 cursor-not-allowed opacity-60"
                    )}
                  >
                    <span>Next</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Confirm */}
            {step === 'confirm' && (
              <div className="space-y-5">
                <div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">Ready to Share</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Review delivery details before dispatching to WhatsApp.
                  </p>
                </div>

                <div className={cn(
                  "p-4 rounded-xl border space-y-3",
                  theme === 'dark' ? "bg-zinc-900/60 border-zinc-800" : "bg-slate-50 border-slate-200"
                )}>
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200 dark:border-zinc-800">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Recipient Mobile</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{formattedPhone}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200 dark:border-zinc-800">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Cashbook</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{cashbookName}</span>
                  </div>

                  <div className="text-xs space-y-1.5 pt-1">
                    <span className="text-slate-500 dark:text-slate-400 font-medium block">Documents to Attach:</span>
                    <div className="space-y-1">
                      {selectedDocs.excel && (
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                          <Check size={14} />
                          <span>Excel Report (.xlsx)</span>
                        </div>
                      )}
                      {selectedDocs.pdf && (
                        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-semibold">
                          <Check size={14} />
                          <span>PDF Report (.pdf)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={() => setStep('select_docs')}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer",
                      theme === 'dark' ? "hover:bg-zinc-900 text-slate-400" : "hover:bg-slate-100 text-slate-600"
                    )}
                  >
                    <ArrowLeft size={14} />
                    <span>Back</span>
                  </button>

                  <button
                    onClick={handleSendWhatsApp}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Send size={14} />
                    <span>Send via WhatsApp</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Sending / Progress */}
            {step === 'sending' && (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                    <Loader2 size={28} className="animate-spin" />
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-base text-slate-800 dark:text-slate-100">Sending Reports via WhatsApp</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs mx-auto animate-pulse">
                    {preparingMessage}
                  </p>
                </div>
              </div>
            )}

            {/* STEP 5: Success */}
            {step === 'success' && (
              <div className="py-4 space-y-5 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 size={32} />
                </div>

                <div>
                  <h4 className="font-bold text-base text-slate-800 dark:text-slate-100">
                    Reports sent successfully via WhatsApp.
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Sent to <span className="font-bold text-slate-700 dark:text-slate-300">{formattedPhone}</span>
                  </p>
                </div>

                <div className={cn(
                  "p-3.5 rounded-xl border text-xs text-left space-y-2",
                  theme === 'dark' ? "bg-zinc-900/60 border-zinc-800" : "bg-slate-50 border-slate-200"
                )}>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Documents Sent:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{sentDocsList.join(', ')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">Delivery Status:</span>
                    <div className="flex items-center gap-1.5 font-semibold">
                      {liveStatus === 'Sent' && (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Clock size={13} />
                          <span>Sent (Awaiting Webhook)</span>
                        </span>
                      )}
                      {liveStatus === 'Delivered' && (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={13} />
                          <span>Delivered</span>
                        </span>
                      )}
                      {liveStatus === 'Read' && (
                        <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <CheckCircle2 size={13} />
                          <span>Read</span>
                        </span>
                      )}
                      {liveStatus === 'Failed' && (
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          <AlertCircle size={13} />
                          <span>Failed</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleResetAndClose}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}

            {/* STEP 6: Error */}
            {step === 'error' && (
              <div className="py-4 space-y-5 text-center">
                <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 mx-auto flex items-center justify-center">
                  <AlertCircle size={28} />
                </div>

                <div>
                  <h4 className="font-bold text-base text-slate-800 dark:text-slate-100">
                    Unable to Share Reports
                  </h4>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-1 max-w-xs mx-auto leading-relaxed">
                    {errorMessage || 'WhatsApp service is temporarily unavailable.'}
                  </p>
                </div>

                {errorGuidance && (
                  <div className={cn(
                    "p-3.5 rounded-xl border text-xs text-left space-y-2",
                    theme === 'dark' ? "bg-amber-950/30 border-amber-800/60 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-900"
                  )}>
                    <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-xs">
                      <AlertCircle size={15} />
                      <span>Meta Token Resolution Required:</span>
                    </div>
                    <p className="leading-relaxed opacity-95 text-[11px]">
                      {errorGuidance}
                    </p>
                    <div className="pt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      💡 Tip: Click <strong>"Share via WhatsApp Web"</strong> below to send the report message directly now.
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                  <button
                    onClick={() => setStep('confirm')}
                    className={cn(
                      "w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer",
                      theme === 'dark' ? "bg-zinc-900 hover:bg-zinc-800 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    )}
                  >
                    Back
                  </button>

                  <button
                    onClick={handleShareViaWhatsAppWeb}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Send size={13} />
                    <span>Share via WhatsApp Web</span>
                  </button>

                  <button
                    onClick={handleSendWhatsApp}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xs cursor-pointer"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
