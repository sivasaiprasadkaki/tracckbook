import { supabase } from '../lib/supabase';

export type NetworkState = 'good' | 'slow' | 'offline';

export interface OfflineEntry {
  id: string; // client-generated unique UUID / idempotency key
  clientEntryId: string;
  cashbook_id: string;
  user_id: string;
  user_name: string;
  amount: number;
  type: 'in' | 'out';
  description: string;
  category: string;
  mode: string;
  date: string; // ISO string
  created_at: string; // ISO string
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  lastError?: string;
  source: string; // 'Offline Sync' or 'Manual'
  images: any[]; // strictly [] for offline entries
  is_offline?: boolean;
}

export interface SyncQueueItem {
  id: string;
  type: 'CREATE_ENTRY' | 'UPDATE_ENTRY' | 'DELETE_ENTRY';
  status: 'pending' | 'syncing' | 'completed' | 'failed' | 'uploading' | 'scanning' | 'waiting_for_internet';
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  createdAt: string;
  payload: any;
  error?: string;
}

const DB_NAME = 'trackbook_offline_db';
const DB_VERSION = 1;
const STORE_ENTRIES = 'offline_entries';
const LOCAL_STORAGE_KEY = 'trackbook_offline_pending_entries_v1';

/**
 * Robust IndexedDB storage engine with automatic localStorage fallback
 */
export class TrackBookOfflineDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase | null> | null = null;

  async init(): Promise<IDBDatabase | null> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('[OfflineDB] IndexedDB not available, using localStorage fallback');
      return null;
    }

    this.initPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e: any) => {
          const db = e.target.result as IDBDatabase;
          if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
            const store = db.createObjectStore(STORE_ENTRIES, { keyPath: 'id' });
            store.createIndex('cashbook_id', 'cashbook_id', { unique: false });
            store.createIndex('syncStatus', 'syncStatus', { unique: false });
            store.createIndex('created_at', 'created_at', { unique: false });
          }
        };

        req.onsuccess = (e: any) => {
          this.db = e.target.result;
          resolve(this.db);
        };

        req.onerror = (e) => {
          console.warn('[OfflineDB] Failed to open IndexedDB:', e);
          resolve(null);
        };
      } catch (err) {
        console.warn('[OfflineDB] Error initializing IndexedDB:', err);
        resolve(null);
      }
    });

    return this.initPromise;
  }

  // LocalStorage fallback helpers
  private getLocalBackup(): OfflineEntry[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  private setLocalBackup(entries: OfflineEntry[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.warn('[OfflineDB] Failed to write localStorage backup:', e);
    }
  }

  /**
   * Save or update an offline entry
   */
  async saveEntry(entry: OfflineEntry): Promise<boolean> {
    // 1. Update localStorage fallback
    try {
      const local = this.getLocalBackup();
      const idx = local.findIndex(e => e.id === entry.id);
      if (idx >= 0) {
        local[idx] = entry;
      } else {
        local.push(entry);
      }
      this.setLocalBackup(local);
    } catch (err) {
      console.warn('[OfflineDB] localStorage backup error:', err);
    }

    // 2. Update IndexedDB
    try {
      const db = await this.init();
      if (!db) return true;

      return new Promise<boolean>((resolve) => {
        const tx = db.transaction(STORE_ENTRIES, 'readwrite');
        const store = tx.objectStore(STORE_ENTRIES);
        store.put(entry);

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch {
      return true;
    }
  }

  /**
   * Retrieve all pending offline entries
   */
  async getPendingEntries(cashbookId?: string): Promise<OfflineEntry[]> {
    try {
      const db = await this.init();
      if (!db) {
        const local = this.getLocalBackup().filter(e => e.syncStatus === 'PENDING' || e.syncStatus === 'SYNCING' || e.syncStatus === 'FAILED');
        return cashbookId ? local.filter(e => e.cashbook_id === cashbookId) : local;
      }

      return new Promise<OfflineEntry[]>((resolve) => {
        const tx = db.transaction(STORE_ENTRIES, 'readonly');
        const store = tx.objectStore(STORE_ENTRIES);
        const req = store.getAll();

        req.onsuccess = () => {
          const items: OfflineEntry[] = req.result || [];
          const pending = items.filter(e => e.syncStatus === 'PENDING' || e.syncStatus === 'SYNCING' || e.syncStatus === 'FAILED');
          
          // Merge with localStorage just in case
          const local = this.getLocalBackup().filter(e => e.syncStatus === 'PENDING' || e.syncStatus === 'SYNCING' || e.syncStatus === 'FAILED');
          const map = new Map<string, OfflineEntry>();
          local.forEach(e => map.set(e.id, e));
          pending.forEach(e => map.set(e.id, e));
          const merged = Array.from(map.values());

          if (cashbookId) {
            resolve(merged.filter(e => e.cashbook_id === cashbookId));
          } else {
            resolve(merged);
          }
        };

        req.onerror = () => {
          const local = this.getLocalBackup().filter(e => e.syncStatus === 'PENDING' || e.syncStatus === 'SYNCING' || e.syncStatus === 'FAILED');
          resolve(cashbookId ? local.filter(e => e.cashbook_id === cashbookId) : local);
        };
      });
    } catch {
      const local = this.getLocalBackup().filter(e => e.syncStatus === 'PENDING' || e.syncStatus === 'SYNCING' || e.syncStatus === 'FAILED');
      return cashbookId ? local.filter(e => e.cashbook_id === cashbookId) : local;
    }
  }

  /**
   * Retrieve all entries for a specific cashbook (including pending offline ones)
   */
  async getEntries(cashbookId: string): Promise<OfflineEntry[]> {
    return this.getPendingEntries(cashbookId);
  }

  async getEntry(id: string): Promise<OfflineEntry | null> {
    const local = this.getLocalBackup().find(e => e.id === id);
    if (local) return local;

    try {
      const db = await this.init();
      if (!db) return null;

      return new Promise<OfflineEntry | null>((resolve) => {
        const tx = db.transaction(STORE_ENTRIES, 'readonly');
        const store = tx.objectStore(STORE_ENTRIES);
        const req = store.get(id);

        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Update entry sync status
   */
  async updateEntryStatus(id: string, status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED', error?: string): Promise<boolean> {
    const local = this.getLocalBackup();
    const item = local.find(e => e.id === id);
    if (item) {
      item.syncStatus = status;
      if (error) item.lastError = error;
      if (status === 'FAILED') item.retryCount = (item.retryCount || 0) + 1;
      this.setLocalBackup(local);
    }

    try {
      const db = await this.init();
      if (!db) return true;

      return new Promise<boolean>((resolve) => {
        const tx = db.transaction(STORE_ENTRIES, 'readwrite');
        const store = tx.objectStore(STORE_ENTRIES);
        const req = store.get(id);

        req.onsuccess = () => {
          const entry = req.result as OfflineEntry;
          if (entry) {
            entry.syncStatus = status;
            if (error) entry.lastError = error;
            if (status === 'FAILED') entry.retryCount = (entry.retryCount || 0) + 1;
            store.put(entry);
          }
          resolve(true);
        };

        req.onerror = () => resolve(false);
      });
    } catch {
      return true;
    }
  }

  /**
   * Mark an entry as synced
   */
  async markEntrySynced(id: string): Promise<boolean> {
    // We update status to 'SYNCED' and keep it briefly, or purge from pending backup
    const local = this.getLocalBackup().filter(e => e.id !== id);
    this.setLocalBackup(local);

    try {
      const db = await this.init();
      if (!db) return true;

      return new Promise<boolean>((resolve) => {
        const tx = db.transaction(STORE_ENTRIES, 'readwrite');
        const store = tx.objectStore(STORE_ENTRIES);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch {
      return true;
    }
  }

  /**
   * Delete entry from offline storage
   */
  async deleteEntry(id: string): Promise<boolean> {
    return this.markEntrySynced(id);
  }

  getLocalEntries(): OfflineEntry[] {
    return this.getLocalBackup();
  }

  async getLocalImage(id: string): Promise<{ id: string; data: string } | null> {
    const raw = localStorage.getItem();
    if (raw) return { id, data: raw };
    return null;
  }

  async saveLocalImage(id: string, data: string): Promise<void> {
    try {
      localStorage.setItem(, data);
    } catch {}
  }

  async clearAllData(): Promise<boolean> {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      const db = await this.init();
      if (!db) return true;

      return new Promise<boolean>((resolve) => {
        const tx = db.transaction(STORE_ENTRIES, 'readwrite');
        const store = tx.objectStore(STORE_ENTRIES);
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch {
      return true;
    }
  }
}

/**
 * Real-time network monitor with ping verification
 */
export class NetworkMonitor {
  public state: NetworkState = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'good';
  private listeners: ((state: NetworkState) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.updateState('good');
      });
      window.addEventListener('offline', () => {
        this.updateState('offline');
      });
      if (!navigator.onLine) {
        this.state = 'offline';
      }
    }
  }

  public updateState(newState: NetworkState) {
    if (this.state === newState) return;
    this.state = newState;
    this.listeners.forEach(l => {
      try {
        l(newState);
      } catch (err) {
        console.error('[NetworkMonitor] listener error:', err);
      }
    });
  }

  public async checkConnection(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.updateState('offline');
      return false;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`/api/health?t=${Date.now()}`, { 
        method: 'GET', 
        cache: 'no-store',
        signal: controller.signal 
      }).catch(() => null);
      clearTimeout(timeout);
      
      const isOnline = res !== null && res.status < 500;
      this.updateState(isOnline ? 'good' : 'offline');
      return isOnline;
    } catch {
      this.updateState('offline');
      return false;
    }
  }

  subscribe(listener: (state: NetworkState) => void) {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

export type SyncStateMode = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'SYNC_COMPLETE';

/**
 * Background synchronization coordinator
 */
export class BackgroundSyncManager {
  public db = new TrackBookOfflineDB();
  public network = new NetworkMonitor();
  public isSyncing = false;
  public pendingCount = 0;
  public syncState: SyncStateMode = 'ONLINE';

  private listeners: (() => void)[] = [];
  private entrySyncedCallbacks: ((clientEntryId: string, syncedEntry: any) => void)[] = [];
  private toastListeners: ((msg: string, type: 'success' | 'info' | 'error') => void)[] = [];
  private retryTimeout: any = null;

  constructor() {
    this.init();
  }

  async init() {
    await this.db.init();
    await this.refreshPendingCount();

    // Subscribe to network changes
    this.network.subscribe((state) => {
      if (state === 'good') {
        if (this.pendingCount > 0) {
          this.triggerSync();
        } else {
          this.setSyncState('ONLINE');
        }
      } else {
        this.setSyncState('OFFLINE');
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.triggerSync();
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine && this.pendingCount > 0) {
          this.triggerSync();
        }
      });

      // Periodic check every 25 seconds if online and items exist
      setInterval(() => {
        if (navigator.onLine && this.pendingCount > 0 && !this.isSyncing) {
          this.triggerSync();
        }
      }, 25000);
    }

    return true;
  }

  public setSyncState(newState: SyncStateMode) {
    this.syncState = newState;
    this.notify();
  }

  public async refreshPendingCount(): Promise<number> {
    try {
      const items = await this.db.getPendingEntries();
      this.pendingCount = items.length;
      if (this.network.state === 'offline') {
        this.syncState = 'OFFLINE';
      } else if (this.isSyncing) {
        this.syncState = 'SYNCING';
      } else if (this.pendingCount === 0) {
        this.syncState = 'ONLINE';
      }
      this.notify();
      return this.pendingCount;
    } catch {
      return this.pendingCount;
    }
  }

  subscribe(cb: () => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  onEntrySynced(cb: (clientEntryId: string, syncedEntry: any) => void) {
    this.entrySyncedCallbacks.push(cb);
    return () => {
      this.entrySyncedCallbacks = this.entrySyncedCallbacks.filter(c => c !== cb);
    };
  }

  subscribeToToasts(cb: (msg: string, type: 'success' | 'info' | 'error') => void) {
    this.toastListeners.push(cb);
    return () => {
      this.toastListeners = this.toastListeners.filter(l => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach(l => {
      try { l(); } catch (e) { console.error('[SyncManager] notify error:', e); }
    });
  }

  private emitToast(msg: string, type: 'success' | 'info' | 'error') {
    this.toastListeners.forEach(l => {
      try { l(msg, type); } catch {}
    });
  }

  /**
   * Save a newly created entry while offline
   */
  async saveOfflineEntry(entry: OfflineEntry): Promise<boolean> {
    const success = await this.db.saveEntry(entry);
    await this.refreshPendingCount();
    this.emitToast('Entry saved offline • Will sync automatically when connected', 'info');
    return success;
  }

  /**
   * Trigger background sync of all pending offline entries
   */
  async triggerSync() {
    if (this.isSyncing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setSyncState('OFFLINE');
      return;
    }

    const pending = await this.db.getPendingEntries();
    if (pending.length === 0) {
      this.pendingCount = 0;
      this.setSyncState('ONLINE');
      return;
    }

    this.isSyncing = true;
    this.setSyncState('SYNCING');

    // Sort by created_at ascending to preserve creation order
    pending.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let hasErrors = false;
    let syncedInThisRun = 0;

    for (const entry of pending) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        hasErrors = true;
        break;
      }

      try {
        await this.db.updateEntryStatus(entry.id, 'SYNCING');

        // 1. Send to server idempotent sync endpoint
        let syncSuccess = false;
        let syncedData: any = null;

        try {
          const res = await fetch('/api/sync/offline-entry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientEntryId: entry.clientEntryId || entry.id,
              entry: {
                id: entry.clientEntryId || entry.id,
                cashbook_id: entry.cashbook_id,
                user_id: entry.user_id,
                user_name: entry.user_name || 'User',
                amount: entry.amount,
                type: entry.type,
                description: entry.description,
                category: entry.category,
                mode: entry.mode,
                date: entry.date,
                created_at: entry.created_at,
                source: 'Offline Sync'
              }
            })
          });

          if (res.ok) {
            const result = await res.json();
            if (result.success) {
              syncSuccess = true;
              syncedData = result.entry;
            }
          }
        } catch (apiErr) {
          console.warn('[SyncManager] API endpoint failed, attempting direct Supabase upsert:', apiErr);
        }

        // 2. Direct Supabase fallback if server API was unavailable
        if (!syncSuccess && supabase) {
          const payload = {
            id: entry.clientEntryId || entry.id,
            cashbook_id: entry.cashbook_id,
            user_id: entry.user_id,
            user_name: entry.user_name || 'User',
            amount: entry.amount,
            type: entry.type,
            description: entry.description,
            category: entry.category,
            mode: entry.mode,
            date: entry.date,
            created_at: entry.created_at,
            source: 'Offline Sync'
          };

          const { data: sbData, error: sbErr } = await supabase
            .from('entries')
            .upsert([payload], { onConflict: 'id' })
            .select()
            .maybeSingle();

          if (!sbErr) {
            syncSuccess = true;
            syncedData = sbData || payload;
          } else {
            console.error('[SyncManager] Supabase direct sync error:', sbErr);
          }
        }

        if (syncSuccess) {
          await this.db.markEntrySynced(entry.id);
          syncedInThisRun++;
          // Notify app UI so the entry in the list turns from "Offline • Pending Sync" to normal synced state
          this.entrySyncedCallbacks.forEach(cb => {
            try { cb(entry.id, syncedData); } catch (e) { console.error(e); }
          });
        } else {
          hasErrors = true;
          await this.db.updateEntryStatus(entry.id, 'PENDING', 'Failed to sync with backend');
        }
      } catch (e: any) {
        hasErrors = true;
        console.error('[SyncManager] Error syncing entry:', entry.id, e);
        await this.db.updateEntryStatus(entry.id, 'PENDING', e.message || 'Network error');
      }
    }

    this.isSyncing = false;
    await this.refreshPendingCount();

    if (this.pendingCount === 0) {
      this.setSyncState('SYNC_COMPLETE');
      if (syncedInThisRun > 0) {
        this.emitToast('All entries synced successfully', 'success');
      }
      // Revert to ONLINE badge after 4 seconds
      setTimeout(() => {
        if (this.pendingCount === 0 && this.network.state === 'good') {
          this.setSyncState('ONLINE');
        }
      }, 4000);
    } else {
      if (this.network.state === 'offline') {
        this.setSyncState('OFFLINE');
      } else {
        this.setSyncState('ONLINE');
        // Schedule retry with backoff
        clearTimeout(this.retryTimeout);
        this.retryTimeout = setTimeout(() => {
          if (navigator.onLine && this.pendingCount > 0) {
            this.triggerSync();
          }
        }, 12000);
      }
    }
  }

  getQueueList(): SyncQueueItem[] {
    const local = this.db.getLocalEntries();
    return local.map(e => ({
      id: e.id,
      type: 'CREATE_ENTRY' as const,
      status: e.syncStatus === 'SYNCED' ? ('completed' as const) : e.syncStatus === 'SYNCING' ? ('syncing' as const) : ('pending' as const),
      priority: 'high' as const,
      retryCount: e.retryCount,
      createdAt: e.created_at,
      payload: e,
      error: e.lastError
    }));
  }

  getPendingCount(): number {
    return this.pendingCount;
  }
}

export const syncManager = new BackgroundSyncManager();
export const offlineDb = syncManager.db;
