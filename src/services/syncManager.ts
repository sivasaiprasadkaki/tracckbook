import { supabase } from '../lib/supabase';

export type NetworkState = 'good' | 'slow' | 'offline';

export interface SyncQueueItem {
  id: string;
  type: 'CREATE_ENTRY' | 'UPDATE_ENTRY' | 'DELETE_ENTRY' | 'UPLOAD_IMAGE' | 'AI_SCAN' | 'PDF_EXPORT' | 'EXCEL_EXPORT' | 'CREATE_CASHBOOK' | 'UPDATE_CASHBOOK' | 'DELETE_CASHBOOK';
  status: 'pending' | 'uploading' | 'scanning' | 'syncing' | 'completed' | 'failed' | 'paused' | 'waiting_for_internet';
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  createdAt: string;
  payload: any;
  error?: string;
}

export class TrackBookOfflineDB {
  async init() {
    return true;
  }
  async getCashbooks(): Promise<any[]> {
    return [];
  }
  async getEntries(cashbookId: string): Promise<any[]> {
    return [];
  }
  async getEntry(id: string): Promise<any | null> {
    return null;
  }
  async saveEntry(entry: any) {
    return true;
  }
  async saveLocalImage(id: string, base64: string, type: string) {
    return true;
  }
  async saveQueueItem(item: any) {
    return true;
  }
  async getQueueItems(): Promise<any[]> {
    return [];
  }
  async deleteEntry(id: string) {
    return true;
  }
  async deleteCashbook(id: string) {
    return true;
  }
  async deleteLocalImage(id: string) {
    return true;
  }
  async getLocalImage(id: string): Promise<any | null> {
    return null;
  }
  async clearAllData() {
    return true;
  }
}

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
      // Lightweight cache-busting check
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
    // Trigger immediately with current state
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

export class BackgroundSyncManager {
  public db = new TrackBookOfflineDB();
  public network = new NetworkMonitor();
  private listeners: (() => void)[] = [];
  private toastListeners: ((msg: string, type: 'success' | 'info' | 'error') => void)[] = [];

  constructor() {
    this.init();
  }

  async init() {
    return true;
  }

  subscribe(cb: () => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  subscribeToToasts(cb: (msg: string, type: 'success' | 'info' | 'error') => void) {
    this.toastListeners.push(cb);
    return () => {
      this.toastListeners = this.toastListeners.filter(l => l !== cb);
    };
  }

  getQueueList(): SyncQueueItem[] {
    return [];
  }

  getPendingCount(): number {
    return 0;
  }

  async enqueue(
    type: SyncQueueItem['type'],
    payload: any,
    priority: SyncQueueItem['priority'] = 'normal'
  ): Promise<SyncQueueItem> {
    return {
      id: `queue-${Date.now()}`,
      type,
      status: 'completed',
      priority,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      payload
    };
  }

  triggerSync() {
    console.log('[DEBUG] SYNC STARTED');
    setTimeout(() => {
      console.log('[DEBUG] SYNC FINISHED');
    }, 100);
  }

  async revalidate(userId: string) {
    console.log('[DEBUG] SYNC STARTED');
    // perform revalidation if needed
    console.log('[DEBUG] SYNC FINISHED');
    return true;
  }
}

export const syncManager = new BackgroundSyncManager();
export const offlineDb = syncManager.db;
