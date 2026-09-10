import React, { useState, useEffect, useRef } from 'react';
import { syncManager, NetworkState, SyncStateMode } from '../services/syncManager';
import { networkSignalService, SignalData } from '../services/networkSignalService';
import { NetworkSignalStripes } from './NetworkSignalStripes';
import { RefreshCw, Check, Clock, Wifi, Zap, Activity, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface SyncStatusBadgeProps {
  theme?: string;
  className?: string;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ theme = 'light', className }) => {
  const [networkState, setNetworkState] = useState<NetworkState>(syncManager.network.state);
  const [syncState, setSyncState] = useState<SyncStateMode>(syncManager.syncState);
  const [pendingCount, setPendingCount] = useState<number>(syncManager.pendingCount);
  const [signal, setSignal] = useState<SignalData>(networkSignalService.getData());
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isRefreshingMobile, setIsRefreshingMobile] = useState<boolean>(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Subscribe to network monitor from syncManager
    const unsubNetwork = syncManager.network.subscribe((net) => {
      setNetworkState(net);
    });

    // Subscribe to sync manager updates
    const unsubSync = syncManager.subscribe(() => {
      setSyncState(syncManager.syncState);
      setPendingCount(syncManager.pendingCount);
    });

    // Subscribe to real-time signal detection service
    const unsubSignal = networkSignalService.subscribe((sig) => {
      setSignal(sig);
    });

    return () => {
      unsubNetwork();
      unsubSync();
      unsubSignal();
    };
  }, []);

  // Handle click outside to close popover on desktop
  useEffect(() => {
    if (!isDetailOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsDetailOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDetailOpen]);

  const isDark = theme === 'dark';
  const isActuallyOffline = networkState === 'offline' || signal.quality === 'offline';

  // Handler for clicking the signal button
  const handleBadgeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

    if (isMobile) {
      // Mobile View: pressing the signal icon directly triggers instant refresh / re-test!
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(30);
      }
      setIsRefreshingMobile(true);
      try {
        await Promise.all([
          networkSignalService.measureSignal(),
          pendingCount > 0 ? syncManager.triggerSync() : Promise.resolve()
        ]);
      } catch (err) {
        console.error('[SyncStatusBadge] mobile refresh error:', err);
      } finally {
        setTimeout(() => {
          setIsRefreshingMobile(false);
        }, 600);
      }
    } else {
      // Desktop View: opens detailed network diagnostic popover
      setIsDetailOpen((prev) => !prev);
    }
  };

  // Manual ping trigger inside desktop popover
  const handleManualTestSignal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await networkSignalService.measureSignal();
  };

  // Desktop Detailed Signal Popover Modal
  const renderDetailPopover = () => {
    if (!isDetailOpen) return null;

    const pingColor = !signal.latency 
      ? 'text-slate-400' 
      : signal.latency < 140 
      ? 'text-emerald-600 dark:text-emerald-400' 
      : signal.latency < 320 
      ? 'text-amber-600 dark:text-amber-400' 
      : 'text-rose-600 dark:text-rose-400';

    return (
      <div 
        ref={popoverRef}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "hidden sm:block absolute top-full mt-2 left-0 z-50 w-72 p-3.5 rounded-2xl shadow-xl border backdrop-blur-md transition-all animate-in fade-in zoom-in-95 duration-150 text-left",
          isDark 
            ? "bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-black/50" 
            : "bg-white/95 border-slate-200/90 text-slate-800 shadow-slate-300/40"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <Activity size={15} className="text-indigo-500" />
            <span className="text-xs font-bold tracking-tight">Real-Time Network Signal</span>
          </div>
          <button 
            type="button"
            onClick={() => setIsDetailOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Signal Status Hero */}
        <div className={cn(
          "flex items-center justify-between p-2.5 rounded-xl mb-3",
          isDark ? "bg-slate-800/80" : "bg-slate-50 border border-slate-100"
        )}>
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "p-2 rounded-lg",
              isActuallyOffline 
                ? "bg-red-500/10 dark:bg-red-500/20" 
                : "bg-emerald-500/10 dark:bg-emerald-500/20"
            )}>
              <NetworkSignalStripes 
                bars={isActuallyOffline ? 0 : signal.bars} 
                quality={isActuallyOffline ? 'offline' : signal.quality} 
                isChecking={signal.isChecking}
                size="lg" 
              />
            </div>
            <div>
              <div className="text-xs font-semibold">
                {isActuallyOffline ? 'Offline' : signal.qualityLabel}
              </div>
              <div className="text-[10px] text-slate-400">
                {isActuallyOffline ? 'No signal (Offline mode)' : `${signal.bars} of 4 signal stripes active`}
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
              isActuallyOffline 
                ? "bg-rose-500/10 text-rose-500" 
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            )}>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                isActuallyOffline ? "bg-rose-500" : "bg-emerald-500 animate-pulse"
              )} />
              {isActuallyOffline ? 'Offline' : 'Live'}
            </span>
          </div>
        </div>

        {/* Real-time stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Latency */}
          <div className={cn(
            "p-2 rounded-xl text-left",
            isDark ? "bg-slate-800/50" : "bg-slate-50 border border-slate-100"
          )}>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
              <Zap size={11} className="text-amber-500" />
              <span>Ping / Latency</span>
            </div>
            <div className={cn("text-xs font-extrabold mt-0.5", pingColor)}>
              {isActuallyOffline ? 'Disconnected' : signal.latency ? `${signal.latency} ms` : 'Testing...'}
            </div>
          </div>

          {/* Connection Type */}
          <div className={cn(
            "p-2 rounded-xl text-left",
            isDark ? "bg-slate-800/50" : "bg-slate-50 border border-slate-100"
          )}>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
              <Wifi size={11} className="text-blue-500" />
              <span>Network Type</span>
            </div>
            <div className="text-xs font-extrabold text-slate-700 dark:text-slate-200 mt-0.5">
              {isActuallyOffline 
                ? 'No Internet' 
                : `${signal.effectiveType.toUpperCase()}${signal.downlink ? ` (${signal.downlink}M)` : ''}`}
            </div>
          </div>
        </div>

        {/* Sync state message */}
        <div className="text-[10.5px] text-slate-400 mb-3 px-0.5 leading-relaxed">
          {isActuallyOffline ? (
            <span>Entries are cached locally and will auto-sync once reconnected.</span>
          ) : pendingCount > 0 ? (
            <span className="text-amber-500 font-medium">{pendingCount} offline entries waiting to sync to server.</span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <Check size={12} /> Real-time connection active. All data synced.
            </span>
          )}
        </div>

        {/* Action: Test Signal Now */}
        <button
          type="button"
          disabled={signal.isChecking || isActuallyOffline}
          onClick={handleManualTestSignal}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs",
            isDark 
              ? "bg-indigo-600 hover:bg-indigo-500 text-white" 
              : "bg-indigo-600 hover:bg-indigo-700 text-white"
          )}
        >
          <RefreshCw size={12} className={cn("shrink-0", signal.isChecking && "animate-spin")} />
          <span>{signal.isChecking ? 'Measuring Real-Time Ping...' : 'Test Signal Now'}</span>
        </button>
      </div>
    );
  };

  // 1. OFFLINE STATE
  if (isActuallyOffline) {
    return (
      <div className="relative inline-flex items-center">
        <button 
          type="button"
          onClick={handleBadgeClick}
          title="Device is offline. Tap on mobile to refresh signal."
          aria-label="Offline. Tap to refresh connection"
          className={cn(
            "inline-flex items-center justify-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1 rounded-full text-[11px] font-bold tracking-tight transition-all cursor-pointer select-none active:scale-95 border",
            isDark 
              ? "bg-red-950/40 text-red-400 hover:bg-red-900/50 border-red-800/60 shadow-xs" 
              : "bg-red-50 text-red-600 hover:bg-red-100 border-red-200/80 shadow-xs",
            className
          )}
        >
          <div className="relative flex items-center justify-center">
            <NetworkSignalStripes 
              bars={0} 
              quality="offline" 
              size="sm" 
              isChecking={isRefreshingMobile}
            />
            {isRefreshingMobile && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            )}
          </div>
          {/* Online/Offline text ONLY on desktop view */}
          <span className="hidden sm:inline truncate text-red-600 dark:text-red-400 font-bold">Offline</span>
        </button>
        {renderDetailPopover()}
      </div>
    );
  }

  // 2. SYNCING STATE
  if (syncState === 'SYNCING') {
    return (
      <div className="relative inline-flex items-center">
        <button 
          type="button"
          onClick={handleBadgeClick}
          title="Syncing entries with server. Tap on mobile to refresh."
          aria-label="Syncing offline entries"
          className={cn(
            "inline-flex items-center justify-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1 rounded-full text-[11px] font-semibold tracking-tight transition-all cursor-pointer select-none active:scale-95 border",
            isDark 
              ? "bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/50 border-indigo-800/60 shadow-xs" 
              : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border-indigo-200/80 shadow-xs",
            className
          )}
        >
          <NetworkSignalStripes 
            bars={signal.bars} 
            quality={signal.quality} 
            isChecking={true} 
            size="sm" 
          />
          <RefreshCw size={11} className="animate-spin text-indigo-500 shrink-0" />
          {/* Text ONLY on desktop view */}
          <span className="hidden sm:inline truncate">Syncing...</span>
        </button>
        {renderDetailPopover()}
      </div>
    );
  }

  // 3. PENDING ENTRIES WAITING TO SYNC
  if (pendingCount > 0) {
    return (
      <div className="relative inline-flex items-center">
        <button
          type="button"
          onClick={handleBadgeClick}
          title={`${pendingCount} offline entries waiting. Tap to sync now.`}
          aria-label={`${pendingCount} pending entries. Tap to sync.`}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1 rounded-full text-[11px] font-semibold tracking-tight transition-all cursor-pointer select-none active:scale-95 border",
            isDark 
              ? "bg-amber-950/40 text-amber-300 hover:bg-amber-900/50 border-amber-800/60 shadow-xs" 
              : "bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200/80 shadow-xs",
            className
          )}
        >
          <NetworkSignalStripes 
            bars={signal.bars} 
            quality={signal.quality} 
            isChecking={signal.isChecking || isRefreshingMobile} 
            size="sm" 
          />
          <Clock size={11} className="text-amber-500 animate-pulse shrink-0" />
          {/* Text ONLY on desktop view */}
          <span className="hidden sm:inline truncate">{pendingCount} {pendingCount === 1 ? 'entry' : 'entries'}</span>
        </button>
        {renderDetailPopover()}
      </div>
    );
  }

  // 4. NORMAL ONLINE STATE (Real-Time Signal Stripes)
  return (
    <div className="relative inline-flex items-center">
      <button 
        type="button"
        onClick={handleBadgeClick}
        title={
          typeof window !== 'undefined' && window.innerWidth < 640 
            ? `Signal: ${signal.bars}/4 bars. Tap to refresh signal.` 
            : `Connected (${signal.qualityLabel} • ${signal.latency ? `${signal.latency}ms` : '4G'}). Tap to view details.`
        }
        aria-label={`Signal strength: ${signal.bars} of 4 bars. Tap to refresh.`}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1 rounded-full text-[11px] font-semibold tracking-tight transition-all cursor-pointer select-none border active:scale-95",
          isDark 
            ? "bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-slate-700/60 hover:border-slate-600" 
            : "bg-slate-50/90 hover:bg-slate-100 text-slate-700 border-slate-200/70 hover:border-slate-300",
          isRefreshingMobile && "ring-2 ring-indigo-500/50 bg-indigo-50/40 dark:bg-indigo-950/40",
          className
        )}
      >
        <div className="relative flex items-center justify-center">
          <NetworkSignalStripes 
            bars={signal.bars} 
            quality={signal.quality} 
            isChecking={signal.isChecking || isRefreshingMobile}
            size="sm" 
          />
          {isRefreshingMobile && (
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
          )}
        </div>

        {/* "Online" text is ONLY visible on desktop view */}
        <span className="hidden sm:inline">Online</span>

        {/* Optional latency display on desktop view */}
        {signal.latency && (
          <span className="hidden md:inline text-[9.5px] font-normal text-slate-400 dark:text-slate-500">
            {signal.latency}ms
          </span>
        )}
      </button>

      {renderDetailPopover()}
    </div>
  );
};
