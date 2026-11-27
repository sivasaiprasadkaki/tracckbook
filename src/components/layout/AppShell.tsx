import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  BookOpen,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { DownloadCenterTrigger } from '../DownloadCenter';

export type PrimarySection = 'dashboard' | 'cashbooks' | 'reports' | 'settings';

interface AppShellProps {
  activeSection: PrimarySection;
  pageTitle: string;
  pageSubtitle?: string;
  userName: string;
  userEmail?: string;
  showDownloadCenter: boolean;
  setShowDownloadCenter: (open: boolean) => void;
  onSignOut: () => void;
  topBarMiddleSlot?: React.ReactNode;
  topBarRightSlot?: React.ReactNode;
  hideMobileBottomNav?: boolean;
  children: React.ReactNode;
}

const PRIMARY_NAV_ITEMS: Array<{
  id: PrimarySection;
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { id: 'cashbooks', label: 'Cashbooks', path: '/cashbooks', icon: BookOpen },
  { id: 'reports', label: 'Reports', path: '/reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', path: '/settings', icon: Settings },
];

export default function AppShell({
  activeSection,
  pageTitle,
  pageSubtitle,
  userName,
  userEmail,
  showDownloadCenter,
  setShowDownloadCenter,
  onSignOut,
  topBarMiddleSlot,
  topBarRightSlot,
  hideMobileBottomNav = false,
  children,
}: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const initials = (userName || userEmail || 'U').trim().charAt(0).toUpperCase();

  const handleNavClick = (path: string) => {
    setMobileDrawerOpen(false);
    setUserMenuOpen(false);
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-[#263445] flex flex-col lg:flex-row">
      {/* DESKTOP PERSISTENT BLUE SIDEBAR */}
      <motion.aside
        initial={{ x: -16, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'hidden lg:flex flex-col shrink-0 bg-[#2866C7] text-white sticky top-0 h-screen z-40 transition-[width] duration-200 border-r border-[#2058A8]',
          sidebarCollapsed ? 'w-[76px]' : 'w-[248px]'
        )}
      >
        {/* Brand Header */}
        <div
          className={cn(
            'h-16 flex items-center border-b border-white/15 shrink-0',
            sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-5'
          )}
        >
          <button
            type="button"
            onClick={() => handleNavClick('/')}
            className="flex items-center gap-2.5 text-white text-left focus:outline-none cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px] text-white">menu_book</span>
            </div>
            {!sidebarCollapsed && (
              <span
                className="text-[20px] tracking-normal text-white leading-none select-none"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400 }}
              >
                TrackBook
              </span>
            )}
          </button>

          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              title="Collapse sidebar"
              className="p-1.5 rounded-lg text-white/75 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {sidebarCollapsed && (
          <div className="px-3 pt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              title="Expand sidebar"
              className="w-full py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Primary 4 Navigation Links */}
        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto" aria-label="Main Navigation">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.path)}
                title={sidebarCollapsed ? item.label : undefined}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors relative cursor-pointer group',
                  sidebarCollapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-[#2058A8] text-white font-medium shadow-xs'
                    : 'text-white/85 hover:bg-white/12 hover:text-white font-normal'
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-white" />
                )}
                <Icon size={19} className="shrink-0 text-white" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Fixed Bottom Logout Item */}
        <div className="p-3 border-t border-white/15 shrink-0">
          <button
            type="button"
            onClick={onSignOut}
            title={sidebarCollapsed ? 'Logout' : undefined}
            className={cn(
              'w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-white/90 hover:bg-[#2058A8] hover:text-white transition-colors cursor-pointer',
              sidebarCollapsed && 'justify-center px-0'
            )}
          >
            <LogOut size={19} className="shrink-0 text-white" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* MOBILE SLIDE-OVER BLUE DRAWER */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-[120] lg:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMobileDrawerOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-72 max-w-[82vw] bg-[#2866C7] text-white h-full flex flex-col z-10 shadow-2xl"
            >
              <div className="h-14 px-5 flex items-center justify-between border-b border-white/15">
                <button
                  type="button"
                  onClick={() => handleNavClick('/')}
                  className="flex items-center gap-2.5 text-white cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">menu_book</span>
                  </div>
                  <span
                    className="text-lg tracking-normal text-white"
                    style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400 }}
                  >
                    TrackBook
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
                  aria-label="Close navigation drawer"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
                {PRIMARY_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.path)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors relative min-h-[44px]',
                        isActive
                          ? 'bg-[#2058A8] text-white font-medium'
                          : 'text-white/85 hover:bg-white/12 hover:text-white'
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-white" />
                      )}
                      <Icon size={19} className="shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="p-3 border-t border-white/15">
                <div className="px-3 py-2 mb-2 rounded-xl bg-white/10 text-xs">
                  <div className="font-medium text-white truncate">{userName || 'TrackBook User'}</div>
                  {userEmail && <div className="text-white/70 truncate text-[11px]">{userEmail}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    onSignOut();
                  }}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white hover:bg-[#2058A8] transition-colors min-h-[44px]"
                >
                  <LogOut size={19} />
                  <span>Logout</span>
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* RIGHT CONTENT COLUMN */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* WHITE TOPBAR */}
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
          className="h-14 sm:h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-3 sm:px-6 flex items-center justify-between gap-3 shrink-0"
        >
          {/* Left: Hamburger + Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl text-[#263445] hover:bg-slate-100 transition-colors shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-[#263445] tracking-tight truncate leading-tight">
                {pageTitle}
              </h1>
              {pageSubtitle && (
                <p className="hidden sm:block text-xs text-[#748197] truncate leading-tight">
                  {pageSubtitle}
                </p>
              )}
            </div>
          </div>

          {/* Middle Contextual Slot (e.g., search books on /cashbooks) */}
          {topBarMiddleSlot && (
            <div className="hidden md:flex flex-1 max-w-md mx-2">{topBarMiddleSlot}</div>
          )}

          {/* Right: Extra slot + Download Center Trigger + User Profile */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {topBarRightSlot}

            <DownloadCenterTrigger
              theme="light"
              isOpen={showDownloadCenter}
              setIsOpen={setShowDownloadCenter}
            />

            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 pl-1.5 pr-2 sm:pr-3 py-1 rounded-full border border-slate-200 bg-white hover:bg-[#EAF2FF]/60 transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#2866C7] text-white flex items-center justify-center text-xs sm:text-sm font-bold shrink-0">
                  {initials}
                </div>
                <span className="hidden sm:inline text-xs font-medium text-[#263445] max-w-[110px] truncate">
                  {userName || 'Account'}
                </span>
                <ChevronDown size={14} className="text-[#748197] hidden sm:inline" />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-50"
                    >
                      <div className="px-3 py-2.5 border-b border-slate-100 mb-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#748197]">
                          Signed in as
                        </p>
                        <p className="text-sm font-bold text-[#263445] truncate">
                          {userName || 'TrackBook User'}
                        </p>
                        {userEmail && (
                          <p className="text-xs text-[#748197] truncate">{userEmail}</p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleNavClick('/settings')}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-[#263445] hover:bg-[#EAF2FF] hover:text-[#2866C7] transition-colors cursor-pointer"
                      >
                        <Settings size={16} />
                        <span>Account & Settings</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onSignOut();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer mt-0.5"
                      >
                        <LogOut size={16} />
                        <span>Logout</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.header>

        {/* MAIN ROUTE VIEWPORT */}
        <motion.main
          key={location.pathname.split('/').slice(0, 2).join('/') || '/'}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6',
            !hideMobileBottomNav && 'pb-24 lg:pb-8'
          )}
        >
          {children}
        </motion.main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION (4 TABS ONLY, <= 15% VIEWPORT) */}
      {!hideMobileBottomNav && (
        <nav
          aria-label="Mobile Navigation"
          className="lg:hidden fixed bottom-0 inset-x-0 h-16 bg-white border-t border-slate-200 z-40 px-2 grid grid-cols-4 items-center shadow-[0_-4px_20px_rgba(15,23,42,0.06)]"
        >
          {PRIMARY_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.path)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 h-full rounded-xl transition-colors cursor-pointer min-h-[44px]',
                  isActive ? 'text-[#2866C7] font-semibold' : 'text-[#748197]'
                )}
              >
                <div
                  className={cn(
                    'px-3 py-1 rounded-full transition-colors',
                    isActive && 'bg-[#EAF2FF]'
                  )}
                >
                  <Icon size={18} />
                </div>
                <span className="text-[11px] leading-none">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
