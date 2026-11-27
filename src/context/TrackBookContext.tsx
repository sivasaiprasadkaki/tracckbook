import React, { createContext, useContext } from 'react';
import { AnalyticsBook, AnalyticsTransaction } from '../utils/analytics';

export interface Transaction extends AnalyticsTransaction {
  id: string;
  amount: number;
  type: 'in' | 'out';
  description: string;
  category: string;
  mode: string;
  date: Date;
  images?: string[];
  imageLayout?: 'merge' | 'split';
  isAi?: boolean;
  imported_from_share_code?: string;
  is_imported?: boolean;
  import_batch_id?: string;
  source?: 'Manual' | 'Imported' | 'AI';
}

export interface Cashbook extends AnalyticsBook {
  id: string;
  name: string;
  transactions: Transaction[];
  createdAt: Date;
  user_id?: string;
  user_name?: string;
}

export interface TrackBookContextValue {
  session: any;
  userName: string;
  books: Cashbook[];
  isLoading: boolean;
  isRefreshing: boolean;
  lastUpdatedAt: Date | null;
  error: string | null;
  refreshData: (force?: boolean) => Promise<void>;
  openQuickTransactionModal: (type: 'in' | 'out', bookId?: string | null) => void;
  openCreateBookModal: () => void;
  openBook: (bookId: string) => void;
  openPdfExportModal: (bookId: string, bookName: string, transactions: Transaction[]) => void;
  exportExcelReport: (bookId: string, bookName: string, transactions: Transaction[]) => Promise<void>;
  signOut: () => Promise<void>;
}

const TrackBookContext = createContext<TrackBookContextValue | null>(null);

export const TrackBookProvider: React.FC<{
  value: TrackBookContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return <TrackBookContext.Provider value={value}>{children}</TrackBookContext.Provider>;
};

export function useTrackBook() {
  const ctx = useContext(TrackBookContext);
  if (!ctx) {
    throw new Error('useTrackBook must be used inside TrackBookProvider');
  }
  return ctx;
}
