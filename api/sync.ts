import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://chbbaswtawmbmyquoiac.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoYmJhc3d0YXdtYm15cXVvaWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjE5MTcsImV4cCI6MjA5MDY5NzkxN30.4qNJG7rjpEJ9vfyiGy_mteUI9_X1I6dNekEuXV26Xic';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Idempotent offline entry synchronization endpoint.
 * Prevents duplicate records by validating clientEntryId.
 */
export async function handleSyncOfflineEntry(req: Request, res: Response) {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { clientEntryId, entry } = req.body || {};

    const id = clientEntryId || entry?.id;
    if (!id || !entry || !entry.cashbook_id || entry.amount === undefined) {
      return res.status(400).json({ success: false, error: 'Missing entry, cashbook_id, or clientEntryId' });
    }

    // 1. Idempotency Check: Verify if entry with this ID already exists
    try {
      const { data: existing, error: findError } = await supabaseAdmin
        .from('entries')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (existing) {
        return res.json({
          success: true,
          duplicated: true,
          message: 'Entry already exists (idempotent)',
          entry: existing
        });
      }
    } catch (e: any) {
      console.warn('[Sync Server] Check existing warning:', e.message);
    }

    // 2. Prepare entry payload preserving original date and created_at
    const entryPayload = {
      id: id,
      cashbook_id: entry.cashbook_id,
      user_id: entry.user_id,
      user_name: entry.user_name || 'User',
      amount: Number(entry.amount),
      type: entry.type === 'in' ? 'in' : 'out',
      description: entry.description || '',
      category: entry.category || 'General',
      mode: entry.mode || 'Cash',
      date: entry.date,
      source: 'Offline Sync',
      created_at: entry.created_at || new Date().toISOString()
    };

    // 3. Insert record
    let { data: inserted, error: insertError } = await supabaseAdmin
      .from('entries')
      .insert([entryPayload])
      .select()
      .maybeSingle();

    if (insertError) {
      // If unique constraint violation occurred (race condition), fetch existing
      if (insertError.code === '23505') {
        const { data: raceExisting } = await supabaseAdmin
          .from('entries')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (raceExisting) {
          return res.json({ success: true, duplicated: true, entry: raceExisting });
        }
      }

      // Try fallback without source/user_name columns in case table doesn't have them
      const fallbackPayload = { ...entryPayload };
      delete (fallbackPayload as any).source;
      delete (fallbackPayload as any).user_name;

      const { data: retryInserted, error: retryErr } = await supabaseAdmin
        .from('entries')
        .insert([fallbackPayload])
        .select()
        .maybeSingle();

      if (retryErr) {
        if (retryErr.code === '23505') {
          const { data: raceExisting } = await supabaseAdmin
            .from('entries')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          if (raceExisting) {
            return res.json({ success: true, duplicated: true, entry: raceExisting });
          }
        }
        console.error('[Sync Server] Error inserting offline entry:', retryErr);
        return res.status(500).json({ success: false, error: retryErr.message });
      }
      inserted = retryInserted;
    }

    return res.json({
      success: true,
      created: true,
      entry: inserted || entryPayload
    });

  } catch (err: any) {
    console.error('[Sync Server] Exception in handleSyncOfflineEntry:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
}

/**
 * Batch offline entry synchronization endpoint.
 */
export async function handleBatchSyncOfflineEntries(req: Request, res: Response) {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { entries } = req.body || {};
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, error: 'Expected array of entries' });
    }

    const results: any[] = [];
    let syncedCount = 0;
    let failedCount = 0;

    for (const item of entries) {
      const id = item.clientEntryId || item.id;
      if (!id || !item.cashbook_id || item.amount === undefined) {
        results.push({ id, success: false, error: 'Invalid entry payload' });
        failedCount++;
        continue;
      }

      // Idempotency check
      const { data: existing } = await supabaseAdmin
        .from('entries')
        .select('id')
        .eq('id', id)
        .maybeSingle();

      if (existing) {
        results.push({ id, success: true, duplicated: true });
        syncedCount++;
        continue;
      }

      const payload = {
        id,
        cashbook_id: item.cashbook_id,
        user_id: item.user_id,
        user_name: item.user_name || 'User',
        amount: Number(item.amount),
        type: item.type === 'in' ? 'in' : 'out',
        description: item.description || '',
        category: item.category || 'General',
        mode: item.mode || 'Cash',
        date: item.date,
        source: 'Offline Sync',
        created_at: item.created_at || new Date().toISOString()
      };

      const { error: insErr } = await supabaseAdmin
        .from('entries')
        .insert([payload]);

      if (insErr) {
        const fallback = { ...payload };
        delete (fallback as any).source;
        delete (fallback as any).user_name;
        const { error: fallbackErr } = await supabaseAdmin
          .from('entries')
          .insert([fallback]);

        if (fallbackErr && fallbackErr.code !== '23505') {
          results.push({ id, success: false, error: fallbackErr.message });
          failedCount++;
          continue;
        }
      }

      results.push({ id, success: true, created: true });
      syncedCount++;
    }

    return res.json({
      success: true,
      syncedCount,
      failedCount,
      results
    });
  } catch (err: any) {
    console.error('[Sync Server] Exception in handleBatchSyncOfflineEntries:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
}
