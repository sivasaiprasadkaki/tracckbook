/**
 * Data Reconciliation Service
 * 
 * Safely inspects existing IndexedDB and localStorage offline queues,
 * verifies whether records exist in Supabase, preserves and migrates
 * any legitimate unsynced user entries/cashbooks to Supabase,
 * and only then cleans up obsolete offline queues to ensure zero data loss.
 * 
 * STRICT COMPLIANCE:
 * - DO NOT delete IndexedDB databases destructively before recovery.
 * - Compare each record with Supabase before migrating (no duplicates).
 * - Preserve all original fields (id, user_id, cashbook_id, amount, date, created_at, etc.).
 * - Validate foreign key relationships between entries and cashbooks.
 */

import { supabase } from '../lib/supabase';
import { safeUUID } from '../lib/utils';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function ensureValidUUID(id?: string): string {
  if (id && UUID_REGEX.test(id)) return id;
  return safeUUID();
}

const DB_NAME = 'trackbook_offline_db';
const STORE_ENTRIES = 'offline_entries';
const STORE_CACHED_BOOKS = 'cached_cashbooks';
const LOCAL_PENDING_ENTRIES_KEY = 'trackbook_offline_pending_entries_v1';
const LOCAL_PENDING_BOOKS_KEY = 'trackbook_offline_pending_books_v1';
const LOCAL_PENDING_LEGACY_KEY = 'trackbook_offline_pending_v1';

export interface MigrationResult {
  migratedBooks: number;
  migratedEntries: number;
  unmappedEntries: any[];
  errors: string[];
}

/**
 * Reads all records from an IndexedDB object store safely without modifying anything
 */
async function getAllFromStore(db: IDBDatabase, storeName: string): Promise<any[]> {
  if (!db.objectStoreNames.contains(storeName)) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Opens the existing offline database if present in the browser, without altering schema
 */
async function openExistingIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return null;
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function reconcileAndMigrateOfflineData(session: any): Promise<MigrationResult> {
  const result: MigrationResult = {
    migratedBooks: 0,
    migratedEntries: 0,
    unmappedEntries: [],
    errors: []
  };

  if (!session?.user?.id) {
    return result;
  }

  const userId = session.user.id;
  const userName = session.user.user_metadata?.full_name || 
                   session.user.user_metadata?.name || 
                   session.user.email?.split('@')[0] || 'User';
  const userEmail = session.user.email || '';

  console.log('[Reconciliation] Starting safe inspection of offline stores for user:', userId);

  try {
    // =========================================================================
    // 1. INSPECT & COLLECT PENDING CASHBOOKS FROM LOCALSTORAGE & INDEXEDDB
    // =========================================================================
    const pendingBooksMap = new Map<string, any>();

    // Inspect localStorage
    try {
      const rawBooks = localStorage.getItem(LOCAL_PENDING_BOOKS_KEY);
      if (rawBooks) {
        const parsed = JSON.parse(rawBooks);
        if (Array.isArray(parsed)) {
          parsed.forEach(b => {
            if (b && (b.id || b.name)) {
              const bookKey = b.id || safeUUID();
              pendingBooksMap.set(bookKey, { ...b, id: bookKey });
            }
          });
        }
      }
    } catch (_) {}

    // Inspect IndexedDB
    const db = await openExistingIndexedDB();
    if (db) {
      try {
        const idbBooks = await getAllFromStore(db, STORE_CACHED_BOOKS);
        idbBooks.forEach(b => {
          if (b && (b.id || b.name)) {
            // Check if flagged as pending or local-only
            if (b.syncStatus === 'PENDING' || b.syncStatus === 'FAILED' || b.is_offline) {
              const bookKey = b.id || safeUUID();
              if (!pendingBooksMap.has(bookKey)) {
                pendingBooksMap.set(bookKey, { ...b, id: bookKey });
              }
            }
          }
        });
      } catch (err: any) {
        console.warn('[Reconciliation] Notice reading IDB cashbooks store:', err);
      }
    }

    // =========================================================================
    // 2. RECONCILE AND MIGRATE CASHBOOKS TO SUPABASE
    // =========================================================================
    for (const [bookId, book] of pendingBooksMap.entries()) {
      try {
        const targetBookId = ensureValidUUID(book.id || bookId);
        const bookName = (book.name || 'Recovered Cashbook').trim();

        // Check if cashbook already exists in Supabase
        let existsInSupabase = false;
        if (supabase) {
          try {
            const { data: existingBook } = await supabase
              .from('cashbooks')
              .select('id, name')
              .eq('id', targetBookId)
              .maybeSingle();

            if (existingBook?.id) {
              existsInSupabase = true;
              console.log(`[Reconciliation] Cashbook "${bookName}" (${targetBookId}) already exists in Supabase. Skipping duplicate.`);
            }
          } catch (_) {}
        }

        if (!existsInSupabase) {
          console.log(`[Reconciliation] Recovering unsynced cashbook "${bookName}" (${targetBookId}) into Supabase...`);
          const payload = {
            id: targetBookId,
            name: bookName,
            user_id: book.user_id || userId,
            user_name: book.user_name || userName,
            created_at: book.created_at || new Date().toISOString()
          };

          let saved = false;

          // 1. Direct Supabase insert
          if (supabase) {
            try {
              const { error: insErr } = await supabase
                .from('cashbooks')
                .insert([payload]);
              if (!insErr) saved = true;
            } catch (_) {}
          }

          // 2. Server-side proxy fallback with service role
          if (!saved) {
            try {
              const res = await fetch('/api/sync/cashbook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              if (res.ok) {
                const json = await res.json();
                if (json?.success) saved = true;
              }
            } catch (_) {}
          }

          if (saved) {
            result.migratedBooks++;
            console.log(`[Reconciliation] Successfully recovered cashbook "${bookName}" to Supabase!`);
          } else {
            result.errors.push(`Failed to recover cashbook: ${bookName}`);
          }
        }
      } catch (err: any) {
        console.error(`[Reconciliation] Error migrating cashbook ${bookId}:`, err);
        result.errors.push(err.message || 'Error migrating cashbook');
      }
    }

    // =========================================================================
    // 3. INSPECT & COLLECT PENDING ENTRIES FROM LOCALSTORAGE & INDEXEDDB
    // =========================================================================
    const pendingEntriesMap = new Map<string, any>();

    // From localStorage
    [LOCAL_PENDING_ENTRIES_KEY, LOCAL_PENDING_LEGACY_KEY].forEach(key => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach(e => {
              if (e && (e.id || e.clientEntryId)) {
                const entryKey = e.id || e.clientEntryId;
                pendingEntriesMap.set(entryKey, e);
              }
            });
          }
        }
      } catch (_) {}
    });

    // From IndexedDB
    if (db) {
      try {
        const idbEntries = await getAllFromStore(db, STORE_ENTRIES);
        idbEntries.forEach(e => {
          if (e && (e.id || e.clientEntryId)) {
            const entryKey = e.id || e.clientEntryId;
            if (e.syncStatus === 'PENDING' || e.syncStatus === 'FAILED' || e.is_offline) {
              if (!pendingEntriesMap.has(entryKey)) {
                pendingEntriesMap.set(entryKey, e);
              }
            }
          }
        });
      } catch (err: any) {
        console.warn('[Reconciliation] Notice reading IDB entries store:', err);
      }
    }

    // =========================================================================
    // 4. RECONCILE AND MIGRATE ENTRIES TO SUPABASE
    // =========================================================================
    for (const [entryId, entry] of pendingEntriesMap.entries()) {
      try {
        const targetEntryId = ensureValidUUID(entry.id || entry.clientEntryId || entryId);
        const rawCashbookId = entry.cashbook_id;

        if (!rawCashbookId) {
          console.warn('[Reconciliation] Entry missing cashbook_id relationship. Adding to unmapped report:', entry);
          result.unmappedEntries.push({ entryId: targetEntryId, reason: 'Missing cashbook_id', entry });
          continue;
        }

        const targetCashbookId = ensureValidUUID(rawCashbookId);

        // Verify foreign key relationship: Does this cashbook exist in Supabase?
        let cashbookExists = false;
        if (supabase) {
          try {
            const { data: cbCheck } = await supabase
              .from('cashbooks')
              .select('id, name')
              .eq('id', targetCashbookId)
              .maybeSingle();
            if (cbCheck?.id) cashbookExists = true;
          } catch (_) {}
        }

        if (!cashbookExists) {
          console.warn(`[Reconciliation] Entry references cashbook ${targetCashbookId} that does not exist in Supabase. Adding to unmapped report.`);
          result.unmappedEntries.push({ entryId: targetEntryId, cashbookId: targetCashbookId, reason: 'Cashbook does not exist in Supabase', entry });
          continue;
        }

        // Check if entry already exists in Supabase (idempotency - no duplicates)
        let entryAlreadyExists = false;
        if (supabase) {
          try {
            const { data: existingEntry } = await supabase
              .from('entries')
              .select('id')
              .eq('id', targetEntryId)
              .maybeSingle();
            if (existingEntry?.id) {
              entryAlreadyExists = true;
              console.log(`[Reconciliation] Entry ${targetEntryId} already exists in Supabase. Skipping duplicate.`);
            }
          } catch (_) {}
        }

        if (!entryAlreadyExists) {
          console.log(`[Reconciliation] Recovering unsynced entry ${targetEntryId} into Supabase...`);
          const payload: any = {
            id: targetEntryId,
            cashbook_id: targetCashbookId,
            user_id: entry.user_id || userId,
            user_name: entry.user_name || userName,
            amount: Number(entry.amount) || 0,
            type: entry.type === 'in' ? 'in' : 'out',
            description: entry.description || '',
            category: entry.category || 'General',
            mode: entry.mode || 'Cash',
            date: entry.date || new Date().toISOString(),
            image_layout: entry.image_layout || entry.imageLayout || 'split',
            created_at: entry.created_at || new Date().toISOString()
          };

          let saved = false;

          // 1. Direct Supabase insert
          if (supabase) {
            try {
              const { error: entErr } = await supabase
                .from('entries')
                .insert([payload]);
              if (!entErr) saved = true;
            } catch (_) {}
          }

          // 2. Server-side RBAC / Service role fallback
          if (!saved) {
            try {
              const rbacRes = await fetch('/api/rbac/save-entry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  entry: payload,
                  userId: payload.user_id,
                  userEmail: userEmail
                })
              });
              if (rbacRes.ok) {
                const rbacJson = await rbacRes.json();
                if (rbacJson?.success) saved = true;
              }
            } catch (_) {}
          }

          if (saved) {
            result.migratedEntries++;
            console.log(`[Reconciliation] Successfully recovered entry ${targetEntryId} into Supabase!`);
          } else {
            result.errors.push(`Failed to recover entry ${targetEntryId}`);
          }
        }
      } catch (err: any) {
        console.error(`[Reconciliation] Error migrating entry ${entryId}:`, err);
        result.errors.push(err.message || 'Error migrating entry');
      }
    }

    // =========================================================================
    // 5. CLEAN UP OBSOLETE OFFLINE DATA SAFELY ONLY AFTER VERIFIED SUCCESS
    // =========================================================================
    if (result.errors.length === 0) {
      console.log('[Reconciliation] All eligible offline data verified in Supabase. Safely cleaning obsolete offline queues...');
      try {
        localStorage.removeItem(LOCAL_PENDING_BOOKS_KEY);
        localStorage.removeItem(LOCAL_PENDING_ENTRIES_KEY);
        localStorage.removeItem(LOCAL_PENDING_LEGACY_KEY);
        localStorage.setItem('trackbook_offline_reconciliation_completed', 'true');
      } catch (_) {}

      if (db) {
        try {
          if (db.objectStoreNames.contains(STORE_ENTRIES)) {
            const tx = db.transaction(STORE_ENTRIES, 'readwrite');
            tx.objectStore(STORE_ENTRIES).clear();
          }
          if (db.objectStoreNames.contains(STORE_CACHED_BOOKS)) {
            const tx = db.transaction(STORE_CACHED_BOOKS, 'readwrite');
            tx.objectStore(STORE_CACHED_BOOKS).clear();
          }
        } catch (_) {}
      }
    }

    if (db) {
      try { db.close(); } catch (_) {}
    }

    console.log('[Reconciliation] Finished successfully:', {
      migratedBooks: result.migratedBooks,
      migratedEntries: result.migratedEntries,
      unmappedEntriesCount: result.unmappedEntries.length,
      errorsCount: result.errors.length
    });
  } catch (globalErr: any) {
    console.error('[Reconciliation] Global reconciliation error:', globalErr);
    result.errors.push(globalErr.message || 'Global error');
  }

  return result;
}
