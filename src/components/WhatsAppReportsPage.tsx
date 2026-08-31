import React from 'react';
import {
  ArrowLeft,
  Construction,
  Sparkles,
  CheckCircle2,
  Clock,
  MessageSquare,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { cn } from '../lib/utils';

interface WhatsAppReportsPageProps {
  cashbookName: string;
  theme: 'light' | 'dark';
  onBack: () => void;
}

export function WhatsAppReportsPage({
  cashbookName,
  theme,
  onBack
}: WhatsAppReportsPageProps) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4 sm:py-6 px-4 pb-20 animate-in fade-in duration-200">
      {/* Top Navigation Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-xs cursor-pointer active:scale-95",
            theme === 'dark'
              ? "bg-zinc-900 border-zinc-800 text-slate-300 hover:bg-zinc-800 hover:text-white"
              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-black"
          )}
        >
          <ArrowLeft size={15} />
          <span>Back to Reports</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded tracking-wider">
            UNDER CONSTRUCTION
          </span>
          <span className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 hidden sm:inline">
            WhatsApp Reports
          </span>
        </div>
      </div>

      {/* Main Under Construction Board */}
      <div className="space-y-4">
        {/* Banner Card */}
        <div className={cn(
          "p-5 sm:p-6 rounded-3xl border flex flex-col sm:flex-row items-start gap-4 relative overflow-hidden shadow-sm",
          theme === 'dark'
            ? "bg-zinc-950 border-amber-900/40 text-amber-200"
            : "bg-amber-50/70 border-amber-200/90 text-amber-950"
        )}>
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Construction size={24} className="stroke-[2.2]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-xs">
                Under Construction
              </span>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                Feature in active development
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Automatic WhatsApp Direct Report Sharing
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium mt-1 leading-relaxed">
              We are finalizing the direct automated WhatsApp dispatch service for <strong>{cashbookName || 'your Cashbook'}</strong> reports.
            </p>
          </div>
        </div>

        {/* Build Progress Card - 89% Complete */}
        <div className={cn(
          "p-5 sm:p-6 rounded-3xl border transition-all shadow-sm space-y-4",
          theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-100"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Build Progress
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Near Completion
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">89%</span>
              <span className="text-xs font-bold text-slate-400">/ 100%</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3.5 bg-slate-100 dark:bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-emerald-500 to-emerald-600 transition-all duration-700 shadow-xs"
              style={{ width: '89%' }}
            />
          </div>

          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>89% built & verified</span>
            <span>11% remaining (API finalization)</span>
          </div>
        </div>

        {/* Feature Purpose / Explanation ("What does this feature do?") */}
        <div className={cn(
          "p-5 sm:p-6 rounded-3xl border transition-colors shadow-sm space-y-4",
          theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-100"
        )}>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles size={18} />
            </div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              What does this feature do?
            </h4>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            This feature allows you to send <strong>Excel spreadsheets (.xlsx)</strong> and <strong>official PDF statements</strong> for <strong>{cashbookName || 'your Cashbook'}</strong> directly to any client, partner, or accountant's WhatsApp number with one tap — completely bypassing manual downloads and phone saving.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className={cn(
              "p-4 rounded-2xl border space-y-1.5",
              theme === 'dark' ? "bg-zinc-900/60 border-zinc-800" : "bg-slate-50 border-slate-200/70"
            )}>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                <CheckCircle2 size={16} />
                <span>Instant Delivery</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                Directly delivers generated statements to any 10-digit WhatsApp mobile number.
              </p>
            </div>

            <div className={cn(
              "p-4 rounded-2xl border space-y-1.5",
              theme === 'dark' ? "bg-zinc-900/60 border-zinc-800" : "bg-slate-50 border-slate-200/70"
            )}>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                <CheckCircle2 size={16} />
                <span>No Manual Re-upload</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                No need to download files into device storage and attach them manually.
              </p>
            </div>

            <div className={cn(
              "p-4 rounded-2xl border space-y-1.5",
              theme === 'dark' ? "bg-zinc-900/60 border-zinc-800" : "bg-slate-50 border-slate-200/70"
            )}>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                <CheckCircle2 size={16} />
                <span>Live Status Tracking</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                Real-time delivery confirmation receipts (Sent, Delivered, and Read).
              </p>
            </div>
          </div>
        </div>

        {/* Readiness Checklist */}
        <div className={cn(
          "p-5 rounded-2xl border transition-colors shadow-sm space-y-3",
          theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-100"
        )}>
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            System Modules Readiness
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={cn(
              "p-3.5 rounded-xl border flex items-center justify-between gap-2",
              theme === 'dark' ? "bg-zinc-900/40 border-zinc-800/80" : "bg-slate-50/80 border-slate-200/60"
            )}>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <FileSpreadsheet size={16} className="text-emerald-600" />
                <span>Excel (.xlsx) Reports</span>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                100% Ready
              </span>
            </div>

            <div className={cn(
              "p-3.5 rounded-xl border flex items-center justify-between gap-2",
              theme === 'dark' ? "bg-zinc-900/40 border-zinc-800/80" : "bg-slate-50/80 border-slate-200/60"
            )}>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <FileText size={16} className="text-rose-500" />
                <span>PDF Statements</span>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                100% Ready
              </span>
            </div>

            <div className={cn(
              "p-3.5 rounded-xl border flex items-center justify-between gap-2",
              theme === 'dark' ? "bg-zinc-900/40 border-zinc-800/80" : "bg-slate-50/80 border-slate-200/60"
            )}>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Clock size={16} className="text-amber-500" />
                <span>Meta WhatsApp API</span>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                89% Built
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Actions - ONLY Back to Reports (preview flow and share via whatsapp removed) */}
        <div className="pt-2 flex items-center justify-start">
          <button
            type="button"
            onClick={onBack}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-xs cursor-pointer active:scale-95",
              theme === 'dark'
                ? "bg-zinc-900 border-zinc-800 text-slate-300 hover:bg-zinc-800 hover:text-white"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-black"
            )}
          >
            <ArrowLeft size={15} />
            <span>Back to Reports</span>
          </button>
        </div>
      </div>
    </div>
  );
}
