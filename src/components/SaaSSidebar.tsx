import React from 'react';
import { 
  LayoutGrid, 
  BookOpen, 
  RotateCw, 
  Sparkles, 
  DownloadCloud, 
  UploadCloud, 
  Share, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  CloudLightning,
  Menu,
  X
} from 'lucide-react';
import { cn, vibrate } from '../lib/utils';

export type SectionType = 
  | 'dashboard' 
  | 'cashbooks' 
  | 'processing-center' 
  | 'ai-upload' 
  | 'exports' 
  | 'imports' 
  | 'shared-entries' 
  | 'settings';

interface SaaSSidebarProps {
  currentSection: SectionType;
  setCurrentSection: (section: SectionType) => void;
  activeBookId: string | null;
  onSelectBook: (id: string | null) => void;
  books: any[];
  theme: 'light' | 'dark';
  toggleTheme: (e: any) => void;
  userName: string;
  onSignOut: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  activeTasksCount: number;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
}

export default function SaaSSidebar({
  currentSection,
  setCurrentSection,
  activeBookId,
  onSelectBook,
  books,
  theme,
  toggleTheme,
  userName,
  onSignOut,
  isCollapsed,
  setIsCollapsed,
  activeTasksCount,
  isOpenMobile,
  setIsOpenMobile,
}: SaaSSidebarProps) {

  const navItems: { id: SectionType; label: string; icon: any; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'cashbooks', label: 'Cashbooks', icon: BookOpen, badge: books.length > 0 ? books.length : undefined },
    { id: 'processing-center', label: 'Processing Center', icon: RotateCw, badge: activeTasksCount > 0 ? activeTasksCount : undefined },
    { id: 'ai-upload', label: 'AI Scanner', icon: Sparkles },
    { id: 'exports', label: 'Export Hub', icon: DownloadCloud },
    { id: 'imports', label: 'Import Center', icon: UploadCloud },
    { id: 'shared-entries', label: 'Shared Links', icon: Share },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (sectionId: SectionType) => {
    vibrate(15);
    setCurrentSection(sectionId);
    onSelectBook(null); // clear active cashbook selection to show main panel section
    setIsOpenMobile(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className={cn(
        "flex items-center justify-between p-4 border-b h-14 shrink-0",
        theme === 'dark' ? "border-zinc-900 bg-zinc-950" : "border-slate-150 bg-white"
      )}>
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-indigo-600/20 shrink-0">
            TB
          </div>
          {!isCollapsed && (
            <div className="flex items-center leading-none">
              <span className="font-extrabold text-indigo-600 text-sm tracking-tight">Track</span>
              <span className={cn(
                "font-extrabold text-sm tracking-tight",
                theme === 'dark' ? "text-slate-100" : "text-slate-800"
              )}>Book</span>
              <span className="ml-1.5 text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
                PRO
              </span>
            </div>
          )}
        </div>

        {/* Collapse Button - Desktop Only */}
        <button
          onClick={() => { vibrate(10); setIsCollapsed(!isCollapsed); }}
          className={cn(
            "hidden md:flex items-center justify-center w-6 h-6 rounded-lg border transition-colors hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200",
            theme === 'dark' ? "border-zinc-800 bg-zinc-950" : "border-slate-150 bg-white"
          )}
        >
          {isCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* User Section (Top-Sidebar Profile card) */}
      {!isCollapsed && (
        <div className={cn(
          "p-3 mx-3 mt-4 rounded-xl border flex items-center gap-3 transition-all",
          theme === 'dark' ? "bg-zinc-950/40 border-zinc-900" : "bg-slate-50/50 border-slate-150"
        )}>
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shrink-0">
            {userName ? userName[0].toUpperCase() : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn(
              "text-xs font-bold truncate",
              theme === 'dark' ? "text-slate-200" : "text-slate-800"
            )}>
              {userName || 'User'}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-slate-400 font-medium truncate">
                Cloud Sync Active
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-1 scrollbar-thin">
        <div className="px-2.5 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
          {!isCollapsed ? "Workspace" : "•"}
        </div>
        
        {navItems.map((item) => {
          const isActive = currentSection === item.id && activeBookId === null;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-all relative group cursor-pointer",
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : theme === 'dark'
                    ? "text-slate-400 hover:text-slate-200 hover:bg-zinc-900/50"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              )}
            >
              <Icon size={18} className={cn("shrink-0", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300")} />
              
              {!isCollapsed && (
                <span className="flex-1 truncate">{item.label}</span>
              )}

              {/* Badges */}
              {item.badge !== undefined && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight shrink-0",
                  isActive
                    ? "bg-white/20 text-white"
                    : theme === 'dark'
                      ? "bg-indigo-950/50 text-indigo-400 border border-indigo-900/40"
                      : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                )}>
                  {item.badge}
                </span>
              )}

              {/* Tooltip for Collapsed Sidebar */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50 whitespace-nowrap shadow-xl">
                  {item.label}
                  {item.badge !== undefined && ` (${item.badge})`}
                </div>
              )}
            </button>
          );
        })}

        {/* Shortcuts / Books Section */}
        {books.length > 0 && (
          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-zinc-900">
            <div className="px-2.5 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center justify-between">
              <span>{!isCollapsed ? "Quick Access" : "Books"}</span>
            </div>
            <div className="space-y-0.5">
              {books.slice(0, 5).map((book) => {
                const isBookActive = activeBookId === book.id;
                return (
                  <button
                    key={book.id}
                    onClick={() => {
                      vibrate(10);
                      onSelectBook(book.id);
                      setIsOpenMobile(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs font-medium transition-all relative group cursor-pointer",
                      isBookActive
                        ? theme === 'dark'
                          ? "bg-zinc-900 text-indigo-400 font-bold border-l-2 border-indigo-500"
                          : "bg-indigo-50/70 text-indigo-700 font-bold border-l-2 border-indigo-600"
                        : theme === 'dark'
                          ? "text-slate-400 hover:text-slate-200 hover:bg-zinc-900/30"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                    )}
                  >
                    <BookOpen size={14} className="shrink-0 text-slate-400 group-hover:text-slate-500" />
                    {!isCollapsed && <span className="truncate flex-1">{book.name}</span>}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50 whitespace-nowrap shadow-xl">
                        {book.name}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Footer Settings and Action */}
      <div className={cn(
        "p-3 border-t shrink-0 space-y-1.5",
        theme === 'dark' ? "border-zinc-900 bg-zinc-950" : "border-slate-150 bg-white"
      )}>
        {/* Toggle Theme inline */}
        {!isCollapsed ? (
          <button
            onClick={toggleTheme}
            className={cn(
              "w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium transition-all hover:bg-slate-50 dark:hover:bg-zinc-900/50 cursor-pointer",
              theme === 'dark' ? "text-slate-350" : "text-slate-600"
            )}
          >
            <div className="flex items-center gap-2.5">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              <span>Appearance</span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {theme}
            </span>
          </button>
        ) : (
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center p-2 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-zinc-900/50 cursor-pointer text-slate-400"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        )}

        {/* Sign Out Button */}
        <button
          onClick={onSignOut}
          className={cn(
            "w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer",
            isCollapsed && "justify-center"
          )}
        >
          <LogOut size={16} className="shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Sidebar Desktop Mode */}
      <aside
        className={cn(
          "hidden md:block shrink-0 h-screen sticky top-0 border-r z-40 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          isCollapsed ? "w-16" : "w-60",
          theme === 'dark' ? "bg-zinc-950 border-zinc-900 text-white" : "bg-white border-slate-150 text-black"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Slide-out overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpenMobile(false)}
          />
          {/* Sidebar Drawer Container */}
          <div className={cn(
            "relative w-64 max-w-sm h-full flex flex-col z-10 shadow-2xl transition-transform duration-300 transform translate-x-0 border-r",
            theme === 'dark' ? "bg-zinc-950 border-zinc-900 text-white" : "bg-white border-slate-150 text-black"
          )}>
            <button
              onClick={() => setIsOpenMobile(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer text-slate-400"
            >
              <X size={18} />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
