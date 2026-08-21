import React from 'react';
import { 
  LayoutGrid, 
  Wallet, 
  BarChart3, 
  Bot, 
  Users, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  X,
  BookOpen
} from 'lucide-react';
import { cn, vibrate } from '../lib/utils';

export type SectionType = 
  | 'dashboard' 
  | 'cashbooks' 
  | 'reports'
  | 'automation'
  | 'members'
  | 'settings'
  | 'processing-center' 
  | 'ai-upload' 
  | 'exports' 
  | 'imports' 
  | 'shared-entries';

interface SaaSSidebarProps {
  currentSection: SectionType;
  setCurrentSection?: (section: SectionType) => void;
  onSelectSection?: (section: SectionType) => void;
  activeBookId?: string | null;
  onSelectBook?: (id: string | null) => void;
  books?: any[];
  theme: 'light' | 'dark';
  toggleTheme?: (e: any) => void;
  onToggleTheme?: (e: any) => void;
  userName: string;
  onSignOut: () => void | Promise<any>;
  isCollapsed?: boolean;
  setIsCollapsed?: (collapsed: boolean) => void;
  activeTasksCount?: number;
  isOpenMobile?: boolean;
  isMobileOpen?: boolean;
  setIsOpenMobile?: (open: boolean) => void;
  onCloseMobile?: () => void;
}

export default function SaaSSidebar({
  currentSection,
  setCurrentSection,
  onSelectSection,
  activeBookId = null,
  onSelectBook = () => {},
  books = [],
  theme,
  toggleTheme,
  onToggleTheme,
  userName,
  onSignOut,
  isCollapsed: controlledIsCollapsed,
  setIsCollapsed: controlledSetIsCollapsed,
  activeTasksCount = 0,
  isOpenMobile: controlledIsOpenMobile,
  isMobileOpen: controlledIsMobileOpen,
  setIsOpenMobile: controlledSetIsOpenMobile,
  onCloseMobile,
}: SaaSSidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = React.useState(false);
  const [internalOpenMobile, setInternalOpenMobile] = React.useState(false);

  const isCollapsed = controlledIsCollapsed !== undefined ? controlledIsCollapsed : internalCollapsed;
  const setIsCollapsed = controlledSetIsCollapsed || setInternalCollapsed;

  const isOpenMobile = controlledIsOpenMobile !== undefined 
    ? controlledIsOpenMobile 
    : (controlledIsMobileOpen !== undefined ? controlledIsMobileOpen : internalOpenMobile);

  const handleCloseMobile = () => {
    if (onCloseMobile) onCloseMobile();
    if (controlledSetIsOpenMobile) controlledSetIsOpenMobile(false);
    setInternalOpenMobile(false);
  };

  const handleSelectSection = (sec: SectionType) => {
    if (onSelectSection) onSelectSection(sec);
    if (setCurrentSection) setCurrentSection(sec);
    handleCloseMobile();
  };

  const handleThemeToggle = (e: any) => {
    if (onToggleTheme) onToggleTheme(e);
    else if (toggleTheme) toggleTheme(e);
  };

  const navItems: { id: SectionType; label: string; icon: any; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'cashbooks', label: 'Cashbooks', icon: Wallet, badge: books.length > 0 ? books.length : undefined },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'automation', label: 'Automation', icon: Bot, badge: activeTasksCount > 0 ? activeTasksCount : undefined },
    { id: 'members', label: 'Members & Access', icon: Users },
  ];

  const handleNavClick = (sectionId: SectionType) => {
    vibrate(15);
    handleSelectSection(sectionId);
    if (onSelectBook) onSelectBook(null);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full py-6">
      {/* Brand Header */}
      <div className={cn(
        "px-6 mb-6 flex items-center justify-between shrink-0 select-none",
        isCollapsed && "px-3 justify-center"
      )}>
        <div 
          onClick={() => handleNavClick('dashboard')}
          className="flex items-center gap-3 cursor-pointer overflow-hidden"
        >
          <div className="w-8 h-8 rounded-md bg-[#3525cd] text-white flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
            T
          </div>
          {!isCollapsed && (
            <div>
              <h1 className={cn(
                "font-bold text-xl tracking-tight leading-none",
                theme === 'dark' ? "text-indigo-400" : "text-[#3525cd]"
              )}>
                TrackBook
              </h1>
            </div>
          )}
        </div>

        {/* Collapse toggle desktop */}
        {!isCollapsed && (
          <button
            onClick={() => { vibrate(10); setIsCollapsed(!isCollapsed); }}
            className={cn(
              "hidden md:flex items-center justify-center w-6 h-6 rounded-md border transition-colors cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200",
              theme === 'dark' ? "border-zinc-800 bg-zinc-900" : "border-slate-200 bg-white"
            )}
            title="Collapse Sidebar"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {isCollapsed && (
        <div className="hidden md:flex justify-center mb-4">
          <button
            onClick={() => { vibrate(10); setIsCollapsed(!isCollapsed); }}
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-md border transition-colors cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200",
              theme === 'dark' ? "border-zinc-800 bg-zinc-900" : "border-slate-200 bg-white"
            )}
            title="Expand Sidebar"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Main Navigation Items */}
      <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentSection === item.id && activeBookId === null;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all relative group cursor-pointer",
                isActive
                  ? theme === 'dark'
                    ? "bg-indigo-950/40 text-indigo-400 font-bold border-r-4 border-indigo-500"
                    : "bg-[#eff4ff] text-[#3525cd] font-bold border-r-4 border-[#3525cd]"
                  : theme === 'dark'
                    ? "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 font-medium"
                    : "text-[#475569] hover:text-[#0F172A] hover:bg-[#e5eeff]/70 font-medium"
              )}
            >
              <Icon 
                size={18} 
                className={cn(
                  "shrink-0 transition-colors",
                  isActive 
                    ? theme === 'dark' ? "text-indigo-400" : "text-[#3525cd]" 
                    : "text-[#64748B] group-hover:text-[#0F172A] dark:group-hover:text-zinc-200"
                )} 
              />
              
              {!isCollapsed && (
                <span className="flex-1 truncate">{item.label}</span>
              )}

              {item.badge !== undefined && !isCollapsed && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight shrink-0",
                  isActive
                    ? "bg-[#3525cd]/15 text-[#3525cd] dark:bg-indigo-500/20 dark:text-indigo-300"
                    : theme === 'dark'
                      ? "bg-zinc-800 text-zinc-400"
                      : "bg-slate-100 text-slate-600"
                )}>
                  {item.badge}
                </span>
              )}

              {/* Tooltip for Collapsed Sidebar */}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50 whitespace-nowrap shadow-lg">
                  {item.label}
                  {item.badge !== undefined && ` (${item.badge})`}
                </div>
              )}
            </button>
          );
        })}

        {/* Quick Access Books Section */}
        {books.length > 0 && !isCollapsed && (
          <div className="pt-5 mt-5 border-t border-slate-100 dark:border-zinc-800">
            <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center justify-between">
              <span>Recent Cashbooks</span>
            </div>
            <div className="space-y-1">
              {books.slice(0, 4).map((book) => {
                const isBookActive = activeBookId === book.id;
                return (
                  <button
                    key={book.id}
                    onClick={() => {
                      vibrate(10);
                      onSelectBook(book.id);
                      handleCloseMobile();
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium transition-all group cursor-pointer",
                      isBookActive
                        ? theme === 'dark'
                          ? "bg-indigo-950/40 text-indigo-400 font-bold"
                          : "bg-[#eff4ff] text-[#3525cd] font-bold"
                        : theme === 'dark'
                          ? "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                          : "text-[#475569] hover:text-[#0F172A] hover:bg-slate-100"
                    )}
                  >
                    <div className="w-5 h-5 rounded bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-zinc-300 shrink-0">
                      {book.name ? book.name[0].toUpperCase() : 'B'}
                    </div>
                    <span className="truncate flex-1">{book.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Bottom Navigation & Settings */}
      <div className="px-3 mt-auto pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-1">
        {/* Settings button */}
        <button
          onClick={() => handleNavClick('settings')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all cursor-pointer",
            currentSection === 'settings'
              ? theme === 'dark'
                ? "bg-indigo-950/40 text-indigo-400 font-bold border-r-4 border-indigo-500"
                : "bg-[#eff4ff] text-[#3525cd] font-bold border-r-4 border-[#3525cd]"
              : theme === 'dark'
                ? "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 font-medium"
                : "text-[#475569] hover:text-[#0F172A] hover:bg-[#e5eeff]/70 font-medium"
          )}
        >
          <Settings size={18} className="shrink-0 text-[#64748B]" />
          {!isCollapsed && <span className="flex-1 truncate">Settings</span>}
        </button>

        {/* Theme switch */}
        <button
          onClick={(e) => { vibrate(10); toggleTheme(e); }}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs font-medium transition-all cursor-pointer",
            theme === 'dark' 
              ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900" 
              : "text-[#475569] hover:text-[#0F172A] hover:bg-slate-100"
          )}
        >
          {theme === 'dark' ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
          {!isCollapsed && (
            <div className="flex items-center justify-between flex-1">
              <span>Theme</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {theme}
              </span>
            </div>
          )}
        </button>

        {/* Sign out */}
        <button
          onClick={onSignOut}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer",
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
      {/* Sidebar Desktop */}
      <aside
        className={cn(
          "hidden md:flex flex-col h-screen fixed left-0 top-0 border-r z-30 transition-all duration-200",
          isCollapsed ? "w-16" : "w-64",
          theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-[#E2E8F0] text-[#0F172A]"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={handleCloseMobile}
          />
          <div className={cn(
            "relative w-72 max-w-sm h-full flex flex-col z-10 shadow-2xl transition-transform duration-300 border-r",
            theme === 'dark' ? "bg-zinc-950 border-zinc-850 text-white" : "bg-white border-[#E2E8F0] text-[#0F172A]"
          )}>
            <button
              onClick={handleCloseMobile}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer text-slate-400"
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
