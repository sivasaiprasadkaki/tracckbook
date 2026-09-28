import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfBrandingFooter } from '../utils/pdfBranding';
import XLSX from 'xlsx-js-style';
import { uploadToCloudinary, getUserCloudinaryFolder, getExportOptimizedCloudinaryUrl } from './cloudinary';
import { processAndOcrImage } from './ocrService';

export interface ExportTask {
  id: string;
  type?: 'pdf' | 'excel' | 'ai';
  cashbookId: string;
  cashbookName: string;
  isCompressed: boolean;
  pdfQuality?: 'original' | 'compressed';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  createdAt: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
  transactionsCount: number;
  attachmentsCount: number;
  fileName: string;
  
  // AI fields
  aiUploadedCount?: number;
  aiProcessedCount?: number;
  aiSuccessCount?: number;
  aiFailedCount?: number;
  aiCurrentIndex?: number;
  aiTimeRemaining?: string;
  networkState?: 'good' | 'slow' | 'offline';
  aiCurrentStepId?: string;
  aiCompletedSteps?: string[];
  
  groupSize?: number;
  isHandwritten?: boolean;
  handwrittenTime?: string;
  handwrittenIsFood?: boolean;
  
  // Archive state
  isArchived?: boolean;
}

// 1. Native IndexedDB database wrapper
class ExportDB {
  private dbName = 'TrackBookExportDB';
  private dbVersion = 2;
  private db: IDBDatabase | null = null;

  close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch (e) {}
      this.db = null;
    }
  }

  init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (e) => {
        const db = request.result;
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('blobs')) {
          db.createObjectStore('blobs');
        }
        if (!db.objectStoreNames.contains('payloads')) {
          db.createObjectStore('payloads');
        }
      };
    });
  }

  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  async clearAllStores(): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['tasks', 'blobs', 'payloads'], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      
      try {
        tx.objectStore('tasks').clear();
        tx.objectStore('blobs').clear();
        tx.objectStore('payloads').clear();
      } catch (e) {
        reject(e);
      }
    });
  }

  async saveTask(task: ExportTask): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['tasks'], 'readwrite');
      const store = transaction.objectStore('tasks');
      const request = store.put(task);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getTasks(): Promise<ExportTask[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['tasks'], 'readonly');
      const store = transaction.objectStore('tasks');
      const request = store.getAll();
      request.onsuccess = () => {
        const tasks = request.result || [];
        // Sort tasks by createdAt descending
        tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(tasks);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async savePayload(id: string, transactions: any[]): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['payloads'], 'readwrite');
      const store = transaction.objectStore('payloads');
      const request = store.put(transactions, id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPayload(id: string): Promise<any[] | null> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['payloads'], 'readonly');
      const store = transaction.objectStore('payloads');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveBlob(id: string, blob: Blob): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['blobs'], 'readwrite');
      const store = transaction.objectStore('blobs');
      const request = store.put(blob, id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getBlob(id: string): Promise<Blob | null> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['blobs'], 'readonly');
      const store = transaction.objectStore('blobs');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTask(id: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['tasks', 'blobs', 'payloads'], 'readwrite');
      transaction.objectStore('tasks').delete(id);
      transaction.objectStore('blobs').delete(id);
      transaction.objectStore('payloads').delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

// 2. Inline Web Worker Code
const workerBlobCode = `
  const resolveAttachmentUrl = (url, type, cloudName = 'dd2kcpetc') => {
    if (!url || typeof url !== 'string') return '';
    const hashIdx = url.indexOf('#');
    const hash = hashIdx !== -1 ? url.substring(hashIdx) : '';
    const cleanUrl = hashIdx !== -1 ? url.substring(0, hashIdx) : url;

    if (cleanUrl.startsWith('data:') || cleanUrl.startsWith('blob:') || cleanUrl.startsWith('local-img-')) {
      return cleanUrl + hash;
    }

    if (cleanUrl.startsWith('//')) {
      cleanUrl = 'https:' + cleanUrl;
    } else if (cleanUrl.startsWith('res.cloudinary.com')) {
      cleanUrl = 'https://' + cleanUrl;
    } else if (cleanUrl.startsWith('cloudinary.com')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    let transformation = '';
    if (type === 'preview') {
      transformation = 'f_auto,q_auto,w_300';
    } else if (type === 'fullscreen') {
      transformation = 'f_auto,q_auto,w_1200';
    } else if (type === 'export_strong') {
      transformation = 'f_jpg,q_35,w_800';
    } else if (type === 'export_low') {
      transformation = 'f_jpg,q_40,w_900';
    } else if (type === 'export_high') {
      transformation = 'f_jpg,q_82';
    } else if (type === 'original') {
      transformation = '';
    }

    if (!cleanUrl.includes('cloudinary.com')) {
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        return cleanUrl + hash;
      }
      if (!transformation) {
        return cleanUrl + hash;
      }
      return 'https://res.cloudinary.com/' + cloudName + '/image/fetch/' + transformation + '/' + encodeURIComponent(cleanUrl) + hash;
    }

    let splitter = '/image/upload/';
    if (cleanUrl.includes('/image/upload/')) {
      splitter = '/image/upload/';
    } else if (cleanUrl.includes('/upload/')) {
      splitter = '/upload/';
    } else if (cleanUrl.includes('/image/private/')) {
      splitter = '/image/private/';
    } else if (cleanUrl.includes('/image/authenticated/')) {
      splitter = '/image/authenticated/';
    } else if (cleanUrl.includes('/image/fetch/')) {
      const fetchParts = cleanUrl.split('/image/fetch/');
      const remaining = fetchParts[1];
      if (remaining) {
        const segments = remaining.split('/');
        const cleanSegments = segments.filter(s => {
          if (!s) return false;
          const keys = ['w_', 'h_', 'q_', 'f_', 'c_', 'r_', 'dpr_', 'auto'];
          return !keys.some(k => s.startsWith(k) || s.includes(',' + k));
        });
        const originalUrlSegment = cleanSegments.join('/');
        let originalUrl = originalUrlSegment;
        try {
          originalUrl = decodeURIComponent(originalUrlSegment);
        } catch (e) {}
        return 'https://res.cloudinary.com/' + cloudName + '/image/fetch/' + transformation + '/' + encodeURIComponent(originalUrl) + hash;
      }
      splitter = '/image/fetch/';
    }

    const parts = cleanUrl.split(splitter);
    if (parts.length < 2) {
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl.replace(/^[/]+/, '');
      }
      return cleanUrl + hash;
    }

    let prefix = parts[0];
    if (!prefix.startsWith('http://') && !prefix.startsWith('https://')) {
      if (prefix.startsWith('//')) {
        prefix = 'https:' + prefix;
      } else {
        prefix = 'https://' + prefix.replace(/^[/]+/, '');
      }
    }
    const remaining = parts[1];
    if (!remaining) return cleanUrl + hash;

    const segments = remaining.split('/');
    const cleanSegments = segments.filter(s => {
      if (!s) return false;
      if (/^v\\d+$/.test(s)) return false;
      const keys = ['w_', 'h_', 'q_', 'f_', 'c_', 'r_', 'dpr_', 'bo_', 'co_', 'e_', 'fl_', 'l_', 'p_', 'pg_', 'x_', 'y_', 'z_', 'auto'];
      return !keys.some(k => s.startsWith(k) || s.includes(',' + k));
    });

    if (!transformation) {
      return prefix + splitter + cleanSegments.join('/') + hash;
    }
    return prefix + splitter + transformation + '/' + cleanSegments.join('/') + hash;
  };

  const getExportOptimizedCloudinaryUrl = (url, isCompressed, isHuge, cloudName) => {
    if (isCompressed) {
      return resolveAttachmentUrl(url, isHuge ? 'export_strong' : 'export_low', cloudName);
    }
    return resolveAttachmentUrl(url, 'original', cloudName);
  };

  self.onmessage = async (e) => {
    const { taskId, urls, isCompressed, isStrongCompression, cloudName } = e.data;
    const results = {};
    const total = urls.length;

    if (total === 0) {
      self.postMessage({ type: 'complete', taskId, results });
      return;
    }

    const concurrency = 5;
    for (let i = 0; i < total; i += concurrency) {
      const chunk = urls.slice(i, i + concurrency);
      
      await Promise.all(chunk.map(async (url) => {
        try {
          if (!url) return;
          
          let targetUrl = getExportOptimizedCloudinaryUrl(url, isCompressed, isStrongCompression, cloudName);

          if (targetUrl.startsWith('data:')) {
            results[url] = targetUrl;
            return;
          }

          const controller = new AbortController();
          const timerId = setTimeout(() => {
            try { controller.abort(); } catch (_) {}
          }, 4500);

          const response = await fetch(targetUrl, { signal: controller.signal });
          clearTimeout(timerId);

          if (!response.ok) throw new Error('HTTP ' + response.status);
          const blob = await response.blob();
          const buffer = await blob.arrayBuffer();
          results[url] = { buffer, type: blob.type };
        } catch (err) {
          console.warn('[Worker debug] Fetch failed or timed out:', url, err);
          results[url] = { error: err.message || 'Error downloading image' };
        }
      }));

      const progress = Math.min(85, Math.round(10 + ((i + chunk.length) / total) * 75));
      self.postMessage({
        type: 'progress',
        taskId,
        progress,
        selectedUrlsCount: Math.min(total, i + chunk.length),
        message: 'Optimizing receipts (' + Math.min(total, i + chunk.length) + '/' + total + ')...'
      });
    }

    self.postMessage({ type: 'complete', taskId, results });
  };
`;

// 3. Centralized Premium Export Queue Manager Singleton
export interface JobNotification {
  id: string;
  type: 'pdf' | 'excel' | 'ai';
  message: string;
  taskId: string;
  timestamp: string;
}

export class BackgroundExportManager {
  private db = new ExportDB();
  private tasks: ExportTask[] = [];
  private listeners: (() => void)[] = [];
  private worker: Worker | null = null;
  private isProcessing = false;
  private cloudName = 'dd2kcpetc';
  private blobCache = new Map<string, Blob>();
  
  public onReviewAiScan?: (results: any[], taskId?: string) => void;
  private notifications: JobNotification[] = [];
  public networkState: 'good' | 'slow' | 'offline' = 'good';

  constructor() {
    this.setupNetworkMonitoring();
    this.init();
  }

  private setupNetworkMonitoring() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.updateNetworkState());
      window.addEventListener('offline', () => this.updateNetworkState());
      if ((navigator as any).connection) {
        ((navigator as any).connection).addEventListener('change', () => this.updateNetworkState());
      }
      this.updateNetworkState();
    }
  }

  public updateNetworkState() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.networkState = 'offline';
    } else {
      const conn = typeof navigator !== 'undefined' ? (navigator as any).connection : null;
      if (conn) {
        if (conn.effectiveType === '2g' || conn.effectiveType === '3g' || conn.saveData) {
          this.networkState = 'slow';
        } else {
          this.networkState = 'good';
        }
      } else {
        this.networkState = 'good';
      }
    }
    // Update active tasks with current network state
    this.tasks.forEach(task => {
      if (task.type === 'ai' && task.status === 'processing') {
        task.networkState = this.networkState;
      }
    });
    this.notifyListeners();
  }

  public recordLatency(ms: number) {
    if (ms > 4000) {
      this.networkState = 'slow';
      this.notifyListeners();
    }
  }

  private async init() {
    try {
      await this.db.init();
      this.tasks = await this.db.getTasks();
      
      // Auto-archive old tasks (Feature 11)
      await this.autoArchiveOldTasks();

      this.notifyListeners();
      
      // Auto-resume any pending or processing tasks that got cut off by a reload
      const needsResume = this.tasks.some(t => t.status === 'pending' || t.status === 'processing');
      if (needsResume) {
        // Mark former processing tasks back to pending first
        for (const t of this.tasks) {
          if (t.status === 'processing') {
            t.status = 'pending';
            t.progress = 0;
            t.message = 'Queued for background export...';
            await this.db.saveTask(t);
          }
        }
        this.notifyListeners();
        this.processQueue();
      }
    } catch (err) {
      console.error('[ExportManager] initialization failed:', err);
    }
  }

  private async autoArchiveOldTasks() {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let modified = false;
    for (const t of this.tasks) {
      if (t.completedAt && !t.isArchived) {
        const completedTime = new Date(t.completedAt).getTime();
        if (completedTime < sevenDaysAgo) {
          t.isArchived = true;
          await this.db.saveTask(t);
          modified = true;
        }
      }
    }
    if (modified) {
      // Reload tasks from DB
      this.tasks = await this.db.getTasks();
    }
  }

  async archiveTask(taskId: string) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;
    task.isArchived = true;
    await this.db.saveTask(task);
    this.tasks = await this.db.getTasks();
    this.notifyListeners();
    vibrateFeedback(30);
  }

  async restoreTask(taskId: string) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;
    task.isArchived = false;
    await this.db.saveTask(task);
    this.tasks = await this.db.getTasks();
    this.notifyListeners();
    vibrateFeedback(30);
  }

  async clearAllData() {
    try {
      await this.db.clearAllStores();
    } catch (e) {
      console.error("[ExportManager] Failed to clear stores, deleting DB as fallback:", e);
      // Close DB first if open
      if (this.db) {
        try {
          this.db.close();
        } catch (err) {}
      }

      // Delete IndexedDB as fallback
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase('TrackBookExportDB');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      localStorage.removeItem(`uploaded_count_${today}`);
      localStorage.removeItem(`processed_count_${today}`);
    } catch (e) {}

    this.tasks = [];
    this.notifications = [];
    this.notifyListeners();
    vibrateFeedback([100, 50, 100]);
    window.location.reload();
  }

  getNotifications(): JobNotification[] {
    return this.notifications;
  }

  dismissNotification(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notifyListeners();
  }

  private showJobNotification(task: ExportTask) {
    let msg = '';
    if (task.type === 'pdf') {
      msg = `Your PDF export for "${task.cashbookName}" is ready.`;
    } else if (task.type === 'excel') {
      msg = `Your Excel export for "${task.cashbookName}" is ready.`;
    } else if (task.type === 'ai') {
      msg = 'Receipt scanning completed successfully.';
    } else {
      msg = 'Job completed successfully.';
    }

    const notif: JobNotification = {
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: task.type || 'pdf',
      message: msg,
      taskId: task.id,
      timestamp: new Date().toISOString()
    };

    this.notifications = [notif, ...this.notifications];
    this.notifyListeners();
  }

  // Subscribe UI components to live status updates
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }

  getTaskList(): ExportTask[] {
    return this.tasks.map(t => ({ ...t }));
  }

  getActiveTasksCount(): number {
    return this.tasks.filter(t => !t.isArchived && (t.status === 'pending' || t.status === 'processing')).length;
  }

  // Enqueue a premium PDF Export Task
  async enqueueTask(
    cashbookId: string,
    cashbookName: string,
    transactions: any[],
    isCompressed: boolean = true,
    pdfQuality?: 'original' | 'compressed'
  ): Promise<string> {
    const quality: 'original' | 'compressed' = pdfQuality || (isCompressed ? 'compressed' : 'original');
    const taskId = 'tx_pdf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const attachments = transactions.filter(t => t.images && t.images.length > 0);
    const totalAttachments = attachments.reduce((acc, t) => acc + (t.images?.length || 0), 0);

    const task: ExportTask = {
      id: taskId,
      type: 'pdf',
      cashbookId,
      cashbookName,
      isCompressed: quality === 'compressed',
      pdfQuality: quality,
      status: 'pending',
      progress: 0,
      message: 'Added to download queue...',
      createdAt: new Date().toISOString(),
      transactionsCount: transactions.length,
      attachmentsCount: totalAttachments,
      fileName: `${cashbookName.replace(/[^a-z0-9]/gi, '_')}.pdf`
    };

    // Save metadata and payload in parallel
    await Promise.all([
      this.db.saveTask(task),
      this.db.savePayload(taskId, transactions)
    ]);

    this.tasks = [task, ...this.tasks];
    this.notifyListeners();
    vibrateFeedback(40);

    // Run the processor loop
    this.processQueue();
    return taskId;
  }

  // Enqueue a premium Excel Export Task
  async enqueueExcelTask(
    cashbookId: string,
    cashbookName: string,
    transactions: any[]
  ): Promise<string> {
    const taskId = 'tx_excel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    const task: ExportTask = {
      id: taskId,
      type: 'excel',
      cashbookId,
      cashbookName,
      isCompressed: false,
      status: 'pending',
      progress: 0,
      message: 'Added to download queue...',
      createdAt: new Date().toISOString(),
      transactionsCount: transactions.length,
      attachmentsCount: 0,
      fileName: `${cashbookName.replace(/[^a-z0-9]/gi, '_')}.xlsx`
    };

    // Save metadata and payload in parallel
    await Promise.all([
      this.db.saveTask(task),
      this.db.savePayload(taskId, transactions)
    ]);

    this.tasks = [task, ...this.tasks];
    this.notifyListeners();
    vibrateFeedback(40);

    // Run the processor loop
    this.processQueue();
    return taskId;
  }

  // Enqueue a premium AI Scan Task
  async enqueueAiScanTask(
    cashbookId: string,
    cashbookName: string,
    files: File[],
    taskName?: string,
    groupSize?: number,
    isHandwritten?: boolean,
    handwrittenTime?: string,
    handwrittenIsFood?: boolean
  ): Promise<string> {
    const taskId = 'tx_ai_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    const task: ExportTask = {
      id: taskId,
      type: 'ai',
      cashbookId,
      cashbookName: taskName || cashbookName,
      isCompressed: false,
      status: 'pending',
      progress: 0,
      message: `0 / ${files.length} Completed`,
      createdAt: new Date().toISOString(),
      transactionsCount: 0,
      attachmentsCount: files.length,
      fileName: `${files.length} receipts batch`,
      
      aiUploadedCount: 0,
      aiProcessedCount: 0,
      aiSuccessCount: 0,
      aiFailedCount: 0,

      groupSize: groupSize || 1,
      isHandwritten: !!isHandwritten,
      handwrittenTime: handwrittenTime || '12:00 PM',
      handwrittenIsFood: !!handwrittenIsFood,
    };

    // Save metadata and payload in parallel
    await Promise.all([
      this.db.saveTask(task),
      this.db.savePayload(taskId, files)
    ]);

    this.tasks = [task, ...this.tasks];
    this.notifyListeners();
    vibrateFeedback(40);

    // Run the processor loop
    this.processQueue();
    return taskId;
  }

  // Queue Processing Loop
  private async processQueue() {
    if (this.isProcessing) return;

    const nextTask = this.tasks.find(t => t.status === 'pending');
    if (!nextTask) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    await this.runTask(nextTask);
    this.isProcessing = false;

    // Process next item
    setTimeout(() => this.processQueue(), 50);
  }

  private async runTask(task: ExportTask) {
    const startTime = Date.now();
    try {
      task.status = 'processing';
      task.progress = 5;
      task.message = 'Initializing background task...';
      await this.db.saveTask(task);
      this.notifyListeners();

      const taskType = task.type || 'pdf';

      if (taskType === 'pdf') {
        const transactions = await this.db.getPayload(task.id);
        if (!transactions || transactions.length === 0) {
          throw new Error('No transactions found to export.');
        }

        // Filter attachments
        const transactionsWithImages = transactions.filter(t => t.images && t.images.length > 0);
        const allUrls: string[] = [];
        transactionsWithImages.forEach(t => {
          t.images.forEach((url: string) => {
            if (url && !allUrls.includes(url)) {
              allUrls.push(url);
            }
          });
        });

        task.progress = 10;
        task.message = allUrls.length > 0 ? `Preparing worker thread for ${allUrls.length} receipt assets...` : 'Rendering tables...';
        await this.db.saveTask(task);
        this.notifyListeners();

        // Download and optimize fully within Worker thread if images exist
        let imageMap: { [url: string]: string } = {};
        if (allUrls.length > 0) {
          imageMap = await this.downloadImagesInWorker(task, allUrls);
        }

        task.progress = 88;
        task.message = 'Structuring document nodes inside memory...';
        await this.db.saveTask(task);
        this.notifyListeners();

        // Yield CPU safely
        await new Promise(r => setTimeout(r, 40));

        // Build jsPDF instance inside core thread with absolute safety
        const pdfBlob = await this.generatePdfBlob(task, transactions, imageMap);

        // Keep in memory blobCache immediately!
        this.blobCache.set(task.id, pdfBlob);

        // Save output blob to IndexedDB safely
        await this.db.saveBlob(task.id, pdfBlob).catch(err => {
          console.warn('[ExportManager] Non-fatal saveBlob to IndexedDB error:', err);
        });

        // Complete task
        task.status = 'completed';
        task.progress = 100;
        task.completedAt = new Date().toISOString();
        task.durationMs = Date.now() - startTime;
        task.message = 'PDF ready for download!';
        await this.db.saveTask(task);
        this.notifyListeners();

        // Visual / Audio feedback
        vibrateFeedback(80);
        
        // Auto-trigger browser download
        this.triggerDownload(task.fileName, pdfBlob);

        // Notify
        this.showJobNotification(task);

      } else if (taskType === 'excel') {
        task.progress = 15;
        task.message = 'Retrieving transactions payload...';
        await this.db.saveTask(task);
        this.notifyListeners();

        const transactions = await this.db.getPayload(task.id);
        if (!transactions || transactions.length === 0) {
          throw new Error('No transactions found to export.');
        }

        task.progress = 40;
        task.message = 'Building columns and mapping entries...';
        await this.db.saveTask(task);
        this.notifyListeners();

        let currentPage = 1;
        const transactionPageMap = new Map<string, string>();
        const transactionsWithImages = transactions.filter(t => t.images && t.images.length > 0);
        for (const t of transactionsWithImages) {
          const layout = t.imageLayout || 'split';
          const imageCount = t.images?.length || 0;
          const pagesUsed = layout === 'merge' ? Math.ceil(imageCount / 2) : imageCount;
          
          if (pagesUsed === 1) {
            transactionPageMap.set(t.id, `Refer Page Number ${currentPage}`);
          } else {
            transactionPageMap.set(t.id, `Refer Page Number ${currentPage} to ${currentPage + pagesUsed - 1}`);
          }
          
          currentPage += pagesUsed;
        }

        const data = transactions.map(t => ({
          Date: safeFormatDate(t.date),
          Details: t.description,
          Category: t.category,
          Mode: t.mode,
          'Cash In': t.type === 'in' ? t.amount : 0,
          'Cash Out': t.type === 'out' ? t.amount : 0,
          'Reference': transactionPageMap.get(t.id) || '-'
        }));

        task.progress = 70;
        task.message = 'Computing dynamic SUBTOTAL formulas, balances and sheet summary...';
        await this.db.saveTask(task);
        this.notifyListeners();

        const ws = buildTransactionsWorksheet(transactions, transactionPageMap);

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Transactions");

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const excelBlob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        // Keep in memory blobCache immediately!
        this.blobCache.set(task.id, excelBlob);

        // Save output blob to IndexedDB safely
        await this.db.saveBlob(task.id, excelBlob).catch(err => {
          console.warn('[ExportManager] Non-fatal saveBlob to IndexedDB error:', err);
        });

        task.status = 'completed';
        task.progress = 100;
        task.completedAt = new Date().toISOString();
        task.durationMs = Date.now() - startTime;
        task.message = 'Excel ready for download!';
        await this.db.saveTask(task);
        this.notifyListeners();

        vibrateFeedback(80);
        this.triggerDownload(task.fileName, excelBlob);

        // Notify
        this.showJobNotification(task);

      } else if (taskType === 'ai') {
        const files = await this.db.getPayload(task.id);
        if (!files || files.length === 0) {
          throw new Error('No files provided.');
        }

        task.attachmentsCount = files.length;
        task.aiUploadedCount = 0;
        task.aiProcessedCount = 0;
        task.aiSuccessCount = 0;
        task.aiFailedCount = 0;
        task.networkState = this.networkState;
        task.message = `0 / ${files.length} Completed`;
        await this.db.saveTask(task);
        this.notifyListeners();

        // Offline recovery: retrieve any partial progress
        const resultsPayload = await this.db.getPayload(task.id + '_partial_results').catch(() => null) || [];
        const results: any[] = Array.isArray(resultsPayload) ? resultsPayload : [];
        const startIndex = task.aiCurrentIndex || 0;
        task.aiProcessedCount = startIndex;
        task.aiUploadedCount = startIndex;
        task.aiSuccessCount = results.length;

        const cloudinaryFolder = await getUserCloudinaryFolder();
        const customKey = localStorage.getItem('GEMINI_API_KEY') || '';

        for (let i = startIndex; i < files.length; i++) {
          task.aiCurrentIndex = i;
          task.progress = Math.round((i / files.length) * 100);
          task.networkState = this.networkState;
          
          const remainingFiles = files.length - i;
          const estSec = this.networkState === 'slow' ? Math.max(1, remainingFiles * 15) : Math.max(1, remainingFiles * 6);
          task.aiTimeRemaining = `${estSec} sec`;
          
          await this.db.saveTask(task);
          this.notifyListeners();

          const file = files[i];

          const updateStep = async (stepId: string, customMessage?: string) => {
            const stepMapping: { [key: string]: { message: string, completed: string[] } } = {
              'receipt_uploaded': { message: 'Uploading receipt...', completed: [] },
              'uploaded_cloud': { message: 'Uploading to TrackBook Cloud...', completed: ['receipt_uploaded'] },
              'ocr_completed': { message: 'Reading receipt...', completed: ['receipt_uploaded', 'uploaded_cloud'] },
              'merchant_detected': { message: 'Extracting merchant...', completed: ['receipt_uploaded', 'uploaded_cloud', 'ocr_completed'] },
              'amount_extracted': { message: 'Extracting amount...', completed: ['receipt_uploaded', 'uploaded_cloud', 'ocr_completed', 'merchant_detected'] },
              'date_parsed': { message: 'Detecting bill category...', completed: ['receipt_uploaded', 'uploaded_cloud', 'ocr_completed', 'merchant_detected', 'amount_extracted'] },
              'ai_verification': { message: 'Verifying with AI TrackBook...', completed: ['receipt_uploaded', 'uploaded_cloud', 'ocr_completed', 'merchant_detected', 'amount_extracted', 'date_parsed'] },
              'creating_transaction': { message: 'Creating transaction...', completed: ['receipt_uploaded', 'uploaded_cloud', 'ocr_completed', 'merchant_detected', 'amount_extracted', 'date_parsed', 'ai_verification'] },
              'transaction_saved': { message: 'Saving to ledger...', completed: ['receipt_uploaded', 'uploaded_cloud', 'ocr_completed', 'merchant_detected', 'amount_extracted', 'date_parsed', 'ai_verification', 'creating_transaction'] }
            };

            const mapping = stepMapping[stepId];
            if (mapping) {
              task.aiCurrentStepId = stepId;
              task.aiCompletedSteps = mapping.completed;
              task.message = customMessage || mapping.message;
              task.networkState = this.networkState;
              
              const rem = files.length - i;
              const est = this.networkState === 'slow' ? Math.max(1, rem * 15) : Math.max(1, rem * 6);
              task.aiTimeRemaining = `${est} sec`;
              
              await this.db.saveTask(task);
              this.notifyListeners();
            }
          };

          try {
            // Keep looping while offline
            while (!navigator.onLine || this.networkState === 'offline') {
              task.message = "Connection Lost. Waiting to reconnect...";
              task.aiTimeRemaining = "Waiting to reconnect...";
              task.networkState = 'offline';
              await this.db.saveTask(task);
              this.notifyListeners();
              await new Promise(r => setTimeout(r, 2000));
            }

            // Step 1: Uploading Receipt...
            await updateStep('receipt_uploaded');
            await new Promise(r => setTimeout(r, 400));

            // Step 2: Uploading to TrackBook Cloud...
            await updateStep('uploaded_cloud');
            let cloudinaryUrl = '';
            let uploadSuccess = false;
            while (!uploadSuccess) {
              while (!navigator.onLine || this.networkState === 'offline') {
                task.message = "Connection Lost. Waiting to reconnect...";
                task.aiTimeRemaining = "Waiting to reconnect...";
                task.networkState = 'offline';
                await this.db.saveTask(task);
                this.notifyListeners();
                await new Promise(r => setTimeout(r, 2000));
              }

              try {
                task.aiUploadedCount = i + 1;
                const startTimeUpload = Date.now();
                cloudinaryUrl = await uploadToCloudinary(file, cloudinaryFolder);
                const uploadDuration = Date.now() - startTimeUpload;
                this.recordLatency(uploadDuration);
                uploadSuccess = true;
              } catch (err) {
                console.error('[Background AI] Cloudinary upload failed:', err);
                if (!navigator.onLine || (this.networkState as string) === 'offline') {
                  this.networkState = 'offline';
                  await new Promise(r => setTimeout(r, 2000));
                } else {
                  break;
                }
              }
            }

            // Step 3: Reading Receipt (OCR)...
            await updateStep('ocr_completed');
            let ocrResult = null;
            let ocrSuccess = false;
            while (!ocrSuccess) {
              while (!navigator.onLine || this.networkState === 'offline') {
                task.message = "Connection Lost. Waiting to reconnect...";
                task.aiTimeRemaining = "Waiting to reconnect...";
                task.networkState = 'offline';
                await this.db.saveTask(task);
                this.notifyListeners();
                await new Promise(r => setTimeout(r, 2000));
              }

              try {
                const startTimeOcr = Date.now();
                ocrResult = await processAndOcrImage(file, () => {});
                const ocrDuration = Date.now() - startTimeOcr;
                this.recordLatency(ocrDuration);
                if (!ocrResult) {
                  throw new Error('OCR failed');
                }
                ocrSuccess = true;
              } catch (err) {
                console.error('[Background AI] OCR failed:', err);
                if (!navigator.onLine || (this.networkState as string) === 'offline') {
                  this.networkState = 'offline';
                  await new Promise(r => setTimeout(r, 2000));
                } else {
                  break;
                }
              }
            }

            // Step 4: Extracting merchant (Starting AI)...
            await updateStep('merchant_detected');
            let result = null;
            let aiSuccess = false;
            while (!aiSuccess) {
              while (!navigator.onLine || this.networkState === 'offline') {
                task.message = "Connection Lost. Waiting to reconnect...";
                task.aiTimeRemaining = "Waiting to reconnect...";
                task.networkState = 'offline';
                await this.db.saveTask(task);
                this.notifyListeners();
                await new Promise(r => setTimeout(r, 2000));
              }

              try {
                const startTimeAi = Date.now();
                const response = await fetch('/api/gemini/parse-receipt', {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    ...(customKey ? { 'x-gemini-api-key': customKey } : {})
                  },
                  body: JSON.stringify({
                    base64Image: ocrResult ? ocrResult.base64 : '',
                    mimeType: file.type || 'image/jpeg',
                    groupSize: task.groupSize || 1,
                    isHandwritten: !!task.isHandwritten,
                    handwrittenTime: task.handwrittenTime || '12:00 PM',
                    handwrittenIsFood: !!task.handwrittenIsFood,
                    customApiKey: customKey,
                    ocrText: ocrResult ? ocrResult.text : '',
                    ocrConfidence: ocrResult ? ocrResult.confidence : 100
                  })
                });

                const aiDuration = Date.now() - startTimeAi;
                this.recordLatency(aiDuration);

                if (!response.ok) {
                  throw new Error('Gemini parse failed');
                }

                result = await response.json();
                aiSuccess = true;
              } catch (err) {
                console.error('[Background AI] Gemini parse failed:', err);
                if (!navigator.onLine || (this.networkState as string) === 'offline') {
                  this.networkState = 'offline';
                  await new Promise(r => setTimeout(r, 2000));
                } else {
                  break;
                }
              }
            }

            if (result) {
              // Stagger remaining steps for a premium SaaS UX experience
              await updateStep('amount_extracted');
              await new Promise(r => setTimeout(r, 450));

              await updateStep('date_parsed');
              await new Promise(r => setTimeout(r, 450));

              await updateStep('ai_verification');
              await new Promise(r => setTimeout(r, 450));

              await updateStep('creating_transaction');
              await new Promise(r => setTimeout(r, 450));

              await updateStep('transaction_saved');
              await new Promise(r => setTimeout(r, 450));

              results.push({
                file,
                result: {
                  ...result,
                  amount: parseFloat(result.amount) || 0,
                  merchant: result.merchant || 'Unknown Vendor',
                  billType: result.billType || 'Food',
                  category: result.category || 'Food',
                  date: result.date || '27-05-2026',
                  time: result.time || '12:00 PM',
                  mealType: result.mealType || '',
                  description: result.description || 'Food Expense',
                  ocr_confidence: ocrResult ? ocrResult.confidence : 100,
                  ocr_duration_ms: ocrResult ? ocrResult.ocr_duration_ms : 0,
                  cloudinaryUrl
                }
              });

              task.aiSuccessCount = (task.aiSuccessCount || 0) + 1;
              // Offline persistence of intermediate progress
              await this.db.savePayload(task.id + '_partial_results', results);
            } else {
              task.aiFailedCount = (task.aiFailedCount || 0) + 1;
            }

          } catch (err) {
            console.error('[Background AI] failed file:', file.name, err);
            task.aiFailedCount = (task.aiFailedCount || 0) + 1;
          }

          task.aiProcessedCount = (task.aiProcessedCount || 0) + 1;
          task.progress = Math.round(((i + 1) / files.length) * 100);
          await this.db.saveTask(task);
          this.notifyListeners();
        }

        // Save AI results to payload table
        await this.db.savePayload(task.id + '_results', results);
        try {
          // Clear intermediate recovery payload
          await this.db.deleteTask(task.id + '_partial_results');
        } catch (e) {}

        task.status = 'completed';
        task.progress = 100;
        task.completedAt = new Date().toISOString();
        task.durationMs = Date.now() - startTime;
        task.message = 'Receipt imported successfully.';
        await this.db.saveTask(task);
        this.notifyListeners();

        vibrateFeedback(80);
        this.showJobNotification(task);
      }

    } catch (err: any) {
      if (err.message !== 'No transactions found to export.') {
        console.error('[ExportManager] task failure:', err);
      } else {
        console.warn('[ExportManager] task notice:', err.message);
      }
      task.status = 'failed';
      task.error = err.message || 'Document architecture failed';
      task.message = 'Export failed: ' + (err.message || 'Process error');
      task.progress = 100;
      await this.db.saveTask(task);
      this.notifyListeners();
      vibrateFeedback([50, 50, 50]);
    }
  }

  // Web Worker execution engine with robust timeouts and graceful fallbacks
  private downloadImagesInWorker(task: ExportTask, urls: string[]): Promise<{ [url: string]: string }> {
    return new Promise((resolve) => {
      let isDone = false;
      const finish = (result: { [url: string]: string }) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timeoutId);
          resolve(result);
        }
      };

      // 10-second safety net timeout to prevent background worker hanging
      const timeoutId = setTimeout(() => {
        console.warn('[ExportManager] downloadImagesInWorker safety timeout reached. Proceeding with export.');
        finish({});
      }, 10000);

      try {
        if (!this.worker) {
          const blob = new Blob([workerBlobCode], { type: 'application/javascript' });
          this.worker = new Worker(URL.createObjectURL(blob));
        }

        this.worker.onerror = (err) => {
          console.warn('[ExportManager] Worker error caught:', err);
          finish({});
        };

        const isStrongCompression = task.transactionsCount >= 80;

        const onProgressMessage = async (e: MessageEvent) => {
          const { type, taskId, progress, message, results } = e.data;
          if (taskId !== task.id) return;

          if (type === 'progress') {
            task.progress = progress;
            task.message = message;
            await this.db.saveTask(task).catch(() => {});
            this.notifyListeners();
          } else if (type === 'complete') {
            try {
              this.worker?.removeEventListener('message', onProgressMessage);
            } catch (_) {}
            
            // Convert ArrayBuffers back to Object URLs in main thread
            const resolvedMap: { [url: string]: string } = {};
            for (const [url, data] of Object.entries((results || {}) as any)) {
              if (typeof data === 'string') {
                resolvedMap[url] = data; // Data URL or base64
              } else if (data && (data as any).buffer) {
                try {
                  const blob = new Blob([(data as any).buffer], { type: (data as any).type || 'image/jpeg' });
                  resolvedMap[url] = URL.createObjectURL(blob);
                } catch (_) {
                  resolvedMap[url] = url;
                }
              } else {
                resolvedMap[url] = url;
              }
            }
            finish(resolvedMap);
          }
        };

        this.worker.addEventListener('message', onProgressMessage);
        
        // Post assets payload to worker
        this.worker.postMessage({
          taskId: task.id,
          urls,
          isCompressed: task.isCompressed,
          isStrongCompression,
          cloudName: this.cloudName
        });

      } catch (err) {
        console.warn('[ExportManager] Could not instantiate worker, proceeding directly:', err);
        finish({});
      }
    });
  }

  // Pure jsPDF assembler with complete statement table and attachments
  private async generatePdfBlob(task: ExportTask, transactions: any[], imageMap: { [url: string]: string }): Promise<Blob> {
    const isOriginalQuality = !task.isCompressed;
    const doc = new jsPDF({ compress: !isOriginalQuality, unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const sortedTxs = [...transactions].sort((a, b) => {
      const dateA = new Date(a.date || a.created_at || 0).getTime();
      const dateB = new Date(b.date || b.created_at || 0).getTime();
      return dateA - dateB;
    });

    const totalIn = sortedTxs.filter(t => t.type === 'in').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalOut = sortedTxs.filter(t => t.type === 'out').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const netBalance = totalIn - totalOut;

    const dates = sortedTxs
      .map(t => new Date(t.date || t.created_at || 0).getTime())
      .filter(ts => !isNaN(ts) && ts > 0);
    const dateRangeStr = dates.length > 0
      ? `${new Date(Math.min(...dates)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} – ${new Date(Math.max(...dates)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
      : 'All Transactions';

    const nowFormatted = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // 1. Top Indigo Accent Line
    doc.setFillColor(79, 70, 229);
    doc.rect(14, 10, pageWidth - 28, 2, 'F');

    // 2. TrackBook Brand & Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(79, 70, 229);
    doc.text('TrackBook', 14, 20);

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`CASHBOOK STATEMENT — ${task.cashbookName.toUpperCase()}`, 14, 27);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Statement Period: ${dateRangeStr}  |  Generated: ${nowFormatted}  |  Entries: ${sortedTxs.length}`, 14, 33);

    // 3. Three Financial Summary Cards
    const margin = 14;
    const cardGap = 4;
    const cardWidth = (pageWidth - (margin * 2) - (cardGap * 2)) / 3;
    const cardY = 37;
    const cardHeight = 15;

    // Total Cash In Card
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(margin, cardY, cardWidth, cardHeight, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(5, 150, 105);
    doc.text('TOTAL CASH IN', margin + 3.5, cardY + 5);
    doc.setFontSize(10);
    doc.text(`Rs. ${totalIn.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin + 3.5, cardY + 11.5);

    // Total Cash Out Card
    const card2X = margin + cardWidth + cardGap;
    doc.setFillColor(255, 241, 242);
    doc.setDrawColor(254, 205, 211);
    doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(225, 29, 72);
    doc.text('TOTAL CASH OUT', card2X + 3.5, cardY + 5);
    doc.setFontSize(10);
    doc.text(`Rs. ${totalOut.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, card2X + 3.5, cardY + 11.5);

    // Net Balance Card
    const card3X = margin + (cardWidth + cardGap) * 2;
    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(199, 210, 254);
    doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(67, 56, 202);
    doc.text('NET BALANCE', card3X + 3.5, cardY + 5);
    doc.setFontSize(10);
    const balancePrefix = netBalance >= 0 ? '+' : '';
    doc.text(`${balancePrefix}Rs. ${netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, card3X + 3.5, cardY + 11.5);

    // 4. Build Transactions Table with Running Balance
    let runningBalance = 0;
    const tableBody = sortedTxs.map((t, idx) => {
      const isIn = t.type === 'in';
      const amt = Number(t.amount) || 0;
      if (isIn) {
        runningBalance += amt;
      } else {
        runningBalance -= amt;
      }

      const formattedIn = isIn ? `Rs. ${amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
      const formattedOut = !isIn ? `Rs. ${amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
      const formattedBal = `${runningBalance >= 0 ? '' : '-'}Rs. ${Math.abs(runningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const hasReceipt = t.images && t.images.length > 0 ? `Yes (${t.images.length})` : '-';

      return [
        idx + 1,
        safeFormatDate(t.date || t.created_at),
        t.description || 'Entry',
        t.category || 'General',
        t.mode || 'Cash',
        formattedIn,
        formattedOut,
        formattedBal,
        hasReceipt
      ];
    });

    autoTable(doc, {
      startY: 56,
      margin: { left: 14, right: 14, bottom: 20 },
      head: [['#', 'Date', 'Details / Description', 'Category', 'Mode', 'Cash In', 'Cash Out', 'Balance', 'Bill']],
      body: tableBody,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'left'
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
        overflow: 'linebreak'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { cellWidth: 20 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 20 },
        4: { cellWidth: 16 },
        5: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 22 },
        6: { halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72], cellWidth: 22 },
        7: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
        8: { halign: 'center', cellWidth: 14 }
      },
      foot: [[
        '',
        '',
        'TOTAL / BALANCE',
        '',
        '',
        `Rs. ${totalIn.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Rs. ${totalOut.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `${balancePrefix}Rs. ${Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        ''
      ]],
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'right'
      }
    });

    // 5. Helpers for image attachments
    const parseUrlMetadata = (url: string) => {
      if (!url || typeof url !== 'string') return { rotate: 0, fit: 'original' as const };
      const hashIdx = url.indexOf('#');
      const hash = hashIdx !== -1 ? url.substring(hashIdx + 1) : '';
      const params = new URLSearchParams(hash);
      const rotate = parseInt(params.get('rotate') || '0', 10);
      const fit = (params.get('fit') || 'original') as 'width' | 'height' | 'original';
      return { rotate, fit };
    };

    const getRotatedPdfImage = (src: string, rotate: number): Promise<{ src: string; width: number; height: number; isDataUrl: boolean }> => {
      return new Promise((resolve) => {
        if (!src) {
          resolve({ src: '', width: 300, height: 400, isDataUrl: false });
          return;
        }
        let resolved = false;
        const finish = (res: { src: string; width: number; height: number; isDataUrl: boolean }) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(tId);
            resolve(res);
          }
        };
        const tId = setTimeout(() => {
          finish({ src, width: 300, height: 400, isDataUrl: src.startsWith('data:') });
        }, 3000);

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const origWidth = img.naturalWidth || img.width || 300;
            const origHeight = img.naturalHeight || img.height || 400;
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              finish({ src, width: origWidth, height: origHeight, isDataUrl: src.startsWith('data:') });
              return;
            }

            const angleRad = ((rotate || 0) * Math.PI) / 180;
            const is90or270 = rotate === 90 || rotate === 270;
            const targetWidth = is90or270 ? origHeight : origWidth;
            const targetHeight = is90or270 ? origWidth : origHeight;

            canvas.width = targetWidth;
            canvas.height = targetHeight;

            if (rotate !== 0) {
              ctx.translate(targetWidth / 2, targetHeight / 2);
              ctx.rotate(angleRad);
              ctx.drawImage(img, -origWidth / 2, -origHeight / 2, origWidth, origHeight);
            } else {
              ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            }

            const quality = isOriginalQuality ? 0.95 : 0.8;
            const rotatedSrc = canvas.toDataURL('image/jpeg', quality);
            finish({ src: rotatedSrc, width: targetWidth, height: targetHeight, isDataUrl: true });
          } catch (_) {
            finish({ src, width: 300, height: 400, isDataUrl: src.startsWith('data:') });
          }
        };
        img.onerror = () => {
          finish({ src, width: 300, height: 400, isDataUrl: src.startsWith('data:') });
        };
        img.src = src;
      });
    };

    const addOptimizedImageToDoc = (
      pdfDoc: jsPDF,
      src: string,
      alias: string,
      x: number,
      y: number,
      w: number,
      h: number,
      isDataUrl: boolean
    ) => {
      try {
        if (isDataUrl || src.startsWith('data:')) {
          let format = 'JPEG';
          let payload = src;
          if (src.startsWith('data:image/png')) format = 'PNG';
          else if (src.startsWith('data:image/webp')) format = 'WEBP';
          if (typeof src === 'string' && src.includes('base64,')) {
            payload = src.split('base64,')[1];
          }
          const compression = isOriginalQuality ? 'NONE' : 'FAST';
          pdfDoc.addImage(payload, format as any, x, y, w, h, alias, compression);
        } else {
          // Render a clean visual card with link to view the receipt
          pdfDoc.setFillColor(248, 250, 252);
          pdfDoc.setDrawColor(226, 232, 240);
          pdfDoc.roundedRect(x, y, w, Math.min(h, 40), 3, 3, 'FD');
          pdfDoc.setFont('helvetica', 'bold');
          pdfDoc.setFontSize(9);
          pdfDoc.setTextColor(79, 70, 229);
          pdfDoc.text('Click here to view receipt attachment online', x + 10, y + 18);
          if (src.startsWith('http://') || src.startsWith('https://')) {
            pdfDoc.textWithLink('(External Cloud Receipt Link)', x + 10, y + 28, { url: src });
          }
        }
      } catch (e) {
        console.warn('[ExportManager] addImage fallback:', e);
      }
    };

    // 6. Attachment Pages (if any transactions have receipt images)
    const transactionsWithImages = sortedTxs.filter(t => t.images && t.images.length > 0);
    if (transactionsWithImages.length > 0) {
      let receiptNumber = 0;
      for (const t of transactionsWithImages) {
        if (!t.images || t.images.length === 0) continue;
        const layout = t.imageLayout || 'split';

        if (layout === 'merge') {
          for (let i = 0; i < t.images.length; i += 2) {
            doc.addPage();
            receiptNumber++;

            doc.setFillColor(79, 70, 229);
            doc.rect(14, 10, pageWidth - 28, 1.5, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(30, 41, 59);
            doc.text(`Receipt Attachment #${receiptNumber} — Transaction: ${t.description || 'Entry'} (${t.type === 'in' ? '+' : '-'}Rs. ${t.amount}) • ${safeFormatDate(t.date || t.created_at)}`, 14, 16);

            const gap = 4;
            const availableW = pageWidth - 28 - gap;
            const slotW = availableW / 2;
            const slotH = pageHeight - 45;
            const safeY = 22;

            const raw1 = t.images[i];
            const src1 = imageMap[raw1] || raw1;
            const { rotate: rot1 } = parseUrlMetadata(raw1);
            const data1 = await getRotatedPdfImage(src1, rot1);
            const ar1 = (data1.width || 300) / (data1.height || 400);
            let w1 = slotW;
            let h1 = slotW / ar1;
            if (h1 > slotH) {
              h1 = slotH;
              w1 = slotH * ar1;
            }
            const drawX1 = 14 + (slotW - w1) / 2;
            const drawY1 = safeY + (slotH - h1) / 2;
            addOptimizedImageToDoc(doc, data1.src, raw1, drawX1, drawY1, w1, h1, data1.isDataUrl);

            if (i + 1 < t.images.length) {
              const raw2 = t.images[i + 1];
              const src2 = imageMap[raw2] || raw2;
              const { rotate: rot2 } = parseUrlMetadata(raw2);
              const data2 = await getRotatedPdfImage(src2, rot2);
              const ar2 = (data2.width || 300) / (data2.height || 400);
              let w2 = slotW;
              let h2 = slotW / ar2;
              if (h2 > slotH) {
                h2 = slotH;
                w2 = slotH * ar2;
              }
              const drawX2 = 14 + slotW + gap + (slotW - w2) / 2;
              const drawY2 = safeY + (slotH - h2) / 2;
              addOptimizedImageToDoc(doc, data2.src, raw2, drawX2, drawY2, w2, h2, data2.isDataUrl);
            }
          }
        } else {
          // Split layout: 1 image per page
          for (const img of t.images) {
            doc.addPage();
            receiptNumber++;

            doc.setFillColor(79, 70, 229);
            doc.rect(14, 10, pageWidth - 28, 1.5, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(30, 41, 59);
            doc.text(`Receipt Attachment #${receiptNumber} — Transaction: ${t.description || 'Entry'} (${t.type === 'in' ? '+' : '-'}Rs. ${t.amount}) • ${safeFormatDate(t.date || t.created_at)}`, 14, 16);

            const maxW = pageWidth * 0.72;
            const maxH = pageHeight - 50;
            const targetX = (pageWidth - maxW) / 2;
            const safeY = 22;

            const resolvedSrc = imageMap[img] || img;
            const { rotate } = parseUrlMetadata(img);
            const rotatedData = await getRotatedPdfImage(resolvedSrc, rotate);

            const ar = (rotatedData.width || 300) / (rotatedData.height || 400);
            let w = maxW;
            let h = maxW / ar;
            if (h > maxH) {
              h = maxH;
              w = maxH * ar;
            }
            if (w > maxW) {
              w = maxW;
              h = maxW / ar;
            }

            const drawX = targetX + (maxW - w) / 2;
            const drawY = safeY + (maxH - h) / 2;

            addOptimizedImageToDoc(doc, rotatedData.src, img, drawX, drawY, w, h, rotatedData.isDataUrl);
          }
        }
      }
    }

    // 7. Add professional TrackBook Branding Footer on every page
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addPdfBrandingFooter(doc, i, totalPages, task.cashbookName);
    }

    task.progress = 98;
    task.message = 'Completing document compression...';
    await this.db.saveTask(task).catch(() => {});
    this.notifyListeners();

    return doc.output('blob');
  }

  // Standalone Excel Generator reusing exact report pipeline
  public async generateExcelReportData(cashbookName: string, transactions: any[]): Promise<{ blob: Blob; fileName: string; base64: string }> {
    if (!transactions || transactions.length === 0) {
      throw new Error('No transactions found to export.');
    }

    let currentPage = 1;
    const transactionPageMap = new Map<string, string>();
    const transactionsWithImages = transactions.filter(t => t.images && t.images.length > 0);
    for (const t of transactionsWithImages) {
      const layout = t.imageLayout || 'split';
      const imageCount = t.images?.length || 0;
      const pagesUsed = layout === 'merge' ? Math.ceil(imageCount / 2) : imageCount;
      
      if (pagesUsed === 1) {
        transactionPageMap.set(t.id, `Refer Page Number ${currentPage}`);
      } else {
        transactionPageMap.set(t.id, `Refer Page Number ${currentPage} to ${currentPage + pagesUsed - 1}`);
      }
      
      currentPage += pagesUsed;
    }

    const ws = buildTransactionsWorksheet(transactions, transactionPageMap);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");

    const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `${cashbookName.replace(/[^a-z0-9]/gi, '_')}.xlsx`;

    return { blob, fileName, base64 };
  }

  // Standalone PDF Generator reusing exact report pipeline
  public async generatePdfReportData(cashbookName: string, transactions: any[], isCompressed: boolean = true): Promise<{ blob: Blob; fileName: string; base64: string }> {
    if (!transactions || transactions.length === 0) {
      throw new Error('No transactions found to export.');
    }

    const taskId = 'tx_pdf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const dummyTask: ExportTask = {
      id: taskId,
      type: 'pdf',
      cashbookId: 'temp',
      cashbookName,
      isCompressed,
      status: 'processing',
      progress: 0,
      message: 'Rendering PDF...',
      createdAt: new Date().toISOString(),
      transactionsCount: transactions.length,
      attachmentsCount: transactions.filter(t => t.images && t.images.length > 0).length,
      fileName: `${cashbookName.replace(/[^a-z0-9]/gi, '_')}.pdf`
    };

    const transactionsWithImages = transactions.filter(t => t.images && t.images.length > 0);
    const allUrls: string[] = [];
    transactionsWithImages.forEach(t => {
      t.images.forEach((url: string) => {
        if (url && !allUrls.includes(url)) {
          allUrls.push(url);
        }
      });
    });

    let imageMap: { [url: string]: string } = {};
    if (allUrls.length > 0) {
      imageMap = await this.downloadImagesInWorker(dummyTask, allUrls);
    }

    const pdfBlob = await this.generatePdfBlob(dummyTask, transactions, imageMap);
    const fileName = dummyTask.fileName;

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const b64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(pdfBlob);
    });

    return { blob: pdfBlob, fileName, base64 };
  }

  // Load completed AI scan results
  async getAiScanResults(taskId: string): Promise<any[]> {
    const results = await this.db.getPayload(taskId + '_results');
    return results || [];
  }

  // Update remaining AI scan results (e.g. after partial saves or discards)
  async updateAiScanResults(taskId: string, results: any[]): Promise<void> {
    await this.db.savePayload(taskId + '_results', results);
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.attachmentsCount = results.length;
      if (results.length === 0) {
        task.message = 'All receipts added to cashbook.';
      } else {
        task.message = `${results.length} receipt${results.length > 1 ? 's' : ''} awaiting review`;
      }
      await this.db.saveTask(task);
      this.notifyListeners();
    }
  }

  // Retrieve generated blob from in-memory cache or IndexedDB
  async getBlob(taskId: string): Promise<Blob | null> {
    if (this.blobCache.has(taskId)) {
      return this.blobCache.get(taskId)!;
    }
    try {
      const blob = await this.db.getBlob(taskId);
      if (blob) {
        this.blobCache.set(taskId, blob);
        return blob;
      }
    } catch (e) {
      console.warn('[ExportManager] IDB getBlob failed:', e);
    }
    return null;
  }

  // Trigger web storage download with robust link management
  triggerDownload(fileName: string, blob: Blob) {
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (_) {}
      }, 30000);
    } catch (e) {
      console.error('[ExportManager] triggerDownload error:', e);
    }
  }

  // Download a previously completed report with self-healing fallback
  async downloadCompletedReport(taskId: string) {
    try {
      const task = this.tasks.find(t => t.id === taskId);
      if (!task) return;
      
      let blob = this.blobCache.get(taskId);
      if (!blob) {
        blob = await this.db.getBlob(taskId).catch(() => null) || undefined;
        if (blob) this.blobCache.set(taskId, blob);
      }
      
      if (blob) {
        this.triggerDownload(task.fileName, blob);
        vibrateFeedback(40);
        return;
      }

      // Self-healing fallback: re-generate on demand if transactions payload exists
      const transactions = await this.db.getPayload(taskId).catch(() => null);
      if (transactions && transactions.length > 0) {
        if (task.type === 'excel') {
          const { blob: excelBlob } = await this.generateExcelReportData(task.cashbookName, transactions);
          this.blobCache.set(taskId, excelBlob);
          await this.db.saveBlob(taskId, excelBlob).catch(() => {});
          this.triggerDownload(task.fileName, excelBlob);
          vibrateFeedback(40);
          return;
        } else {
          const newPdfBlob = await this.generatePdfBlob(task, transactions, {});
          this.blobCache.set(taskId, newPdfBlob);
          await this.db.saveBlob(taskId, newPdfBlob).catch(() => {});
          this.triggerDownload(task.fileName, newPdfBlob);
          vibrateFeedback(40);
          return;
        }
      }

      console.warn('File not found in local db for task:', taskId);
      this.notifications = [{
        id: 'notif_err_' + Date.now(),
        type: 'pdf',
        message: 'File not found in cache. Please re-export from the Reports menu.',
        taskId,
        timestamp: new Date().toISOString()
      }, ...this.notifications];
      this.notifyListeners();
    } catch (err) {
      console.error('Error loading file from DB:', err);
      this.notifications = [{
        id: 'notif_err_' + Date.now(),
        type: 'pdf',
        message: 'Error loading file from local cache.',
        taskId,
        timestamp: new Date().toISOString()
      }, ...this.notifications];
      this.notifyListeners();
    }
  }

  // Retry failed downloads
  async retryTask(taskId: string) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.status = 'pending';
    task.progress = 0;
    task.message = 'Retrying background process...';
    task.error = undefined;
    await this.db.saveTask(task);
    this.notifyListeners();

    this.processQueue();
  }

  // Wipe completed/failed logs or clear active item
  async deleteReportTask(taskId: string) {
    await this.db.deleteTask(taskId);
    this.tasks = this.tasks.filter(t => t.id !== taskId);
    this.notifyListeners();
    vibrateFeedback(30);
  }
}

// Global Singleton Export instance
export const backgroundExportManager = new BackgroundExportManager();

// Helper utils
function vibrateFeedback(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {}
  }
}

function safeFormatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Builds an Excel worksheet with transaction records, an AutoFilter table,
 * and dynamic Excel SUBTOTAL(109, ...) formulas that automatically update
 * when filtered or sorted in Excel.
 */
export function buildTransactionsWorksheet(transactions: any[], transactionPageMap?: Map<string, string>) {
  const data = (transactions || []).map(t => ({
    Date: safeFormatDate(t.date),
    Details: t.description || '',
    Category: t.category || '',
    Mode: t.mode || '',
    'Cash In': t.type === 'in' ? (t.amount || 0) : 0,
    'Cash Out': t.type === 'out' ? (t.amount || 0) : 0,
    'Reference': (transactionPageMap && transactionPageMap.get(t.id)) || '-'
  }));

  const totalIn = (transactions || []).filter(t => t.type === 'in').reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalOut = (transactions || []).filter(t => t.type === 'out').reduce((sum, t) => sum + (t.amount || 0), 0);
  const balance = totalIn - totalOut;

  const ws = XLSX.utils.json_to_sheet(data);

  const startRow = 2;
  const endRow = Math.max(2, data.length + 1);

  // Add blank row, then dynamic TOTAL row with SUBTOTAL(109,...), then dynamic BALANCE row
  // Note: Col 0=A (Date), 1=B (Details), 2=C (Category), 3=D (Mode), 4=E (Cash In), 5=F (Cash Out), 6=G (Reference)
  XLSX.utils.sheet_add_aoa(ws, [
    [],
    ['', '', '', 'TOTAL', { t: 'n', f: `SUBTOTAL(109,E${startRow}:E${endRow})`, v: totalIn }, { t: 'n', f: `SUBTOTAL(109,F${startRow}:F${endRow})`, v: totalOut }],
    ['', '', '', 'BALANCE', { t: 'n', f: `SUBTOTAL(109,E${startRow}:E${endRow})-SUBTOTAL(109,F${startRow}:F${endRow})`, v: balance }]
  ], { origin: -1 });

  // Enable AutoFilter on the data table (columns A to G)
  ws['!autofilter'] = { ref: `A1:G${endRow}` };

  // Set standard column widths so values and headers are comfortably readable
  ws['!cols'] = [
    { wch: 14 }, // Date
    { wch: 30 }, // Details
    { wch: 16 }, // Category
    { wch: 16 }, // Mode
    { wch: 14 }, // Cash In
    { wch: 14 }, // Cash Out
    { wch: 24 }  // Reference
  ];

  // Apply thin black borders and custom styling
  const borderStyle = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
  };

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const lastRow = range.e.r;
  for (let R = range.s.r; R <= range.e.r; ++R) {
    // Skip the blank separator row between transactions and totals
    if (R === lastRow - 2) continue;

    for (let C = range.s.c; C <= range.e.c; ++C) {
      // Summary rows: style columns 3, 4, 5 on TOTAL and columns 3, 4 on BALANCE
      if (R === lastRow - 1 && (C < 3 || C > 5)) continue;
      if (R === lastRow && (C < 3 || C > 4)) continue;

      const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cell_address]) {
        ws[cell_address] = { t: 's', v: '' };
      }

      const cell = ws[cell_address];
      cell.s = cell.s || {};
      cell.s.border = borderStyle;

      // Header row styling: light gray background fill and bold text
      if (R === 0) {
        cell.s.fill = { fgColor: { rgb: 'F2F2F2' } };
        cell.s.font = { bold: true };
      }

      // Summary labels and values: bold text
      if (R >= lastRow - 1) {
        cell.s.font = { bold: true };
      }
    }
  }

  return ws;
}

