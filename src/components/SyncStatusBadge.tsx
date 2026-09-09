import React, { useState, useEffect } from 'react';
import { syncManager, NetworkState, SyncStateMode } from '../services/syncManager';
import { CloudOff, RefreshCw, Check, Clock, Wifi } from 'lucide-react';
import { cn } from '../lib/utils';

interface SyncStatusBadgeProps {
  theme?: string;
  className?: string;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ theme = 'light', className }) => {
  const [networkState, setNetworkState] = useState<NetworkState>(syncManager.network.state);
  const [syncState, setSyncState] = useState<SyncStateMode>(syncManager.syncState);
  const [pendingCount, setPendingCount] = useState<number>(syncManager.pendingCount);

  useEffect(() => {
    // Subscribe to network monitor
    const unsubNetwork = syncManager.network.subscribe((net) => {
      setNetworkState(net);
    });

    // Subscribe to sync manager updates
    const unsubSync = syncManager.subscribe(() => {
      setSyncState(syncManager.syncState);
      setPendingCount(syncManager.pendingCount);
    });

    return () => {
      unsubNetwork();
      unsubSync();
    };
  }, []);

  const isDark = theme === 'dark';

  // 1. OFFLINE STATE
  if (networkState === 'offline') {
    return (
      <div 
        title="Your device is offline. You can still add Cash In and Cash Out entries; they will be stored safely and synced once you're back online."
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-tight transition-all select-none",
          isDark 
            ? "bg-amber-950/40 text-amber-300 border border-amber-800/60 shadow-xs" 
            : "bg-amber-50 text-amber-800 border border-amber-200/80 shadow-xs",
          className
        )}
      >
        <CloudOff size={13} className="text-amber-500 animate-pulse shrink-0" />
        <span className="truncate">Offline • Entries can be saved locally</span>
      </div>
    );
  }

  // 2. SYNCING STATE
  if (syncState === 'SYNCING') {
    return (
      <div 
        title="Syncing your offline entries with the cloud..."
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-tight transition-all select-none",
          isDark 
            ? "bg-indigo-950/40 text-indigo-300 border border-indigo-800/60 shadow-xs" 
            : "bg-indigo-50 text-indigo-800 border border-indigo-200/80 shadow-xs",
          className
        )}
      >
        <RefreshCw size={12} className="animate-spin text-indigo-500 shrink-0" />
        <span className="truncate">Syncing offline entries...</span>
      </div>
    );
  }

  // 3. SYNC COMPLETE STATE
  if (syncState === 'SYNC_COMPLETE') {
    return (
      <div 
        title="All offline entries have been successfully saved to the server."
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-tight transition-all select-none",
          isDark 
            ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800/60 shadow-xs" 
            : "bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs",
          className
        )}
      >
        <Check size={13} className="text-emerald-500 shrink-0" />
        <span className="truncate">All entries synced</span>
      </div>
    );
  }

  // 4. PENDING ENTRIES WAITING TO SYNC
  if (pendingCount > 0) {
    return (
      <button
        type="button"
        onClick={() => syncManager.triggerSync()}
        title="Tap to retry syncing offline entries now"
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-tight transition-all cursor-pointer select-none",
          isDark 
            ? "bg-amber-950/40 text-amber-300 hover:bg-amber-900/40 border border-amber-800/60 shadow-xs" 
            : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/80 shadow-xs",
          className
        )}
      >
        <Clock size={12} className="text-amber-500 animate-pulse shrink-0" />
        <span className="truncate">{pendingCount} {pendingCount === 1 ? 'entry' : 'entries'} waiting to sync</span>
      </button>
    );
  }

  // 5. NORMAL ONLINE STATE (Subtle indicator)
  return (
    <div 
      title="Connected to TrackBook Cloud"
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all select-none",
        isDark ? "text-slate-400" : "text-slate-500",
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
      <span>Online</span>
    </div>
  );
};
