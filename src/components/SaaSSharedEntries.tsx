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
import { InAppSelect } from './InAppSelect';

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
      <div className="border-b pb-4 border-zinc-150 dark:border-zinc-800">
        <h2 className={cn("text-lg font-semibold tracking-tight", theme === 'dark' ? "text-zinc-100" : "text-zinc-900")}>
          Secure Sharing & Synchronization Hub
        </h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 font-normal mt-0.5">
          Generate secure, read-only sync codes to collaborate with accountants, clients, or remote team members.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Left Side: Create a Share Code (1 col) */}
        <div className="md:col-span-1">
          <form 
            onSubmit={handleCreateShareCode}
            className={cn(
              "p-5 rounded-sm border space-y-4 shadow-sm",
              theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
            )}
          >
            <div className="flex items-center gap-2 mb-2 border-b pb-2 border-zinc-150 dark:border-zinc-800">
              <Share2 size={16} className="text-emerald-500" />
              <h3 className={cn("text-xs font-semibold uppercase tracking-wider", theme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>
                Generate Sync Code
              </h3>
            </div>

            {/* Select Book */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400 dark:text-zinc-500">
                Select Cashbook
              </label>
              <InAppSelect
                id="shared-entries-cashbook-select"
                value={selectedBookId}
                onChange={(val) => setSelectedBookId(val)}
                options={[
                  { value: '', label: '-- Select Cashbook --' },
                  ...books.map(b => ({ value: b.id, label: b.name }))
                ]}
                theme={theme}
                size="md"
                triggerClassName={cn(
                  "w-full px-3 py-2 text-xs rounded-sm border outline-none font-semibold",
                  theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-850"
                )}
              />
            </div>

            {/* Select Expiry */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400 dark:text-zinc-500">
                Code Expiry Duration
              </label>
              <InAppSelect
                id="shared-entries-expiry-select"
                value={expiryHours}
                onChange={(val) => setExpiryHours(val)}
                options={[
                  { value: '2', label: '2 Hours (Highly Secure)' },
                  { value: '24', label: '24 Hours' },
                  { value: '48', label: '48 Hours' },
                  { value: '168', label: '7 Days' },
                ]}
                theme={theme}
                size="md"
                triggerClassName={cn(
                  "w-full px-3 py-2 text-xs rounded-sm border outline-none font-semibold",
                  theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-850"
                )}
              />
            </div>

            <button
              type="submit"
              disabled={!selectedBookId}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-[0.99] duration-100"
            >
              <Plus size={14} />
              Generate Sync Link
            </button>
          </form>
        </div>

        {/* Right Side: Shared Links & Code Sync logs (2 cols) */}
        <div className="md:col-span-2 space-y-4">
          <h3 className={cn("text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500")}>
            Active Shared Channels & Codes ({sharedLinks.length})
          </h3>

          <div className="space-y-3.5">
            {sharedLinks.map((item) => {
              const isActive = item.status === 'active';
              return (
                <div
                  key={item.id}
                  className={cn(
                    "p-4 rounded-sm border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-semibold relative overflow-hidden transition-colors duration-200",
                    theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                  )}
                >
                  {/* Status indicator bar inside card */}
                  <span className={cn(
                    "absolute left-0 top-0 bottom-0 w-1",
                    isActive ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-800"
                  )} />

                  <div className="space-y-1.5 pl-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm tracking-widest bg-zinc-100 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 px-2 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-800">
                        {item.code}
                      </span>
                      <button
                        onClick={() => handleCopyCode(item.code)}
                        className="text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                        title="Copy Sync Code"
                      >
                        {copiedCode === item.code ? <Check size={13} strokeWidth={3} className="text-emerald-500" /> : <Copy size={13} />}
                      </button>
                    </div>

                    <p className={cn("font-semibold truncate", theme === 'dark' ? "text-zinc-250" : "text-zinc-800")}>
                      Workspace: {item.bookName} • {item.entriesCount} entries
                    </p>

                    <div className="flex items-center gap-1.5 text-[10.5px] text-zinc-400 dark:text-zinc-500 font-normal mt-1">
                      <Clock size={12} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
                      {isActive ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          Expires: {item.expiresAt}
                        </span>
                      ) : (
                        <span className="text-rose-500 font-bold uppercase tracking-wide">
                          Expired
                        </span>
                      )}
                      <span className="text-zinc-300 dark:text-zinc-800">•</span>
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
                          "p-2 rounded-sm border hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer",
                          theme === 'dark' ? "border-zinc-800 text-zinc-450 hover:text-emerald-400 hover:border-emerald-500" : "border-zinc-200 text-zinc-600 hover:text-emerald-600 hover:border-emerald-500"
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
                          "p-2 rounded-sm border hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer",
                          theme === 'dark' ? "border-zinc-800 text-zinc-450 hover:text-emerald-400 hover:border-emerald-500" : "border-zinc-200 text-zinc-600 hover:text-emerald-600 hover:border-emerald-500"
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
                          "p-2 rounded-sm border hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer",
                          theme === 'dark' ? "border-zinc-800 text-zinc-450 hover:text-emerald-400 hover:border-emerald-500" : "border-zinc-200 text-zinc-600 hover:text-emerald-600 hover:border-emerald-500"
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
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className={cn(
                "p-6 rounded-sm border max-w-sm w-full z-10 text-center space-y-4 shadow-2xl relative",
                theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-800"
              )}
            >
              <h4 className="text-sm font-semibold">TrackBook Sync QR Code</h4>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">Scan this code using an employee or secondary mobile camera to pull live synchronized transaction histories instantly.</p>
              
              {/* Premium Vector mock QR code visual */}
              <div className="w-48 h-48 bg-white border border-zinc-200 rounded-sm mx-auto flex items-center justify-center relative p-3">
                <div className="grid grid-cols-5 gap-1.5 w-full h-full opacity-90">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "rounded-sm",
                        (i % 3 === 0 || i % 7 === 0 || i < 5 || i > 20) ? "bg-zinc-900" : "bg-zinc-100"
                      )} 
                    />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-emerald-600 text-white w-9 h-9 rounded-sm flex items-center justify-center font-bold text-xs shadow">
                    TB
                  </div>
                </div>
              </div>

              <span className="text-xs font-semibold tracking-widest block font-mono bg-zinc-100 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 py-1.5 rounded-sm border border-zinc-200 dark:border-zinc-850">
                {activeQrCode}
              </span>

              <button
                onClick={() => { vibrate(10); setActiveQrCode(null); }}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-sm cursor-pointer"
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
