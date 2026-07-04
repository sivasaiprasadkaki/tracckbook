import React, { useState } from 'react';
import { 
  Share2, 
  Clock, 
  Copy, 
  QrCode, 
  Mail, 
  MessageSquare, 
  Check, 
  Plus, 
  BookOpen, 
  AlertCircle, 
  Users,
  DownloadCloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, vibrate } from '../lib/utils';

interface SaaSSharedEntriesProps {
  theme: 'light' | 'dark';
  books: any[];
}

export default function SaaSSharedEntries({
  theme,
  books,
}: SaaSSharedEntriesProps) {

  const [selectedBookId, setSelectedBookId] = useState('');
  const [expiryHours, setExpiryHours] = useState('48');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeQrCode, setActiveQrCode] = useState<string | null>(null);

  // Active Shared Links History State
  const [sharedLinks, setSharedLinks] = useState([
    { id: 'S1', code: 'TBX_84F93', bookName: 'HQ Petty Cash', entriesCount: 14, createdAt: '2026-06-28', expiresAt: '2026-06-30 18:00', status: 'active', visits: 3 },
    { id: 'S2', code: 'TBX_20D11', bookName: 'Consulting Revenue', entriesCount: 38, createdAt: '2026-06-25', expiresAt: '2026-06-27 12:00', status: 'expired', visits: 12 }
  ]);

  const handleCreateShareCode = (e: React.FormEvent) => {
    e.preventDefault();
    vibrate(15);
    if (!selectedBookId) return;

    const matchedBook = books.find(b => b.id === selectedBookId);
    const code = `TBX_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    
    const newLink = {
      id: 'S_' + Date.now(),
      code,
      bookName: matchedBook?.name || "Shared Cashbook",
      entriesCount: matchedBook?.transactions?.length || 0,
      createdAt: new Date().toISOString().split('T')[0],
      expiresAt: new Date(Date.now() + parseInt(expiryHours) * 60 * 60 * 1000).toLocaleString(),
      status: 'active',
      visits: 0
    };

    setSharedLinks([newLink, ...sharedLinks]);
    setSelectedBookId('');
  };

  const handleCopyCode = (code: string) => {
    vibrate(10);
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      
      {/* Header section */}
      <div className="border-b pb-4 border-slate-100 dark:border-zinc-900">
        <h2 className={cn("text-lg font-extrabold tracking-tight", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>
          Secure Sharing & Synchronization Hub
        </h2>
        <p className="text-xs text-slate-400 font-semibold mt-0.5">
          Generate secure, read-only sync codes to collaborate with accountants, clients, or remote team members.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Left Side: Create a Share Code (1 col) */}
        <div className="md:col-span-1">
          <form 
            onSubmit={handleCreateShareCode}
            className={cn(
              "p-5 rounded-2xl border space-y-4 shadow-sm",
              theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
            )}
          >
            <div className="flex items-center gap-2 mb-2 border-b pb-2 border-slate-100 dark:border-zinc-900">
              <Share2 size={16} className="text-indigo-500" />
              <h3 className={cn("text-xs font-bold uppercase tracking-wider", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>
                Generate Sync Code
              </h3>
            </div>

            {/* Select Book */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-zinc-500">
                Select Cashbook
              </label>
              <select
                required
                value={selectedBookId}
                onChange={(e) => setSelectedBookId(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 text-xs rounded-xl border outline-none font-bold",
                  theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-850"
                )}
              >
                <option value="">-- Select Cashbook --</option>
                {books.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Select Expiry */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-zinc-500">
                Code Expiry Duration
              </label>
              <select
                value={expiryHours}
                onChange={(e) => setExpiryHours(e.target.value)}
                className={cn(
                  "w-full px-3 py-2 text-xs rounded-xl border outline-none font-bold",
                  theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-850"
                )}
              >
                <option value="2">2 Hours (Highly Secure)</option>
                <option value="24">24 Hours</option>
                <option value="48">48 Hours</option>
                <option value="168">7 Days</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={!selectedBookId}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-98 duration-100"
            >
              <Plus size={14} />
              Generate Sync Link
            </button>
          </form>
        </div>

        {/* Right Side: Shared Links & Code Sync logs (2 cols) */}
        <div className="md:col-span-2 space-y-4">
          <h3 className={cn("text-xs font-black uppercase tracking-widest text-slate-400", theme === 'dark' ? "text-zinc-500" : "text-slate-400")}>
            Active Shared Channels & Codes ({sharedLinks.length})
          </h3>

          <div className="space-y-3.5">
            {sharedLinks.map((item) => {
              const isActive = item.status === 'active';
              return (
                <div
                  key={item.id}
                  className={cn(
                    "p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-semibold relative overflow-hidden transition-colors duration-200",
                    theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
                  )}
                >
                  {/* Status indicator bar inside card */}
                  <span className={cn(
                    "absolute left-0 top-0 bottom-0 w-1",
                    isActive ? "bg-indigo-600" : "bg-slate-300 dark:bg-zinc-800"
                  )} />

                  <div className="space-y-1.5 pl-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm tracking-widest bg-slate-100 text-slate-800 dark:bg-zinc-900 dark:text-slate-200 px-2 py-0.5 rounded border border-slate-150 dark:border-zinc-800">
                        {item.code}
                      </span>
                      <button
                        onClick={() => handleCopyCode(item.code)}
                        className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                        title="Copy Sync Code"
                      >
                        {copiedCode === item.code ? <Check size={13} strokeWidth={3} className="text-emerald-500" /> : <Copy size={13} />}
                      </button>
                    </div>

                    <p className={cn("font-bold truncate", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>
                      Workspace: {item.bookName} • {item.entriesCount} entries
                    </p>

                    <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 font-bold mt-1">
                      <Clock size={12} className="text-slate-400 shrink-0" />
                      {isActive ? (
                        <span className="text-amber-600 dark:text-amber-400">
                          Expires: {item.expiresAt}
                        </span>
                      ) : (
                        <span className="text-rose-500 font-extrabold uppercase tracking-wide">
                          Expired
                        </span>
                      )}
                      <span className="text-slate-300 dark:text-zinc-800">•</span>
                      <span>{item.visits} imports made</span>
                    </div>
                  </div>

                  {/* Shared actions row */}
                  {isActive && (
                    <div className="flex items-center gap-1.5 sm:justify-end shrink-0 pl-2 sm:pl-0" onClick={(e) => e.stopPropagation()}>
                      {/* QR Button */}
                      <button
                        onClick={() => { vibrate(10); setActiveQrCode(item.code); }}
                        className={cn(
                          "p-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer",
                          theme === 'dark' ? "border-zinc-800 text-slate-400" : "border-slate-150 text-slate-600"
                        )}
                        title="Show QR Code"
                      >
                        <QrCode size={13} />
                      </button>

                      {/* WhatsApp link */}
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Here is my verified TrackBook cashflow ledger sync code: ${item.code}. Import it at TrackBook Pro.`)}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => vibrate(10)}
                        className={cn(
                          "p-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer",
                          theme === 'dark' ? "border-zinc-800 text-slate-400" : "border-slate-150 text-slate-600"
                        )}
                        title="Share on WhatsApp"
                      >
                        <MessageSquare size={13} />
                      </a>

                      {/* Email link */}
                      <a
                        href={`mailto:?subject=${encodeURIComponent(`TrackBook Ledger Sync Code`)}&body=${encodeURIComponent(`Verified Sync Code: ${item.code}`)}`}
                        onClick={() => vibrate(10)}
                        className={cn(
                          "p-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer",
                          theme === 'dark' ? "border-zinc-800 text-slate-400" : "border-slate-150 text-slate-600"
                        )}
                        title="Send via Email"
                      >
                        <Mail size={13} />
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* QR Code Modal dialog overlay */}
      <AnimatePresence>
        {activeQrCode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActiveQrCode(null)} />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={cn(
                "p-6 rounded-2xl border max-w-sm w-full z-10 text-center space-y-4 shadow-2xl relative",
                theme === 'dark' ? "bg-zinc-950 border-zinc-900 text-white" : "bg-white border-slate-200 text-slate-800"
              )}
            >
              <h4 className="text-sm font-extrabold">TrackBook Sync QR Code</h4>
              <p className="text-xs text-slate-400">Scan this code using an employee or secondary mobile camera to pull live synchronized transaction histories instantly.</p>
              
              {/* Premium Vector mock QR code visual */}
              <div className="w-48 h-48 bg-white border border-slate-150 rounded-xl mx-auto flex items-center justify-center relative p-3">
                <div className="grid grid-cols-5 gap-1.5 w-full h-full opacity-90">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "rounded",
                        (i % 3 === 0 || i % 7 === 0 || i < 5 || i > 20) ? "bg-slate-900" : "bg-slate-100"
                      )} 
                    />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-indigo-600 text-white w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shadow">
                    TB
                  </div>
                </div>
              </div>

              <span className="text-xs font-black tracking-widest block font-mono bg-slate-100 text-slate-800 dark:bg-zinc-900 dark:text-zinc-200 py-1.5 rounded-lg border">
                {activeQrCode}
              </span>

              <button
                onClick={() => { vibrate(10); setActiveQrCode(null); }}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Close View
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
