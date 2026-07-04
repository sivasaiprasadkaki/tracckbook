import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  Calendar, 
  Trash2, 
  Pencil, 
  Share2, 
  Copy, 
  Download, 
  ArrowRight, 
  LayoutGrid, 
  List, 
  MoreVertical, 
  Sparkles, 
  Cloud, 
  Eye, 
  Plus, 
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, vibrate } from '../lib/utils';

interface SaaSBooksListProps {
  books: any[];
  theme: 'light' | 'dark';
  onSelectBook: (id: string | null) => void;
  onRenameBook: (id: string, name: string) => void;
  onDeleteBook: (id: string) => void;
  onShareBook: (id: string) => void;
  onDuplicateBook: (id: string) => void;
  onExportBook: (id: string, format: 'pdf' | 'excel') => void;
  onCreateBookClick: () => void;
}

export default function SaaSBooksList({
  books,
  theme,
  onSelectBook,
  onRenameBook,
  onDeleteBook,
  onShareBook,
  onDuplicateBook,
  onExportBook,
  onCreateBookClick,
}: SaaSBooksListProps) {
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Close actions menu on click-outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredBooks = books.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleActionsMenu = (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    vibrate(10);
    setActiveMenuId(activeMenuId === bookId ? null : bookId);
  };

  const handleBookClick = (bookId: string) => {
    vibrate(15);
    onSelectBook(bookId);
  };

  const formatDate = (dateInput: any) => {
    if (!dateInput) return 'Not available';
    const d = new Date(dateInput);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Search and view toggle row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-100 dark:border-zinc-900">
        <div>
          <h2 className={cn(
            "text-xl font-extrabold tracking-tight",
            theme === 'dark' ? "text-slate-100" : "text-slate-900"
          )}>
            Cashbook Workspace
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Manage your individual business, corporate, and personal cashbook ledgers.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search bar inside ledger workspace */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text"
              placeholder="Search books..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-semibold",
                theme === 'dark' ? "bg-zinc-900 text-white" : "bg-slate-100 text-slate-800"
              )}
            />
          </div>

          {/* View Toggles */}
          <div className={cn(
            "flex items-center gap-1 p-1 rounded-xl border",
            theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
          )}>
            <button
              onClick={() => { vibrate(10); setViewMode('grid'); }}
              className={cn(
                "p-1.5 rounded-lg transition-all cursor-pointer",
                viewMode === 'grid' 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              )}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => { vibrate(10); setViewMode('list'); }}
              className={cn(
                "p-1.5 rounded-lg transition-all cursor-pointer",
                viewMode === 'list' 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              )}
            >
              <List size={15} />
            </button>
          </div>

          <button
            onClick={onCreateBookClick}
            className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 duration-150"
          >
            <Plus size={14} />
            Add Book
          </button>
        </div>
      </div>

      {/* Main ledger list body */}
      {filteredBooks.length === 0 ? (
        <div className={cn(
          "flex flex-col items-center justify-center py-16 text-center border rounded-2xl p-6",
          theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
        )}>
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
            <BookOpen size={22} />
          </div>
          <h3 className={cn("text-base font-bold", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>
            No Cashbooks Found
          </h3>
          <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
            Create your first financial ledger cashbook to start tracking expenses, importing receipts, and compiling tax-ready PDF reports.
          </p>
          <button
            onClick={onCreateBookClick}
            className="mt-4 py-2 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Create Cashbook
          </button>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {viewMode === 'list' ? (
            /* PROFESSIONAL LIST VIEW TABLE */
            <motion.div
              key="list-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                "border rounded-2xl overflow-hidden shadow-sm transition-colors duration-300",
                theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
              )}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={cn(
                      "border-b text-[10.5px] uppercase font-extrabold tracking-wider text-slate-400 dark:text-zinc-500",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-slate-50/50 border-slate-150"
                    )}>
                      <th className="py-3 px-4">Book Name</th>
                      <th className="py-3 px-4">Entries</th>
                      <th className="py-3 px-4">Net Balance</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4">AI Scan</th>
                      <th className="py-3 px-4">Cloud Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-900">
                    {filteredBooks.map((book) => {
                      const transactions = book.transactions || [];
                      const entriesCount = transactions.length;
                      
                      const bookIn = transactions.filter((t: any) => t.type === 'in').reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
                      const bookOut = transactions.filter((t: any) => t.type === 'out').reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
                      const bookBalance = bookIn - bookOut;

                      const hasAi = transactions.some((t: any) => t.isAi || t.source === 'AI');
                      const isShared = transactions.some((t: any) => t.imported_from_share_code);

                      return (
                        <tr 
                          key={book.id}
                          onClick={() => handleBookClick(book.id)}
                          className={cn(
                            "group text-xs transition-colors duration-150 cursor-pointer",
                            theme === 'dark' ? "hover:bg-zinc-900/40" : "hover:bg-slate-50/40"
                          )}
                        >
                          {/* Name & Icon */}
                          <td className="py-3.5 px-4 font-bold">
                            <div className="flex items-center gap-3 min-w-[150px]">
                              <div className={cn(
                                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-colors duration-200",
                                theme === 'dark' 
                                  ? "bg-zinc-900 border-zinc-800 text-indigo-400 group-hover:border-indigo-500" 
                                  : "bg-indigo-50/50 border-indigo-100 text-indigo-600 group-hover:border-indigo-400"
                              )}>
                                <BookOpen size={13} />
                              </div>
                              <span className={cn(
                                "truncate text-slate-850 dark:text-slate-200 font-extrabold group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors",
                              )}>
                                {book.name}
                              </span>
                              {isShared && (
                                <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400 border border-purple-100 dark:border-purple-900/20">
                                  Shared
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Entries Count */}
                          <td className="py-3.5 px-4 font-semibold text-slate-500 dark:text-zinc-400">
                            {entriesCount} entries
                          </td>

                          {/* Net Balance */}
                          <td className="py-3.5 px-4 font-extrabold text-slate-850 dark:text-slate-250">
                            <span className={cn(
                              bookBalance < 0 && "text-rose-600"
                            )}>
                              {formatCurrency(bookBalance)}
                            </span>
                          </td>

                          {/* Created date */}
                          <td className="py-3.5 px-4 text-slate-400 dark:text-zinc-500 font-medium">
                            {formatDate(book.createdAt)}
                          </td>

                          {/* AI status badge */}
                          <td className="py-3.5 px-4">
                            {hasAi ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/20">
                                <Sparkles size={10} />
                                Active
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium text-[10px]">—</span>
                            )}
                          </td>

                          {/* Cloud Sync Status */}
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <Cloud size={12} />
                              Synced
                            </span>
                          </td>

                          {/* Actions overflow */}
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Quick primary CTA */}
                              <button
                                onClick={() => handleBookClick(book.id)}
                                className={cn(
                                  "p-1.5 rounded-lg border transition-all hover:bg-indigo-600 hover:text-white cursor-pointer active:scale-95 duration-100",
                                  theme === 'dark' ? "border-zinc-800 text-slate-400" : "border-slate-200 text-slate-500"
                                )}
                                title="Open Book"
                              >
                                <Eye size={12.5} />
                              </button>

                              <div className="relative">
                                <button
                                  onClick={(e) => toggleActionsMenu(e, book.id)}
                                  className={cn(
                                    "p-1.5 rounded-lg border transition-all hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer",
                                    theme === 'dark' ? "border-zinc-800 text-slate-400" : "border-slate-200 text-slate-500"
                                  )}
                                >
                                  <MoreVertical size={13} />
                                </button>
                                
                                <AnimatePresence>
                                  {activeMenuId === book.id && (
                                    <motion.div
                                      ref={actionMenuRef}
                                      initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                      className={cn(
                                        "absolute right-0 mt-1.5 w-44 rounded-xl shadow-xl border p-1 z-50 transition-colors duration-200 text-left backdrop-blur-md",
                                        theme === 'dark' ? "bg-zinc-950/95 border-zinc-900 text-white" : "bg-white/95 border-slate-200 text-slate-850"
                                      )}
                                    >
                                      <button 
                                        onClick={() => { setActiveMenuId(null); onRenameBook(book.id, book.name); }}
                                        className="w-full flex items-center gap-2 p-2 rounded-lg text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-zinc-900 cursor-pointer"
                                      >
                                        <Pencil size={12} className="text-slate-400" />
                                        Rename Book
                                      </button>
                                      
                                      <button 
                                        onClick={() => { setActiveMenuId(null); onDuplicateBook(book.id); }}
                                        className="w-full flex items-center gap-2 p-2 rounded-lg text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-zinc-900 cursor-pointer"
                                      >
                                        <Copy size={12} className="text-slate-400" />
                                        Duplicate Book
                                      </button>

                                      <button 
                                        onClick={() => { setActiveMenuId(null); onShareBook(book.id); }}
                                        className="w-full flex items-center gap-2 p-2 rounded-lg text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-zinc-900 cursor-pointer"
                                      >
                                        <Share2 size={12} className="text-indigo-500" />
                                        Share / Sync Code
                                      </button>

                                      <div className="h-px bg-slate-100 dark:bg-zinc-900 my-1" />

                                      <button 
                                        onClick={() => { setActiveMenuId(null); onExportBook(book.id, 'pdf'); }}
                                        className="w-full flex items-center gap-2 p-2 rounded-lg text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-zinc-900 cursor-pointer text-slate-600 dark:text-zinc-300"
                                      >
                                        <Download size={12} className="text-slate-400" />
                                        Export PDF Report
                                      </button>

                                      <button 
                                        onClick={() => { setActiveMenuId(null); onExportBook(book.id, 'excel'); }}
                                        className="w-full flex items-center gap-2 p-2 rounded-lg text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-zinc-900 cursor-pointer text-slate-600 dark:text-zinc-300"
                                      >
                                        <Download size={12} className="text-slate-400" />
                                        Export Excel Sheet
                                      </button>

                                      <div className="h-px bg-slate-100 dark:bg-zinc-900 my-1" />

                                      <button 
                                        onClick={() => { setActiveMenuId(null); onDeleteBook(book.id); }}
                                        className="w-full flex items-center gap-2 p-2 rounded-lg text-[11px] font-bold hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 cursor-pointer"
                                      >
                                        <Trash2 size={12} />
                                        Delete Book
                                      </button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ) : (
            /* VISUALLY POLISHED GRID VIEW */
            <motion.div
              key="grid-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {filteredBooks.map((book) => {
                const transactions = book.transactions || [];
                const entriesCount = transactions.length;

                const bookIn = transactions.filter((t: any) => t.type === 'in').reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
                const bookOut = transactions.filter((t: any) => t.type === 'out').reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
                const bookBalance = bookIn - bookOut;

                const hasAi = transactions.some((t: any) => t.isAi || t.source === 'AI');
                const isShared = transactions.some((t: any) => t.imported_from_share_code);

                return (
                  <motion.div
                    key={book.id}
                    whileHover={{ y: -3 }}
                    onClick={() => handleBookClick(book.id)}
                    className={cn(
                      "group p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden flex flex-col justify-between cursor-pointer shadow-sm select-none",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-900" : "bg-white border-slate-150"
                    )}
                  >
                    <div>
                      {/* Top status bar inside card */}
                      <div className="flex items-center justify-between mb-3.5">
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center border",
                          theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-indigo-400" : "bg-indigo-50/50 border-indigo-100 text-indigo-600"
                        )}>
                          <BookOpen size={14} />
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {hasAi && (
                            <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100/30" title="AI Extraction Enabled">
                              <Sparkles size={10} />
                            </span>
                          )}
                          {isShared && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-100/30">
                              Shared
                            </span>
                          )}
                          
                          {/* 3 dots */}
                          <div className="relative">
                            <button
                              onClick={(e) => toggleActionsMenu(e, book.id)}
                              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-900 text-slate-400 hover:text-slate-600"
                            >
                              <MoreVertical size={13} />
                            </button>

                            <AnimatePresence>
                              {activeMenuId === book.id && (
                                <motion.div
                                  ref={actionMenuRef}
                                  initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                  className={cn(
                                    "absolute right-0 mt-1 w-44 rounded-xl shadow-xl border p-1 z-50 text-left backdrop-blur-md",
                                    theme === 'dark' ? "bg-zinc-950/95 border-zinc-900 text-white" : "bg-white/95 border-slate-200 text-slate-800"
                                  )}
                                >
                                  <button 
                                    onClick={() => { setActiveMenuId(null); onRenameBook(book.id, book.name); }}
                                    className="w-full flex items-center gap-2 p-2 rounded-lg text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-zinc-900 cursor-pointer"
                                  >
                                    <Pencil size={12} className="text-slate-400" />
                                    Rename Book
                                  </button>
                                  
                                  <button 
                                    onClick={() => { setActiveMenuId(null); onDuplicateBook(book.id); }}
                                    className="w-full flex items-center gap-2 p-2 rounded-lg text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-zinc-900 cursor-pointer"
                                  >
                                    <Copy size={12} className="text-slate-400" />
                                    Duplicate Book
                                  </button>

                                  <button 
                                    onClick={() => { setActiveMenuId(null); onShareBook(book.id); }}
                                    className="w-full flex items-center gap-2 p-2 rounded-lg text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-zinc-900 cursor-pointer text-indigo-500"
                                  >
                                    <Share2 size={12} />
                                    Share / Sync Code
                                  </button>

                                  <div className="h-px bg-slate-100 dark:bg-zinc-900 my-1" />

                                  <button 
                                    onClick={() => { setActiveMenuId(null); onDeleteBook(book.id); }}
                                    className="w-full flex items-center gap-2 p-2 rounded-lg text-[11px] font-bold hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 cursor-pointer"
                                  >
                                    <Trash2 size={12} />
                                    Delete Book
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>

                      <h3 className={cn(
                        "font-extrabold text-sm truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-150",
                        theme === 'dark' ? "text-slate-100" : "text-slate-900"
                      )}>
                        {book.name}
                      </h3>
                      
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">
                        {entriesCount} total entries
                      </p>
                    </div>

                    <div className="mt-6 pt-3 border-t border-slate-100 dark:border-zinc-900 flex items-end justify-between">
                      <div>
                        <span className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">
                          Ledger Balance
                        </span>
                        <h4 className={cn(
                          "text-base font-black tracking-tight mt-0.5",
                          bookBalance >= 0 ? "text-slate-900 dark:text-slate-200" : "text-rose-600"
                        )}>
                          {formatCurrency(bookBalance)}
                        </h4>
                      </div>

                      <span className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 group-hover:underline">
                        Open <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>

                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      )}

    </div>
  );
}
