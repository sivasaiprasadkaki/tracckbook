import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Construction,
  Sparkles,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  MessageSquare,
  ExternalLink,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { cn, vibrate } from '../lib/utils';

interface WhatsAppReportsProps {
  session?: any;
  theme?: 'light' | 'dark';
  setTheme?: (theme: 'light' | 'dark') => void;
}

export default function WhatsAppReports({
  session,
  theme = 'light',
}: WhatsAppReportsProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams();

  // Get cashbook name from query params or route params
  const bookNameParam = searchParams.get('book') || params.bookSlug || 'Expenses';
  const cashbookName = decodeURIComponent(bookNameParam);

  // Animated progress slider: smoothly animates from 0% to 89% on every page load
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    // Reset to 0 on initial mount
    setAnimatedProgress(0);

    const targetProgress = 89;
    const duration = 1200; // 1.2s smooth ease-out
    const startTime = performance.now();

    const animateProgress = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progressRatio = Math.min(elapsed / duration, 1);
      // Smooth cubic ease-out curve
      const easeProgress = 1 - Math.pow(1 - progressRatio, 3);
      const currentVal = Math.round(easeProgress * targetProgress);
      setAnimatedProgress(currentVal);

      if (progressRatio < 1) {
        requestAnimationFrame(animateProgress);
      }
    };

    const rafId = requestAnimationFrame(animateProgress);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleBack = () => {
    vibrate();
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/cashbooks');
    }
  };

  const handleShareViaWhatsAppWeb = () => {
    vibrate();
    const messageText = `Hello! Here is the report for ${cashbookName || 'TrackBook Cashbook'} generated on TrackBook.`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-200",
      theme === 'dark' ? "bg-black text-slate-100" : "bg-slate-50 text-slate-900"
    )}>
      {/* Top Header / App Bar */}
      <header className={cn(
        "sticky top-0 z-30 border-b backdrop-blur-md transition-colors",
        theme === 'dark' ? "bg-zinc-950/80 border-zinc-900" : "bg-white/80 border-slate-200"
      )}>
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-xs cursor-pointer active:scale-95",
              theme === 'dark'
                ? "bg-zinc-900 border-zinc-800 text-slate-300 hover:bg-zinc-800 hover:text-white"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-black"
            )}
            id="btn-back-to-reports"
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[10px] font-black uppercase bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-lg tracking-wider">
              {animatedProgress}% BUILT
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 hidden sm:inline">
              WhatsApp Reports
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto py-6 px-4 pb-24 space-y-6">
        {/* Main Under Construction Banner */}
        <div className={cn(
          "p-6 rounded-3xl border flex flex-col sm:flex-row items-start gap-5 relative overflow-hidden shadow-sm transition-all",
          theme === 'dark'
            ? "bg-zinc-950 border-amber-900/40 text-amber-200"
            : "bg-amber-50/70 border-amber-200/90 text-amber-950"
        )}>
          <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
            <Construction size={28} className="stroke-[2.2]" />
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
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
              Automatic WhatsApp Direct Report Sharing
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium mt-1 leading-relaxed">
              We are finalizing the direct automated WhatsApp dispatch service for <strong>{cashbookName}</strong> reports.
            </p>
          </div>
        </div>

        {/* Build Progress Card with Smooth Animated Slider */}
        <div className={cn(
          "p-6 sm:p-7 rounded-3xl border transition-all shadow-sm space-y-5",
          theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-200/70"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Build Progress
              </span>
              <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Near Completion
              </span>
            </div>
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400">
                {animatedProgress}%
              </span>
              <span className="text-xs font-bold text-slate-400">/ 100%</span>
            </div>
          </div>

          {/* Smooth Animated Progress Slider */}
          <div className="w-full h-4 bg-slate-100 dark:bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-emerald-500 to-emerald-600 transition-all duration-75 shadow-xs"
              style={{ width: `${animatedProgress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>{animatedProgress}% built & verified</span>
            <span>{Math.max(0, 100 - animatedProgress)}% remaining (API finalization)</span>
          </div>
        </div>

        {/* Feature Purpose / Explanation ("What does this feature do?") */}
        <div className={cn(
          "p-6 sm:p-7 rounded-3xl border transition-colors shadow-sm space-y-5",
          theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-200/70"
        )}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles size={20} />
            </div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              What does this feature do?
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            This feature allows you to send <strong>Excel spreadsheets (.xlsx)</strong> and <strong>official PDF statements</strong> for <strong>{cashbookName}</strong> directly to any client, partner, or accountant's WhatsApp number with one tap — completely bypassing manual downloads and phone saving.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
            <div className={cn(
              "p-4 rounded-2xl border space-y-2",
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
              "p-4 rounded-2xl border space-y-2",
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
              "p-4 rounded-2xl border space-y-2",
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

        {/* System Modules Readiness */}
        <div className={cn(
          "p-6 rounded-3xl border transition-colors shadow-sm space-y-4",
          theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-200/70"
        )}>
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            System Modules Readiness
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={cn(
              "p-4 rounded-2xl border flex flex-col justify-between gap-2.5",
              theme === 'dark' ? "bg-zinc-900/40 border-zinc-800/80" : "bg-slate-50/80 border-slate-200/60"
            )}>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <FileSpreadsheet size={16} className="text-emerald-600 shrink-0" />
                <span className="truncate">Excel (.xlsx) Reports</span>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 self-start">
                100% Ready
              </span>
            </div>

            <div className={cn(
              "p-4 rounded-2xl border flex flex-col justify-between gap-2.5",
              theme === 'dark' ? "bg-zinc-900/40 border-zinc-800/80" : "bg-slate-50/80 border-slate-200/60"
            )}>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <FileText size={16} className="text-rose-500 shrink-0" />
                <span className="truncate">PDF Statements</span>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 self-start">
                100% Ready
              </span>
            </div>

            <div className={cn(
              "p-4 rounded-2xl border flex flex-col justify-between gap-2.5",
              theme === 'dark' ? "bg-zinc-900/40 border-zinc-800/80" : "bg-slate-50/80 border-slate-200/60"
            )}>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <MessageSquare size={16} className="text-emerald-500 shrink-0" />
                <span className="truncate">WhatsApp Web Share</span>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 self-start">
                100% Ready (Active)
              </span>
            </div>

            <div className={cn(
              "p-4 rounded-2xl border flex flex-col justify-between gap-2.5",
              theme === 'dark' ? "bg-zinc-900/40 border-zinc-800/80" : "bg-slate-50/80 border-slate-200/60"
            )}>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Clock size={16} className="text-amber-500 shrink-0" />
                <span className="truncate">Meta Cloud API</span>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 self-start">
                {animatedProgress}% Built (In Progress)
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            className={cn(
              "w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold transition-all border shadow-xs cursor-pointer active:scale-95",
              theme === 'dark'
                ? "bg-zinc-900 border-zinc-800 text-slate-300 hover:bg-zinc-800 hover:text-white"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-black"
            )}
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>

          <button
            type="button"
            onClick={handleShareViaWhatsAppWeb}
            className={cn(
              "w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95 text-white bg-emerald-600 hover:bg-emerald-700"
            )}
          >
            <MessageSquare size={16} />
            <span>Share via WhatsApp Web Now</span>
          </button>
        </div>
      </main>
    </div>
  );
}
