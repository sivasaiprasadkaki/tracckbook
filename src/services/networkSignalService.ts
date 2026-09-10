export type SignalQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

export interface SignalData {
  bars: number; // 0 to 4
  latency: number | null; // in ms
  effectiveType: string; // '4g', '3g', '2g', 'slow-2g', 'wifi'
  downlink: number | null; // in Mbps
  quality: SignalQuality;
  qualityLabel: string;
  isChecking: boolean;
  lastChecked: number;
}

type SignalListener = (data: SignalData) => void;

class NetworkSignalService {
  private data: SignalData = {
    bars: typeof navigator !== 'undefined' && !navigator.onLine ? 0 : 4,
    latency: null,
    effectiveType: '4g',
    downlink: null,
    quality: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'excellent',
    qualityLabel: typeof navigator !== 'undefined' && !navigator.onLine ? 'Offline' : 'Online',
    isChecking: false,
    lastChecked: Date.now()
  };

  private listeners: SignalListener[] = [];
  private intervalId: any = null;
  private isMeasuring = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Listen to native online/offline events
      window.addEventListener('online', () => {
        this.measureSignal();
      });

      window.addEventListener('offline', () => {
        this.updateState({
          bars: 0,
          latency: null,
          quality: 'offline',
          qualityLabel: 'Offline',
          isChecking: false,
          lastChecked: Date.now()
        });
      });

      // Listen to Network Information API connection changes if supported
      const conn = (navigator as any).connection;
      if (conn) {
        conn.addEventListener('change', () => {
          this.measureSignal();
        });
      }

      // Check on window focus or visibility change
      window.addEventListener('focus', () => {
        this.measureSignal();
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.measureSignal();
          this.startPeriodicChecks();
        } else {
          this.stopPeriodicChecks();
        }
      });

      // Initial measurement
      setTimeout(() => {
        this.measureSignal();
      }, 200);

      // Start periodic detection loop
      this.startPeriodicChecks();
    }
  }

  public getData(): SignalData {
    return this.data;
  }

  public subscribe(listener: SignalListener): () => void {
    this.listeners.push(listener);
    listener(this.data);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.data);
      } catch (err) {
        console.error('[NetworkSignalService] listener notification error:', err);
      }
    }
  }

  private updateState(partial: Partial<SignalData>) {
    this.data = { ...this.data, ...partial };
    this.notify();
  }

  private startPeriodicChecks() {
    if (this.intervalId) clearInterval(this.intervalId);
    // Real-time ping check every 8 seconds when active
    this.intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        this.measureSignal();
      }
    }, 8000);
  }

  private stopPeriodicChecks() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public async measureSignal(): Promise<SignalData> {
    if (this.isMeasuring) return this.data;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.updateState({
        bars: 0,
        latency: null,
        quality: 'offline',
        qualityLabel: 'Offline',
        isChecking: false,
        lastChecked: Date.now()
      });
      return this.data;
    }

    this.isMeasuring = true;
    this.updateState({ isChecking: true });

    const conn = typeof navigator !== 'undefined' ? (navigator as any).connection : null;
    const effectiveType = conn?.effectiveType || '4g';
    const downlink = typeof conn?.downlink === 'number' ? conn.downlink : null;

    try {
      const startTime = performance.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`/api/health?_t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (!res || !res.ok) {
        // Ping failed but navigator says online - treat as degraded or offline
        this.updateState({
          bars: 1,
          latency: null,
          effectiveType,
          downlink,
          quality: 'poor',
          qualityLabel: 'Unstable Connection',
          isChecking: false,
          lastChecked: Date.now()
        });
        return this.data;
      }

      const rtt = Math.max(1, Math.round(performance.now() - startTime));

      // Calculate bars & quality based on latency and network conditions
      let bars = 4;
      let quality: SignalQuality = 'excellent';
      let qualityLabel = 'Excellent Signal';

      if (effectiveType === 'slow-2g' || effectiveType === '2g' || rtt > 600) {
        bars = 1;
        quality = 'poor';
        qualityLabel = 'Weak Signal';
      } else if (effectiveType === '3g' || rtt > 300) {
        bars = 2;
        quality = 'fair';
        qualityLabel = 'Fair Signal';
      } else if (rtt > 140) {
        bars = 3;
        quality = 'good';
        qualityLabel = 'Good Signal';
      } else {
        bars = 4;
        quality = 'excellent';
        qualityLabel = 'Excellent Signal';
      }

      this.updateState({
        bars,
        latency: rtt,
        effectiveType,
        downlink,
        quality,
        qualityLabel,
        isChecking: false,
        lastChecked: Date.now()
      });

      return this.data;
    } catch {
      this.updateState({
        bars: 0,
        latency: null,
        quality: 'offline',
        qualityLabel: 'Offline',
        isChecking: false,
        lastChecked: Date.now()
      });
      return this.data;
    } finally {
      this.isMeasuring = false;
    }
  }
}

export const networkSignalService = new NetworkSignalService();
