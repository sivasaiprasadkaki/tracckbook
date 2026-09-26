/**
 * TrackBook Sync Manager (Online-First Architecture)
 * 
 * STRICT ARCHITECTURAL REQUIREMENTS:
 * - IndexedDB is completely removed from entry & cashbook data persistence.
 * - TrackBook is online-first: the Supabase PostgreSQL database is the single source of truth.
 * - No offline queues, no offline retries, no second local database.
 * - Provides network state monitoring and clean integration with DownloadCenter / SyncStatusBadge.
 */

export type NetworkState = 'good' | 'slow' | 'offline';
export type SyncStateMode = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'SYNC_COMPLETE';

export interface OfflineEntry {
  id: string;
  clientEntryId?: string;
  cashbook_id: string;
  user_id: string;
  user_name: string;
  amount: number;
  type: 'in' | 'out';
  description: string;
  category: string;
  mode: string;
  date: string;
  created_at: string;
  syncStatus?: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount?: number;
  lastError?: string;
  source?: string;
  images?: any[];
  is_offline?: boolean;
}

export interface OfflineCashbook {
  id: string;
  name: string;
  user_id?: string;
  user_name?: string;
  created_at: string;
  syncStatus?: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  lastError?: string;
  retryCount?: number;
}

export interface SyncQueueItem {
  id: string;
  type: 'CREATE_ENTRY' | 'UPDATE_ENTRY' | 'DELETE_ENTRY' | 'CREATE_CASHBOOK';
  status: 'pending' | 'syncing' | 'completed' | 'failed' | 'uploading' | 'scanning' | 'waiting_for_internet';
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  createdAt: string;
  payload: any;
  error?: string;
}

const DB_NAME = 'trackbook_offline_db';
const STORE_ENTRIES = 'offline_entries';
const STORE_CACHED_BOOKS = 'cached_cashbooks';

/**
 * Lightweight database helper for clearing legacy stores safely
 */
export class TrackBookOfflineDB {
  async init(): Promise<IDBDatabase | null> {
    return null;
  }

  async getPendingEntries(): Promise<any[]> {
    return [];
  }

  async getPendingCashbooks(): Promise<any[]> {
    return [];
  }

  async getCachedCashbooks(_userId?: string): Promise<any[]> {
    return [];
  }

  async getLocalImage(_id: string): Promise<any> {
    return null;
  }

  async saveCachedCashbooks(_cashbooks: any[], _userId?: string): Promise<boolean> {
    return true;
  }

  async deleteCashbook(id: string): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.indexedDB) {
        const req = window.indexedDB.open(DB_NAME);
        req.onsuccess = () => {
          const db = req.result;
          if (db.objectStoreNames.contains(STORE_CACHED_BOOKS)) {
            const tx = db.transaction(STORE_CACHED_BOOKS, 'readwrite');
            tx.objectStore(STORE_CACHED_BOOKS).delete(id);
          }
          if (db.objectStoreNames.contains(STORE_ENTRIES)) {
            const tx = db.transaction(STORE_ENTRIES, 'readwrite');
            const store = tx.objectStore(STORE_ENTRIES);
            const index = store.index('cashbook_id');
            const request = index.getAllKeys(id);
            request.onsuccess = () => {
              const keys = request.result || [];
              keys.forEach(k => store.delete(k));
            };
          }
        };
      }
    } catch (_) {}
    return true;
  }

  async deleteCachedCashbook(id: string, _userId?: string): Promise<boolean> {
    return this.deleteCashbook(id);
  }

  async clearAllData(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.indexedDB) {
        const req = window.indexedDB.open(DB_NAME);
        req.onsuccess = () => {
          const db = req.result;
          if (db.objectStoreNames.contains(STORE_ENTRIES)) {
            const tx = db.transaction(STORE_ENTRIES, 'readwrite');
            tx.objectStore(STORE_ENTRIES).clear();
          }
          if (db.objectStoreNames.contains(STORE_CACHED_BOOKS)) {
            const tx = db.transaction(STORE_CACHED_BOOKS, 'readwrite');
            tx.objectStore(STORE_CACHED_BOOKS).clear();
          }
        };
      }
    } catch (_) {}
    return true;
  }
}

/**
 * Reliable real-time network monitor directly tracking browser online status
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
      this.state = navigator.onLine ? 'good' : 'offline';
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
    this.updateState('good');
    return true;
  }

  subscribe(listener: (state: NetworkState) => void) {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

/**
 * Online-first synchronization coordinator
 */
export class BackgroundSyncManager {
  public db = new TrackBookOfflineDB();
  public network = new NetworkMonitor();
  public isSyncing = false;
  public pendingCount = 0;
  public syncState: SyncStateMode = 'ONLINE';

  private listeners: (() => void)[] = [];
  private entrySyncedCallbacks: ((clientEntryId: string, syncedEntry: any) => void)[] = [];
  private cashbookSyncedCallbacks: ((cashbookId: string, syncedBook: any) => void)[] = [];
  private toastListeners: ((msg: string, type: 'success' | 'info' | 'error') => void)[] = [];

  constructor() {
    this.init();
  }

  async init() {
    this.network.subscribe((state) => {
      if (state === 'good') {
        this.setSyncState('ONLINE');
      } else {
        this.setSyncState('OFFLINE');
      }
    });
    return true;
  }

  public async deleteCashbook(id: string, userId?: string): Promise<boolean> {
    await this.db.deleteCashbook(id);
    this.notify();
    return true;
  }

  public setSyncState(newState: SyncStateMode) {
    this.syncState = newState;
    this.notify();
  }

  public async refreshPendingCount(): Promise<number> {
    this.pendingCount = 0;
    this.syncState = this.network.state === 'offline' ? 'OFFLINE' : 'ONLINE';
    this.notify();
    return 0;
  }

  public getPendingCount(): number {
    return 0;
  }

  public getQueueList(): SyncQueueItem[] {
    return [];
  }

  public subscribe(cb: () => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  public subscribeToToasts(cb: (msg: string, type: 'success' | 'info' | 'error') => void) {
    this.toastListeners.push(cb);
    return () => {
      this.toastListeners = this.toastListeners.filter(l => l !== cb);
    };
  }

  public onEntrySynced(cb: (clientEntryId: string, syncedEntry: any) => void) {
    this.entrySyncedCallbacks.push(cb);
    return () => {
      this.entrySyncedCallbacks = this.entrySyncedCallbacks.filter(c => c !== cb);
    };
  }

  public onCashbookSynced(cb: (cashbookId: string, syncedBook: any) => void) {
    this.cashbookSyncedCallbacks.push(cb);
    return () => {
      this.cashbookSyncedCallbacks = this.cashbookSyncedCallbacks.filter(c => c !== cb);
    };
  }

  public notify() {
    this.listeners.forEach(l => {
      try { l(); } catch (e) { console.error('[SyncManager] notify error:', e); }
    });
  }

  // Offline creation is strictly disallowed in online-first architecture
  async saveOfflineCashbook(_book: any): Promise<boolean> {
    throw new Error('Offline cashbook creation is disabled. An internet connection is required.');
  }

  async saveOfflineEntry(_entry: any): Promise<boolean> {
    throw new Error('Offline entry creation is disabled. An internet connection is required.');
  }

  async retryAllPendingJobs(): Promise<boolean> {
    return true;
  }

  async triggerSync(): Promise<boolean> {
    return true;
  }
}

export const syncManager = new BackgroundSyncManager();
export const offlineDb = syncManager.db;
