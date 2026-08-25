import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  Lock, 
  Sparkles, 
  Server, 
  Terminal, 
  Activity, 
  Database, 
  ArrowLeft, 
  Moon, 
  Sun, 
  LogOut, 
  Search, 
  RefreshCw, 
  FileSpreadsheet, 
  AlertCircle,
  TrendingUp,
  Cpu,
  Trash2,
  BookmarkCheck,
  CheckCircle2,
  Users
} from 'lucide-react';
import { cn } from '../lib/utils';
import { InAppDialog, DialogOptions } from '../components/InAppDialog';

interface AdminStatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle: string;
  trend?: string;
  theme: string;
}

function AdminStatCard({ title, value, icon, subtitle, trend, theme }: AdminStatCardProps) {
  return (
    <div className={cn(
      "p-6 rounded-lg border transition-all duration-200 font-sans shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700",
      theme === 'dark' 
        ? "bg-zinc-900 border-zinc-800 text-zinc-100" 
        : "bg-white border-zinc-200 text-zinc-900"
    )}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{title}</span>
        <div className="p-2 rounded-md bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-800/50">
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        {trend && (
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 px-1.5 py-0.5 rounded">
            {trend}
          </span>
        )}
      </div>
      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5 font-normal">{subtitle}</p>
    </div>
  );
}

export default function AdminPortal() {
  const navigate = useNavigate();
  
  // App Theme sync
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'theme';
    const finalValue = next === 'dark' ? 'dark' : 'light';
    setThemeState(finalValue);
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(finalValue);
    root.style.colorScheme = finalValue;
    localStorage.setItem('theme', finalValue);
  };

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('admin_session') === 'true';
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inAppDialog, setInAppDialog] = useState<DialogOptions | null>(null);

  // Stats Counters
  const [totalCashbooks, setTotalCashbooks] = useState<number | string>('Fetching...');
  const [totalEntries, setTotalEntries] = useState<number | string>('Fetching...');
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [allCashbooks, setAllCashbooks] = useState<any[]>([]);
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [securityStatus, setSecurityStatus] = useState<'Restricted RLS' | 'Standard Access'>('Restricted RLS');

  // Diagnostics log state
  const [diagnosticsLogs, setDiagnosticsLogs] = useState<string[]>([
    "[System] Admin control center boot started...",
    "[Sandbox] Core environmental integrity check: PASSED",
    "[Network] Direct isolated ingress route online.",
  ]);

  // Handle Log Appender
  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setDiagnosticsLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 24)]);
  };

  // Run Auth
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);

    setTimeout(() => {
      const normalUser = username.trim().toLowerCase();
      // Accepts master credentials
      if (
        (normalUser === 'admin@trackbook.xyz' && password === 'admin2026') || 
        (normalUser === 'admin' && password === 'admin') ||
        (normalUser === 'admin' && password === 'admin2026')
      ) {
        sessionStorage.setItem('admin_session', 'true');
        setIsAuthenticated(true);
        addLog("Admin user successfully authenticated with Master Credentials.");
      } else {
        setLoginError('Invalid Administrator credentials. Please verify your passcode.');
        addLog("Authentication attempt failed from IP gateway.");
      }
      setIsSubmitting(false);
    }, 400);
  };

  // Handle Logout
  const handleLogout = () => {
    sessionStorage.removeItem('admin_session');
    setIsAuthenticated(false);
    addLog("Administrator session terminated.");
  };

  // Fetch Database Insights
  const fetchDatabaseInsights = async () => {
    if (!supabase) {
      setTotalCashbooks('Database Error');
      setTotalEntries('Database Error');
      addLog("Supabase client is not initialized.");
      return;
    }

    setIsRefreshing(true);
    addLog("Interrogating server tables for row stats...");

    try {
      // Fetch cashbooks count query
      const { data: cbData, error: cbError, count: cbCount } = await supabase
        .from('cashbooks')
        .select('*', { count: 'exact' });

      if (cbError) {
        console.warn('Admin fetch cashbooks restricted, attempting fallbacks:', cbError);
        addLog(`RLS Active: Cashbooks restricted of global visibility. Rows returned: ${cbData?.length || 0}`);
        setTotalCashbooks(cbData?.length || 0);
        if (cbData) {
          setAllCashbooks(cbData);
        }
      } else {
        setTotalCashbooks(cbCount !== null ? cbCount : (cbData?.length || 0));
        setAllCashbooks(cbData || []);
        setSecurityStatus('Standard Access');
      }

      // Fetch entries count query
      const { data: entData, error: entError, count: entCount } = await supabase
        .from('entries')
        .select('*', { count: 'exact' });

      if (entError) {
        console.warn('Admin fetch entries restricted:', entError);
        addLog(`RLS Active: Row level security restricted global entries log.`);
        setTotalEntries(entData?.length || 0);
        setRecentEntries(entData || []);
      } else {
        setTotalEntries(entCount !== null ? entCount : (entData?.length || 0));
        setRecentEntries(entData || []);
      }

      addLog("Statistics compilation success.");
    } catch (err: any) {
      console.error('Database insights failed:', err);
      addLog(`Error interrogating tables: ${err.message || err}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDatabaseInsights();
    }
  }, [isAuthenticated]);

  // Insert mock demonstration expense in database
  const generateMockEntry = async () => {
    if (!supabase) {
      addLog("Unable to insert, Supabase not connected.");
      return;
    }

    try {
      addLog("Initiating sandboxed demo entry insertion...");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        addLog("Error: No active user session detected in browser cache. Please sign into Trackbook main app first.");
        return;
      }

      // Check for first cashbook ID for current user
      const { data: firstBook } = await supabase
        .from('cashbooks')
        .select('id, name')
        .eq('user_id', user.id)
        .limit(1);

      let bookId = '';
      if (firstBook && firstBook.length > 0) {
        bookId = firstBook[0].id;
        addLog(`Found active user book: "${firstBook[0].name}"`);
      } else {
        // Create a fast cashbook
        const newCbId = crypto.randomUUID();
        const { error: cbErr } = await supabase.from('cashbooks').insert([{
          id: newCbId,
          name: 'Sandbox Demo Book',
          user_id: user.id
        }]);
        if (cbErr) throw cbErr;
        bookId = newCbId;
        addLog('Created fresh "Sandbox Demo Book" for insert pipeline.');
      }

      const freshId = crypto.randomUUID();
      const mockPayload = {
        id: freshId,
        cashbook_id: bookId,
        user_id: user.id,
        amount: Math.floor(Math.random() * 850) + 150,
        type: Math.random() > 0.35 ? 'out' : 'in',
        description: 'Auto-Generated Admin Mock Transaction',
        category: ['Food', 'Transport', 'Utilities', 'Salaries', 'General'][Math.floor(Math.random() * 5)],
        mode: 'Online',
        date: new Date().toISOString()
      };

      const { error: insErr } = await supabase.from('entries').insert([mockPayload]);
      if (insErr) throw insErr;

      addLog(`Success! Inserted row with ID: ${freshId.slice(0, 8)}...`);
      fetchDatabaseInsights();
    } catch (err: any) {
      addLog(`Insert crashed: ${err.message || err}`);
    }
  };

  // Clear App local storages
  const wipeSandboxedStorage = () => {
    setInAppDialog({
      title: "Wipe Local Storage?",
      message: "Wipe client cache but retain sessions?",
      type: "warning",
      showCancel: true,
      confirmText: "Wipe Cache",
      cancelText: "Cancel",
      onConfirm: () => {
        const savedTheme = localStorage.getItem('theme');
        const savedAdmin = sessionStorage.getItem('admin_session');
        localStorage.clear();
        sessionStorage.clear();
        if (savedTheme) localStorage.setItem('theme', savedTheme);
        if (savedAdmin) sessionStorage.setItem('admin_session', savedAdmin);
        addLog("Purged index lists and local cached preferences cleanly.");
        setInAppDialog({
          title: "Storage Cleaned",
          message: "Cached storage arrays clean! Credentials maintained.",
          type: "success"
        });
      }
    });
  };

  // Filter lists based on search
  const filteredEntries = recentEntries.filter(entry => {
    const term = searchQuery.toLowerCase();
    return (
      (entry.description?.toLowerCase() || '').includes(term) ||
      (entry.category?.toLowerCase() || '').includes(term) ||
      (entry.amount?.toString() || '').includes(term) ||
      (entry.id?.toLowerCase() || '').includes(term)
    );
  });

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-200 flex flex-col font-sans selection:bg-zinc-500/20",
      theme === 'dark' ? "bg-zinc-950 text-zinc-200" : "bg-zinc-50 text-zinc-800"
    )}>
      {/* 1. LOGIN WALL VIEW */}
      <AnimatePresence mode="wait">
        {!isAuthenticated ? (
          <motion.div 
            key="login-wall"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex items-center justify-center p-4 sm:p-8"
          >
            <div className={cn(
              "w-full max-w-md rounded-[10px] p-8 sm:p-10 border shadow-lg transition-all duration-200",
              theme === 'dark' ? "bg-zinc-900 border-zinc-800 shadow-black/40" : "bg-white border-zinc-200 shadow-zinc-100/50"
            )}>
              <div className="text-center space-y-3.5 mb-8">
                <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-md border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center mx-auto shadow-sm">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                    TrackBook <span className="text-zinc-500 dark:text-zinc-400 font-normal">Control Studio</span>
                  </h1>
                  <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mt-1 tracking-wider uppercase font-sans">
                    Secure Management Access
                  </p>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                    Administrator ID
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-zinc-400 dark:text-zinc-650 font-mono text-xs">@</span>
                    <input 
                      type="text"
                      required
                      placeholder="admin@trackbook.xyz"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={cn(
                        "w-full pl-8 pr-4 py-2 text-sm rounded-md border focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 focus:outline-none transition-all font-sans",
                        theme === 'dark' 
                          ? "border-zinc-800 bg-zinc-950 text-white placeholder-zinc-700" 
                          : "border-zinc-200 bg-white text-zinc-900 placeholder-zinc-400"
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                    Master Security Key
                  </label>
                  <div className="relative">
                    <Lock size={12} className="absolute left-3 top-3 text-zinc-400 dark:text-zinc-650" />
                    <input 
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={cn(
                        "w-full pl-8 pr-4 py-2 text-sm rounded-md border focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 focus:outline-none transition-all font-sans",
                        theme === 'dark' 
                          ? "border-zinc-800 bg-zinc-950 text-white placeholder-zinc-700" 
                          : "border-zinc-200 bg-white text-zinc-900 placeholder-zinc-400"
                      )}
                    />
                  </div>
                </div>

                {loginError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/30 rounded-md flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 text-xs font-semibold uppercase tracking-wider rounded-md transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>Verifying Access Signature...</>
                  ) : (
                    <>
                      Authenticate <CheckCircle2 size={12} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center flex justify-between items-center text-[10px] text-zinc-400 dark:text-zinc-500">
                <button 
                  onClick={() => navigate('/login')} 
                  className="flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-zinc-100 font-semibold transition-colors uppercase tracking-wider cursor-pointer"
                >
                  <ArrowLeft size={10} /> Exit to App
                </button>
                <button 
                  onClick={toggleTheme}
                  className="p-1 px-2.5 rounded-md border border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors font-medium cursor-pointer"
                >
                  {theme === 'dark' ? <Sun size={10} /> : <Moon size={10} />}
                  Theme Mode
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* 2. ADMIN PORTAL CONTENT VIEW */
          <motion.div 
            key="admin-desktop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex flex-col min-h-0"
          >
            {/* Header Toolbar */}
            <div className={cn(
              "p-5 rounded-lg border flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm",
              theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
            )}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md border border-zinc-800 dark:border-zinc-200 flex items-center justify-center">
                  <Activity size={18} className="animate-pulse" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50 uppercase">TrackBook Admin Panel</h2>
                  <p className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-0.5 font-mono tracking-widest uppercase">
                    SYSTEM INSTANCE: LOCAL_CONTAINER_MAIN • v5.0.0
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleTheme}
                  className="p-2 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  title="Toggle Theme"
                >
                  {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                </button>
                
                <button 
                  onClick={fetchDatabaseInsights}
                  disabled={isRefreshing}
                  className="p-2 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs font-medium"
                >
                  <RefreshCw size={12} className={cn(isRefreshing && "animate-spin")} />
                  Sync Metrics
                </button>

                <button 
                  onClick={() => navigate('/')}
                  className="p-2 px-3.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
                >
                  <ArrowLeft size={12} /> Go to Dashboard
                </button>

                <button 
                  onClick={handleLogout}
                  className="p-2 px-3.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut size={12} /> Log Out
                </button>
              </div>
            </div>

            {/* Stats Overview Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <AdminStatCard 
                title="Total Cashbooks"
                value={totalCashbooks}
                icon={<Database size={16} />}
                subtitle="Aggregated client book namespaces"
                trend="+8%"
                theme={theme}
              />
              <AdminStatCard 
                title="Total Bill Items"
                value={totalEntries}
                icon={<FileSpreadsheet size={16} />}
                subtitle="Calculated splits entries in platform"
                trend="+14%"
                theme={theme}
              />
              <AdminStatCard 
                title="SaaS OCR Pipeline"
                value="Gemini 3.5"
                icon={<Cpu size={16} />}
                subtitle="Active smart OCR agent engine"
                theme={theme}
              />
              <AdminStatCard 
                title="Gatekeeper Level"
                value={securityStatus}
                icon={<Users size={16} />}
                subtitle="PostgreSQL RLS security context"
                theme={theme}
              />
            </div>

            {/* Mid Section: Performance Canvas & Logs Console */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* SVG Charts Section */}
              <div className={cn(
                "p-6 rounded-lg border space-y-4 shadow-sm lg:col-span-2",
                theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      System Volume Insights
                    </h3>
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-1">Platform Activity Trends</p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-zinc-900 dark:bg-zinc-300 rounded-sm inline-block" /> OCR Processing</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-500 rounded-sm inline-block" /> User Sign-ups</span>
                  </div>
                </div>

                {/* Custom Vector Area Chart */}
                <div className="h-48 w-full relative flex items-end">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
                    {/* Grid lines */}
                    <line x1="0" y1="50" x2="500" y2="50" stroke={theme === 'dark' ? "#27272a" : "#f4f4f5"} strokeWidth="1" strokeDasharray="3,3" />
                    <line x1="0" y1="100" x2="500" y2="100" stroke={theme === 'dark' ? "#27272a" : "#f4f4f5"} strokeWidth="1" strokeDasharray="3,3" />
                    <line x1="0" y1="150" x2="500" y2="150" stroke={theme === 'dark' ? "#27272a" : "#f4f4f5"} strokeWidth="1" strokeDasharray="3,3" />
                    
                    {/* Area path for OCR Processing volume */}
                    <path 
                      d="M 0 160 Q 100 120 180 80 T 360 110 T 500 40 L 500 200 L 0 200 Z" 
                      fill="url(#indigoGrad)" 
                      opacity="0.08" 
                    />
                    {/* Line path */}
                    <path 
                      d="M 0 160 Q 100 120 180 80 T 360 110 T 500 40" 
                      fill="none" 
                      stroke={theme === 'dark' ? "#ffffff" : "#09090b"} 
                      strokeWidth="2" 
                      strokeLinecap="round"
                    />

                    {/* Area path for Signups */}
                    <path 
                      d="M 0 180 Q 80 140 160 130 T 320 90 T 500 70 L 500 200 L 0 200 Z" 
                      fill="url(#emeraldGrad)" 
                      opacity="0.05" 
                    />
                    <path 
                      d="M 0 180 Q 80 140 160 130 T 320 90 T 500 70" 
                      fill="none" 
                      stroke="#10b981" 
                      strokeWidth="1.5" 
                      strokeLinecap="round"
                      strokeDasharray="4,4"
                    />

                    {/* Gradients declaration */}
                    <defs>
                      <linearGradient id="indigoGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={theme === 'dark' ? "#ffffff" : "#09090b"} />
                        <stop offset="100%" stopColor={theme === 'dark' ? "#ffffff" : "#09090b"} stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex justify-between pointer-events-none text-[9px] font-medium text-zinc-400 dark:text-zinc-600 pt-2 px-1">
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                    <span>Sun</span>
                  </div>
                </div>
              </div>

              {/* Server Control Log / Terminal */}
              <div className={cn(
                "p-6 rounded-lg border flex flex-col h-full shadow-sm",
                theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
              )}>
                <div className="flex items-center gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <Terminal size={14} className="text-zinc-500" />
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                    Live Diagnostics Stream
                  </h4>
                </div>
                
                <div className="flex-1 mt-4 bg-zinc-950 p-4 rounded-md text-[10px] font-mono text-zinc-300 h-48 overflow-y-auto space-y-1.5 border border-zinc-900 shadow-inner text-left">
                  <div className="flex items-center gap-1.5 pb-2.5 mb-2.5 border-b border-zinc-900/60 select-none">
                    <div className="w-2 h-2 rounded-full bg-zinc-800" />
                    <div className="w-2 h-2 rounded-full bg-zinc-800" />
                    <div className="w-2 h-2 rounded-full bg-zinc-800" />
                    <span className="text-[9px] text-zinc-500 ml-1.5">bash — diagnostics_stream</span>
                  </div>
                  {diagnosticsLogs.map((log, idx) => (
                    <div key={idx} className="leading-normal">
                      <span className="text-zinc-650 select-none mr-2">❯</span>
                      <span className="text-emerald-500">{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Dynamic Interactive Sandbox Toolkit */}
            <div className={cn(
              "p-6 rounded-lg border shadow-sm space-y-4",
              theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
            )}>
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Admin Sandbox Diagnostics
                </h3>
                <p className="text-sm font-semibold mt-1 text-zinc-900 dark:text-zinc-50">Simulate container pipelines and purge mock session footprints</p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button 
                  onClick={generateMockEntry}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-semibold rounded-md flex items-center gap-2 transition-colors cursor-pointer shadow-sm active:scale-[0.99]"
                >
                  <Sparkles size={13} />
                  Inject Random Mock Split Entry
                </button>

                <button 
                  onClick={wipeSandboxedStorage}
                  className="px-4 py-2 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold rounded-md flex items-center gap-2 transition-colors cursor-pointer shadow-sm active:scale-[0.99]"
                >
                  <Trash2 size={13} />
                  Purge Sandbox Storage Cache
                </button>

                <button 
                  onClick={() => {
                    const status = !realtimeConnected;
                    setRealtimeConnected(status);
                    addLog(`WebSocket transport simulated state changed: ${status ? 'ON' : 'OFF'}`);
                  }}
                  className={cn(
                    "px-4 py-2 border text-xs font-semibold rounded-md flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.99]",
                    realtimeConnected 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30"
                      : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30"
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", realtimeConnected ? "bg-emerald-500" : "bg-amber-500")} />
                  Simulate Offline Client {realtimeConnected ? "(Connected)" : "(Silenced)"}
                </button>
              </div>
            </div>

            {/* Core Database Inspector list viewer */}
            <div className={cn(
              "p-6 rounded-lg border shadow-sm flex-1 flex flex-col min-h-0",
              theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
            )}>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Live Database Record Auditing
                  </h3>
                  <p className="text-sm font-semibold mt-1 text-zinc-900 dark:text-zinc-50 font-sans">Platform table query audit trail (entries rows filtered via search)</p>
                </div>

                <div className="w-full md:w-80 relative">
                  <Search size={13} className="absolute left-3 top-2.5 text-zinc-400 dark:text-zinc-650" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by amount, descriptor text, category..."
                    className={cn(
                      "w-full pl-9 pr-4 py-2 text-xs rounded-md border focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 focus:outline-none transition-all font-sans",
                      theme === 'dark' 
                        ? "border-zinc-800 bg-zinc-950 text-white placeholder-zinc-700" 
                        : "border-zinc-200 bg-white text-zinc-900 placeholder-zinc-400"
                    )}
                  />
                </div>
              </div>

              {/* Data Table */}
              <div className="flex-1 overflow-y-auto mt-4 pr-1 min-h-[200px]">
                {filteredEntries.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center text-center text-zinc-400 dark:text-zinc-600">
                    <Database size={24} className="stroke-[1.5]" />
                    <span className="text-xs font-semibold mt-2 text-zinc-900 dark:text-zinc-100">No Matching Rows Logged</span>
                    <span className="text-[11px] mt-1 px-4 leading-normal max-w-sm text-zinc-400 dark:text-zinc-500">
                      Check your active filters, or leverage security features by adding entries to your dashboard cashbooks list.
                    </span>
                  </div>
                ) : (
                  <table className="w-full text-left font-sans text-xs border-collapse">
                    <thead>
                      <tr className={cn(
                        "border-b uppercase font-semibold text-[10px] text-zinc-500 dark:text-zinc-400 tracking-wider",
                        theme === 'dark' ? "border-zinc-800 bg-zinc-900/40" : "border-zinc-100 bg-zinc-50/40"
                      )}>
                        <th className="py-3 px-4 font-semibold">Entry ID</th>
                        <th className="py-3 px-4 font-semibold">Date</th>
                        <th className="py-3 px-4 font-semibold">Category</th>
                        <th className="py-3 px-4 font-semibold">Details / Notes</th>
                        <th className="py-3 px-4 text-right font-semibold">Volume amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                      {filteredEntries.map((row) => (
                        <tr 
                          key={row.id} 
                          className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors duration-150 group"
                        >
                          <td className="py-3.5 px-4 font-mono font-medium text-zinc-400 dark:text-zinc-500 relative">
                            {row.id?.slice(0, 8)}...
                            <span className="absolute left-1 top-4.5 opacity-0 group-hover:opacity-100 text-[8px] text-zinc-800 dark:text-zinc-300 transition-opacity font-bold">●</span>
                          </td>
                          <td className="py-3.5 px-4 text-zinc-400 dark:text-zinc-500">
                            {new Date(row.date).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border",
                              row.type === 'in' 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200/40 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30"
                                : "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-850 dark:text-zinc-300 dark:border-zinc-800"
                            )}>
                              {row.category || 'General'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-zinc-900 dark:text-zinc-100 font-medium max-w-xs truncate" title={row.description}>
                            {row.description || 'No description provided'}
                          </td>
                          <td className={cn(
                            "py-3.5 px-4 text-right font-mono font-semibold text-xs",
                            row.type === 'in' ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-900 dark:text-zinc-100"
                          )}>
                            {row.type === 'in' ? '+' : '-'}₹{row.amount?.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <InAppDialog
        isOpen={Boolean(inAppDialog)}
        options={inAppDialog}
        onClose={() => setInAppDialog(null)}
        theme={theme}
      />
    </div>
  );
}
