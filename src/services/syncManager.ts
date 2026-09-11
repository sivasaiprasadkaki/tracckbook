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

export interface OfflineCashbook {
  id: string;
  name: string;
  user_id?: string;
  user_name?: string;
  created_at: string;
  syncStatus: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
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
const DB_VERSION = 2;
const STORE_ENTRIES = 'offline_entries';
const STORE_CACHED_BOOKS = 'cached_cashbooks';
const LOCAL_STORAGE_KEY = 'trackbook_offline_pending_entries_v1';
const LOCAL_STORAGE_BOOKS_PREFIX = 'trackbook_cached_books_';

/**
 * Robust IndexedDB storage engine with automatic localStorage fallback
 */
export class TrackBookOfflineDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase | null> | null = null;
  private memEntries: Map<string, OfflineEntry> = new Map();
  private onDataChange?: () => void;

  setOnDataChange(cb: () => void) {
    this.onDataChange = cb;
  }

  async init(): Promise<IDBDatabase | null> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('[OfflineDB] IndexedDB not available, using localStorage fallback');
      this.loadLocalStorageIntoMem();
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
          if (!db.objectStoreNames.contains(STORE_CACHED_BOOKS)) {
            const bookStore = db.createObjectStore(STORE_CACHED_BOOKS, { keyPath: 'id' });
            bookStore.createIndex('user_id', 'user_id', { unique: false });
            bookStore.createIndex('updated_at', 'updated_at', { unique: false });
          }
        };

        req.onsuccess = (e: any) => {
          this.db = e.target.result;
          this.loadInitialEntries();
          resolve(this.db);
        };

        req.onerror = (e) => {
          console.warn('[OfflineDB] Failed to open IndexedDB:', e);
          this.loadLocalStorageIntoMem();
          resolve(null);
        };
      } catch (err) {
        console.warn('[OfflineDB] Error initializing IndexedDB:', err);
        this.loadLocalStorageIntoMem();
        resolve(null);
      }
    });

    return this.initPromise;
  }

  private loadLocalStorageIntoMem() {
    const local = this.getLocalBackup();
    local.forEach(e => this.memEntries.set(e.id, e));
    this.onDataChange?.();
  }

  private async loadInitialEntries() {
    try {
      const local = this.getLocalBackup();
      local.forEach(e => this.memEntries.set(e.id, e));

      if (!this.db) return;
      const tx = this.db.transaction(STORE_ENTRIES, 'readonly');
      const store = tx.objectStore(STORE_ENTRIES);
      const req = store.getAll();
      req.onsuccess = () => {
        const items: OfflineEntry[] = req.result || [];
        items.forEach(e => this.memEntries.set(e.id, e));
        this.onDataChange?.();
      };
    } catch {}
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
   * Save cached cashbooks and entries to IndexedDB and localStorage
   */
  async saveCachedCashbooks(userId: string, cashbooks: any[]): Promise<boolean> {
    if (!cashbooks || !Array.isArray(cashbooks)) return false;

    // Fast synchronous localStorage write
    try {
      if (userId) {
        localStorage.setItem(`${LOCAL_STORAGE_BOOKS_PREFIX}${userId}`, JSON.stringify(cashbooks));
      }
    } catch (e) {
      console.warn('[OfflineDB] localStorage quota note for cashbooks:', e);
    }

    // Structured IndexedDB write
    try {
      const db = await this.init();
      if (!db || !db.objectStoreNames.contains(STORE_CACHED_BOOKS)) return true;

      return new Promise<boolean>((resolve) => {
        try {
          const tx = db.transaction(STORE_CACHED_BOOKS, 'readwrite');
          const store = tx.objectStore(STORE_CACHED_BOOKS);
          for (const book of cashbooks) {
            if (book && book.id) {
              store.put({
                ...book,
                user_id: userId,
                updated_at: new Date().toISOString()
              });
            }
          }
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    } catch {
      return true;
    }
  }

  /**
   * Read cached cashbooks and entries from IndexedDB (with localStorage fallback)
   */
  async getCachedCashbooks(userId: string): Promise<any[]> {
    // 1. IndexedDB structured read
    try {
      const db = await this.init();
      if (db && db.objectStoreNames.contains(STORE_CACHED_BOOKS)) {
        const books = await new Promise<any[]>((resolve) => {
          try {
            const tx = db.transaction(STORE_CACHED_BOOKS, 'readonly');
            const store = tx.objectStore(STORE_CACHED_BOOKS);
            let req: IDBRequest;
            if (userId && store.indexNames.contains('user_id')) {
              req = store.index('user_id').getAll(userId);
            } else {
              req = store.getAll();
            }
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          } catch {
            resolve([]);
          }
        });

        if (Array.isArray(books) && books.length > 0) {
          return books;
        }
      }
    } catch (e) {
      console.warn('[OfflineDB] Error reading cached cashbooks from IndexedDB:', e);
    }

    // 2. localStorage fallback
    try {
      if (userId) {
        const raw = localStorage.getItem(`${LOCAL_STORAGE_BOOKS_PREFIX}${userId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch {}

    return [];
  }

  /**
   * Get all local offline cashbooks
   */
  getLocalCashbooks(): OfflineCashbook[] {
    try {
      const key = 'trackbook_offline_pending_books_v1';
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  /**
   * Save a newly created cashbook to offline pending storage
   */
  async savePendingCashbook(cb: { id: string; name: string; user_id?: string; user_name?: string; created_at?: string }): Promise<boolean> {
    try {
      const key = 'trackbook_offline_pending_books_v1';
      const list = this.getLocalCashbooks();
      const idx = list.findIndex(item => item.id === cb.id);
      const cashbookRecord: OfflineCashbook = {
        id: cb.id,
        name: cb.name,
        user_id: cb.user_id,
        user_name: cb.user_name,
        created_at: cb.created_at || new Date().toISOString(),
        syncStatus: 'PENDING',
        retryCount: 0
      };
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...cashbookRecord };
      } else {
        list.push(cashbookRecord);
      }
      localStorage.setItem(key, JSON.stringify(list));
      this.onDataChange?.();
      return true;
    } catch (e) {
      console.warn('[OfflineDB] Error saving pending cashbook:', e);
      return false;
    }
  }

  /**
   * Get all pending offline cashbooks awaiting sync
   */
  async getPendingCashbooks(): Promise<OfflineCashbook[]> {
    const list = this.getLocalCashbooks();
    return list.filter(item => item && item.id && item.syncStatus !== 'SYNCED');
  }

  /**
   * Update cashbook sync status
   */
  async updateCashbookStatus(id: string, status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED', error?: string): Promise<boolean> {
    try {
      const key = 'trackbook_offline_pending_books_v1';
      const list = this.getLocalCashbooks();
      const idx = list.findIndex(item => item.id === id);
      if (idx >= 0) {
        list[idx].syncStatus = status;
        if (error !== undefined) list[idx].lastError = error;
        if (status === 'FAILED') list[idx].retryCount = (list[idx].retryCount || 0) + 1;
        localStorage.setItem(key, JSON.stringify(list));
        this.onDataChange?.();
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[OfflineDB] Error updating cashbook status:', e);
      return false;
    }
  }

  /**
   * Mark an offline cashbook as synced
   */
  async markCashbookSynced(id: string): Promise<void> {
    try {
      const key = 'trackbook_offline_pending_books_v1';
      const list = this.getLocalCashbooks();
      const idx = list.findIndex(item => item.id === id);
      if (idx >= 0) {
        list[idx].syncStatus = 'SYNCED';
        list[idx].lastError = undefined;
        localStorage.setItem(key, JSON.stringify(list));
      }
      this.onDataChange?.();
    } catch (e) {
      console.warn('[OfflineDB] Error marking cashbook synced:', e);
    }
  }

  /**
   * Save or update an offline entry
   */
  async saveEntry(entry: OfflineEntry): Promise<boolean> {
    this.memEntries.set(entry.id, entry);

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

    this.onDataChange?.();

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
        const local = this.getLocalEntries().filter(e => e.syncStatus === 'PENDING' || e.syncStatus === 'SYNCING' || e.syncStatus === 'FAILED');
        return cashbookId ? local.filter(e => e.cashbook_id === cashbookId) : local;
      }

      return new Promise<OfflineEntry[]>((resolve) => {
        const tx = db.transaction(STORE_ENTRIES, 'readonly');
        const store = tx.objectStore(STORE_ENTRIES);
        const req = store.getAll();

        req.onsuccess = () => {
          const items: OfflineEntry[] = req.result || [];
          const local = this.getLocalBackup();
          const map = new Map<string, OfflineEntry>();
          local.forEach(e => map.set(e.id, e));
          items.forEach(e => map.set(e.id, e));
          this.memEntries.forEach((v, k) => map.set(k, v));
          
          map.forEach((v, k) => this.memEntries.set(k, v));

          const pending = Array.from(map.values()).filter(e => e.syncStatus === 'PENDING' || e.syncStatus === 'SYNCING' || e.syncStatus === 'FAILED');

          if (cashbookId) {
            resolve(pending.filter(e => e.cashbook_id === cashbookId));
          } else {
            resolve(pending);
          }
        };

        req.onerror = () => {
          const local = this.getLocalEntries().filter(e => e.syncStatus === 'PENDING' || e.syncStatus === 'SYNCING' || e.syncStatus === 'FAILED');
          resolve(cashbookId ? local.filter(e => e.cashbook_id === cashbookId) : local);
        };
      });
    } catch {
      const local = this.getLocalEntries().filter(e => e.syncStatus === 'PENDING' || e.syncStatus === 'SYNCING' || e.syncStatus === 'FAILED');
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
    if (this.memEntries.has(id)) return this.memEntries.get(id)!;

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
    const mem = this.memEntries.get(id);
    if (mem) {
      mem.syncStatus = status;
      if (error !== undefined) mem.lastError = error;
      if (status === 'FAILED') mem.retryCount = (mem.retryCount || 0) + 1;
    }

    const local = this.getLocalBackup();
    const item = local.find(e => e.id === id);
    if (item) {
      item.syncStatus = status;
      if (error !== undefined) item.lastError = error;
      if (status === 'FAILED') item.retryCount = (item.retryCount || 0) + 1;
      this.setLocalBackup(local);
    }

    this.onDataChange?.();

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
            if (error !== undefined) entry.lastError = error;
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
    this.memEntries.delete(id);

    const local = this.getLocalBackup().filter(e => e.id !== id);
    this.setLocalBackup(local);

    this.onDataChange?.();

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
    if (this.memEntries.size === 0) {
      const local = this.getLocalBackup();
      local.forEach(e => this.memEntries.set(e.id, e));
    }
    return Array.from(this.memEntries.values());
  }

  async getLocalImage(id: string): Promise<{ id: string; data: string } | null> {
    try {
      const raw = localStorage.getItem(`trackbook_offline_image_${id}`);
      if (raw) {
        return { id, data: raw };
      }
    } catch {}
    return null;
  }

  async saveLocalImage(id: string, data: string): Promise<void> {
    try {
      localStorage.setItem(`trackbook_offline_image_${id}`, data);
    } catch {}
  }

  async clearAllData(): Promise<boolean> {
    try {
      this.memEntries.clear();
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      this.onDataChange?.();

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
    this.db.setOnDataChange(() => {
      this.refreshPendingCount();
      this.notify();
    });

    await this.db.init();
    await this.refreshPendingCount();

    // Subscribe to network changes
    this.network.subscribe((state) => {
      if (state === 'good') {
        if (this.pendingCount > 0 && !this.isSyncing) {
          this.triggerSync();
        } else if (this.pendingCount === 0) {
          this.setSyncState('ONLINE');
        }
      } else {
        this.setSyncState('OFFLINE');
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[SyncManager] Native online event detected. Immediately triggering sync.');
        this.network.updateState('good');
        this.setSyncState('ONLINE');
        this.notify();
        this.triggerSync();
      });

      window.addEventListener('offline', () => {
        console.log('[SyncManager] Native offline event detected.');
        this.network.updateState('offline');
        this.setSyncState('OFFLINE');
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine && this.pendingCount > 0 && !this.isSyncing) {
          this.triggerSync();
        }
      });

      // Periodic fallback check (only if pending items remain)
      setInterval(() => {
        if (navigator.onLine && this.pendingCount > 0 && !this.isSyncing) {
          this.triggerSync();
        }
      }, 15000);
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
      const pendingBooks = await this.db.getPendingCashbooks();
      this.pendingCount = items.length + pendingBooks.length;
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

  public notify() {
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
   * Save a newly created cashbook while offline
   */
  async saveOfflineCashbook(book: { id: string; name: string; user_id?: string; user_name?: string; created_at?: string }): Promise<boolean> {
    const success = await this.db.savePendingCashbook(book);
    await this.refreshPendingCount();
    this.notify();
    this.emitToast('Cashbook saved offline • Will sync automatically when connected', 'info');
    return success;
  }

  /**
   * Save a newly created entry while offline
   */
  async saveOfflineEntry(entry: OfflineEntry): Promise<boolean> {
    const success = await this.db.saveEntry(entry);
    await this.refreshPendingCount();
    this.notify();
    this.emitToast('Entry saved offline • Will sync automatically when connected', 'info');
    return success;
  }

  /**
   * Manual retry of all queued / failed / stuck pending jobs
   */
  async retryAllPendingJobs(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && (!navigator.onLine || this.network.state === 'offline')) {
      this.emitToast("You're offline. We'll retry when your connection returns.", 'info');
      return false;
    }

    const pendingBooks = await this.db.getPendingCashbooks();
    for (const b of pendingBooks) {
      if (b.syncStatus === 'FAILED' || b.syncStatus === 'SYNCING') {
        await this.db.updateCashbookStatus(b.id, 'PENDING');
      }
    }

    const pending = await this.db.getPendingEntries();
    for (const e of pending) {
      if (e.syncStatus === 'FAILED' || e.syncStatus === 'SYNCING') {
        await this.db.updateEntryStatus(e.id, 'PENDING');
      }
    }
    this.notify();

    return this.triggerSync(true);
  }

  /**
   * Trigger background sync of all pending offline entries
   */
  async triggerSync(isManualRetry = false): Promise<boolean> {
    if (this.isSyncing) {
      console.log('[SyncManager] Sync already in progress, skipping duplicate call.');
      return false;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setSyncState('OFFLINE');
      this.notify();
      return false;
    }

    const pendingBooks = await this.db.getPendingCashbooks();
    const pending = await this.db.getPendingEntries();

    if (pendingBooks.length === 0 && pending.length === 0) {
      this.pendingCount = 0;
      this.setSyncState('ONLINE');
      this.notify();
      return true;
    }

    this.isSyncing = true;
    this.setSyncState('SYNCING');
    this.notify();

    if (isManualRetry) {
      for (const book of pendingBooks) {
        if (book.syncStatus === 'FAILED') {
          await this.db.updateCashbookStatus(book.id, 'PENDING');
        }
      }
      for (const entry of pending) {
        if (entry.syncStatus === 'FAILED') {
          await this.db.updateEntryStatus(entry.id, 'PENDING');
        }
      }
      this.notify();
    }

    let syncedInThisRun = 0;
    let anyFailed = false;

    try {
      // =========================================================================
      // REQUIREMENT: Cashbook MUST sync before dependent entries!
      // =========================================================================
      if (pendingBooks.length > 0) {
        console.log(`[Sync] Found ${pendingBooks.length} pending offline cashbook(s) to synchronize.`);
        for (const book of pendingBooks) {
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            await this.db.updateCashbookStatus(book.id, 'PENDING', 'Waiting for connection');
            this.setSyncState('OFFLINE');
            this.notify();
            break;
          }

          console.log(`[Sync] POST /api/sync action=cashbook for cashbook: ${book.id} (${book.name})`);
          await this.db.updateCashbookStatus(book.id, 'SYNCING');
          this.notify();

          let bookSuccess = false;
          let bookError = '';

          try {
            console.log(`[Sync] POST /api/sync action=cashbook`);
            const res = await fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'cashbook',
                id: book.id,
                name: book.name,
                user_id: book.user_id,
                user_name: book.user_name,
                created_at: book.created_at
              })
            });

            console.log(`[Sync] Response status: ${res.status}`);

            if (res.ok) {
              const json = await res.json();
              if (json && json.success === true) {
                bookSuccess = true;
                console.log(`[Sync] Backend success confirmed for cashbook: ${book.id}`);
              } else {
                bookError = json?.error || 'Server rejected cashbook sync';
                console.warn(`[Sync] POST /api/sync failed: ${bookError}`);
              }
            } else {
              bookError = `Server responded with status ${res.status}`;
              console.warn(`[Sync] POST /api/sync failed: HTTP ${res.status}`);
            }
          } catch (bookErr: any) {
            bookError = bookErr?.message || 'Network error syncing cashbook';
            console.warn(`[Sync] POST /api/sync failed:`, bookError);
          }

          if (bookSuccess) {
            console.log(`[Sync] Confirmed success for cashbook: ${book.id}`);
            await this.db.markCashbookSynced(book.id);
            syncedInThisRun++;
            this.notify();
          } else {
            const isNet = !navigator.onLine ||
              bookError.toLowerCase().includes('failed to fetch') ||
              bookError.toLowerCase().includes('network');

            if (isNet) {
              console.log(`[Sync] Connection lost during cashbook sync: ${book.id}`);
              await this.db.updateCashbookStatus(book.id, 'PENDING', 'Waiting for connection');
              this.setSyncState('OFFLINE');
              this.notify();
              break;
            } else {
              anyFailed = true;
              console.error(`[Sync] FAILED for cashbook ${book.id}: ${bookError}`);
              await this.db.updateCashbookStatus(book.id, 'FAILED', bookError);
              this.notify();
            }
          }
        }
      }

      // Re-query pending cashbooks to verify which cashbooks remain unconfirmed
      const stillPendingBooks = await this.db.getPendingCashbooks();
      const stillPendingBookIdSet = new Set(stillPendingBooks.map(b => b.id));

      // Sort entries by created_at ascending to preserve creation order
      pending.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      for (const entry of pending) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          await this.db.updateEntryStatus(entry.id, 'PENDING', 'Waiting for connection');
          this.setSyncState('OFFLINE');
          this.notify();
          break;
        }

        // CRITICAL CHECK: Do NOT sync an entry before its parent Cashbook exists on the backend!
        if (stillPendingBookIdSet.has(entry.cashbook_id)) {
          console.warn(`[Sync] Holding back entry ${entry.id}: parent cashbook ${entry.cashbook_id} is not yet confirmed on backend.`);
          await this.db.updateEntryStatus(entry.id, 'PENDING', 'Waiting for parent cashbook sync');
          continue;
        }

        console.log(`[Sync] Starting synchronization for transaction ${entry.clientEntryId || entry.id}`);

        // 1. Move to SYNCING state and notify UI immediately (QUEUED -> SYNCING)
        await this.db.updateEntryStatus(entry.id, 'SYNCING');
        this.notify();

        let syncSuccess = false;
        let syncedData: any = null;
        let syncErrorMsg = '';

        // Resolve user_id if non-UUID
        let resolvedUserId = entry.user_id;
        if (!UUID_REGEX.test(resolvedUserId) || resolvedUserId === '00000000-0000-0000-0000-000000000000') {
          const cachedUserId = localStorage.getItem('trackbook_last_user_id');
          if (cachedUserId && UUID_REGEX.test(cachedUserId) && cachedUserId !== '00000000-0000-0000-0000-000000000000') {
            resolvedUserId = cachedUserId;
          }
        }

        const payload = {
          id: entry.clientEntryId || entry.id,
          cashbook_id: entry.cashbook_id,
          user_id: resolvedUserId,
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

        // 2. Call backend canonical endpoint POST /api/sync with action='offline-entry'
        try {
          console.log(`[Sync] POST /api/sync action=offline-entry for entry ${payload.id}`);
          const res = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'offline-entry',
              clientEntryId: payload.id,
              entry: payload
            })
          });

          console.log(`[Sync] Response status: ${res.status}`);

          if (res.ok) {
            const result = await res.json();
            if (result && result.success === true) {
              syncSuccess = true;
              syncedData = result.entry;
              console.log(`[Sync] Backend success confirmed: Entry ${payload.id} written/confirmed`);
            } else {
              syncErrorMsg = result?.error || 'Server rejected sync';
              console.warn(`[Sync] POST /api/sync failed: ${syncErrorMsg}`);
            }
          } else {
            syncErrorMsg = `Server responded with status ${res.status}`;
            console.warn(`[Sync] POST /api/sync failed: HTTP ${res.status}`);
          }
        } catch (apiErr: any) {
          syncErrorMsg = apiErr?.message || 'Network error connecting to sync server';
          console.warn(`[Sync] Network exception for entry ${payload.id}:`, syncErrorMsg);
        }

        // 3. Fallback to direct Supabase upsert if server route is unavailable
        if (!syncSuccess && supabase && navigator.onLine) {
          try {
            console.log(`[Sync] Attempting direct Supabase fallback for ${payload.id}`);
            const { data: existing } = await supabase
              .from('entries')
              .select('*')
              .eq('id', payload.id)
              .maybeSingle();

            if (existing) {
              syncSuccess = true;
              syncedData = existing;
              console.log(`[Sync] Direct Supabase check: Entry already exists.`);
            } else {
              const supabasePayload = {
                id: payload.id,
                cashbook_id: payload.cashbook_id,
                user_id: payload.user_id,
                user_name: payload.user_name || 'User',
                amount: Number(payload.amount),
                type: payload.type === 'in' ? 'in' : 'out',
                description: payload.description || '',
                category: payload.category || 'General',
                mode: payload.mode || 'Cash',
                date: payload.date || new Date().toISOString(),
                image_layout: (entry as any).image_layout || 'split',
                created_at: payload.created_at || new Date().toISOString()
              };

              const { data: sbData, error: sbErr } = await supabase
                .from('entries')
                .upsert([supabasePayload], { onConflict: 'id' })
                .select()
                .maybeSingle();

              if (!sbErr) {
                syncSuccess = true;
                syncedData = sbData || supabasePayload;
                console.log(`[Sync] Supabase result: Direct upsert successful.`);
              } else {
                syncErrorMsg = sbErr.message || syncErrorMsg;
                console.warn(`[Sync] Direct Supabase upsert failed: ${sbErr.message}`);
              }
            }
          } catch (sbEx: any) {
            syncErrorMsg = sbEx?.message || syncErrorMsg;
          }
        }

        // 4. Update entry state based on sync outcome
        if (syncSuccess) {
          console.log(`[Sync] Confirmed success for entry ${entry.id}`);
          // Remove from active queue on confirmed success
          await this.db.markEntrySynced(entry.id);
          console.log(`[Sync] Marked local entry synced: ${entry.id}`);
          syncedInThisRun++;
          this.entrySyncedCallbacks.forEach(cb => {
            try { cb(entry.id, syncedData); } catch (e) { console.error(e); }
          });
          this.notify();
        } else {
          const isNet = !navigator.onLine || 
            syncErrorMsg.toLowerCase().includes('failed to fetch') || 
            syncErrorMsg.toLowerCase().includes('network');

          if (isNet) {
            console.log(`[Sync] Connection offline/lost during sync. Keeping in local queue: ${entry.id}`);
            await this.db.updateEntryStatus(entry.id, 'PENDING', 'Waiting for connection');
            this.setSyncState('OFFLINE');
            this.notify();
            break;
          } else {
            anyFailed = true;
            console.error(`[Sync] FAILED for entry ${entry.id}`);
            console.error(`[Sync] Error: ${syncErrorMsg}`);
            console.log(`[Sync] Keeping transaction in local queue with FAILED status: ${entry.id}`);
            await this.db.updateEntryStatus(entry.id, 'FAILED', syncErrorMsg || 'Sync failed');
            this.notify();
          }
        }
      }
    } finally {
      this.isSyncing = false;
      await this.refreshPendingCount();
      this.notify();
    }

    if (syncedInThisRun > 0) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('trackbook_refresh_cashbooks'));
      }

      if (this.pendingCount === 0) {
        this.setSyncState('SYNC_COMPLETE');
        this.emitToast('All entries synced successfully', 'success');
        setTimeout(() => {
          if (this.pendingCount === 0 && this.network.state === 'good') {
            this.setSyncState('ONLINE');
          }
        }, 2500);
      } else {
        this.emitToast(`${syncedInThisRun} entries synced successfully`, 'success');
      }
    }

    return !anyFailed;
  }

  getQueueList(): SyncQueueItem[] {
    const cashbooks = this.db.getLocalCashbooks();
    const entries = this.db.getLocalEntries();

    const cashbookItems: SyncQueueItem[] = cashbooks.map(b => ({
      id: b.id,
      type: 'CREATE_CASHBOOK' as const,
      status: b.syncStatus === 'SYNCED' ? ('completed' as const)
            : b.syncStatus === 'SYNCING' ? ('syncing' as const)
            : b.syncStatus === 'FAILED' ? ('failed' as const)
            : this.network.state === 'offline' ? ('waiting_for_internet' as const)
            : ('pending' as const),
      priority: 'high' as const,
      retryCount: b.retryCount || 0,
      createdAt: b.created_at,
      payload: b,
      error: b.lastError
    }));

    const entryItems: SyncQueueItem[] = entries.map(e => ({
      id: e.id,
      type: 'CREATE_ENTRY' as const,
      status: e.syncStatus === 'SYNCED' ? ('completed' as const)
            : e.syncStatus === 'SYNCING' ? ('syncing' as const)
            : e.syncStatus === 'FAILED' ? ('failed' as const)
            : this.network.state === 'offline' ? ('waiting_for_internet' as const)
            : ('pending' as const),
      priority: 'high' as const,
      retryCount: e.retryCount || 0,
      createdAt: e.created_at,
      payload: e,
      error: e.lastError
    }));

    return [...cashbookItems, ...entryItems];
  }

  getPendingCount(): number {
    return this.pendingCount;
  }
}

export const syncManager = new BackgroundSyncManager();
export const offlineDb = syncManager.db;
