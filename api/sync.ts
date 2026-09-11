import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://chbbaswtawmbmyquoiac.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoYmJhc3d0YXdtYm15cXVvaWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjE5MTcsImV4cCI6MjA5MDY5NzkxN30.4qNJG7rjpEJ9vfyiGy_mteUI9_X1I6dNekEuXV26Xic';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DUMMY_UUID = '00000000-0000-0000-0000-000000000000';

let cachedSystemUserId: string | null = null;

async function resolveValidUserId(userId: any, cashbookId: string): Promise<string> {
  // 1. If a non-dummy UUID is provided, verify it exists in auth.users
  if (typeof userId === 'string' && UUID_REGEX.test(userId) && userId !== DUMMY_UUID) {
    try {
      const { data: userCheck } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (userCheck?.user?.id) {
        return userCheck.user.id;
      }
    } catch (e: any) {
      console.warn('[Sync Server] User validation warning for ' + userId + ':', e.message);
    }
  }

  // 2. Query cashbook owner: Every cashbook in Supabase has a valid user_id foreign key
  if (cashbookId && UUID_REGEX.test(cashbookId)) {
    try {
      const { data: cb } = await supabaseAdmin
        .from('cashbooks')
        .select('user_id')
        .eq('id', cashbookId)
        .maybeSingle();
      if (cb?.user_id && UUID_REGEX.test(cb.user_id) && cb.user_id !== DUMMY_UUID) {
        return cb.user_id;
      }
    } catch (e: any) {
      console.warn('[Sync Server] Failed to resolve user_id from cashbook:', e.message);
    }
  }

  // 3. Fallback to cached or first user in auth.users
  if (cachedSystemUserId) {
    return cachedSystemUserId;
  }

  try {
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1 });
    if (usersData?.users?.[0]?.id) {
      cachedSystemUserId = usersData.users[0].id;
      return cachedSystemUserId;
    }
  } catch (e: any) {
    console.warn('[Sync Server] Failed to fetch system fallback user:', e.message);
  }

  return '80a1146e-c0d1-4d27-a0c9-0ec6810df902';
}

/**
 * Idempotent offline entry synchronization endpoint.
 * Prevents duplicate records by validating clientEntryId and using upsert.
 */
export async function handleSyncOfflineEntry(req: Request, res: Response) {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { clientEntryId, entry } = req.body || {};

    const id = clientEntryId || entry?.id;
    if (!id || !entry || !entry.cashbook_id || entry.amount === undefined) {
      console.error('[Sync Server] 400 Bad Request - Missing required entry fields:', { id, hasEntry: !!entry });
      return res.status(400).json({ success: false, error: 'Missing entry, cashbook_id, or clientEntryId' });
    }

    // 1. Idempotency Check: Verify if entry with this ID already exists
    try {
      const { data: existing } = await supabaseAdmin
        .from('entries')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (existing) {
        console.log(`[Sync Server] Entry ${id} already exists in database (idempotent).`);
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

    const resolvedUserId = await resolveValidUserId(entry.user_id, entry.cashbook_id);

    // 2. Prepare entry payload matching exact Supabase entries table schema
    const entryPayload = {
      id: id,
      cashbook_id: entry.cashbook_id,
      user_id: resolvedUserId,
      user_name: entry.user_name || 'User',
      amount: Number(entry.amount),
      type: entry.type === 'in' ? 'in' : 'out',
      description: entry.description || '',
      category: entry.category || 'General',
      mode: entry.mode || 'Cash',
      date: entry.date || new Date().toISOString(),
      image_layout: entry.image_layout || entry.imageLayout || 'split',
      created_at: entry.created_at || new Date().toISOString()
    };

    console.log(`[Sync Server] Inserting/upserting entry ${id} for cashbook ${entry.cashbook_id}...`);

    // 3. Perform idempotent upsert on table entries
    const { data: upserted, error: upsertError } = await supabaseAdmin
      .from('entries')
      .upsert([entryPayload], { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (upsertError) {
      console.error('[Sync Server] Error upserting offline entry:', upsertError);
      return res.status(500).json({ success: false, error: upsertError.message });
    }

    console.log(`[Sync Server] Successfully synced entry ${id} to Supabase database.`);

    return res.json({
      success: true,
      created: true,
      entry: upserted || entryPayload
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

      const resolvedUserId = await resolveValidUserId(item.user_id, item.cashbook_id);

      const payload = {
        id,
        cashbook_id: item.cashbook_id,
        user_id: resolvedUserId,
        user_name: item.user_name || 'User',
        amount: Number(item.amount),
        type: item.type === 'in' ? 'in' : 'out',
        description: item.description || '',
        category: item.category || 'General',
        mode: item.mode || 'Cash',
        date: item.date || new Date().toISOString(),
        image_layout: item.image_layout || item.imageLayout || 'split',
        created_at: item.created_at || new Date().toISOString()
      };

      const { data: upserted, error: upsertErr } = await supabaseAdmin
        .from('entries')
        .upsert([payload], { onConflict: 'id' })
        .select()
        .maybeSingle();

      if (upsertErr) {
        results.push({ id, success: false, error: upsertErr.message });
        failedCount++;
        continue;
      }

      results.push({ id, success: true, created: true, entry: upserted || payload });
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

/**
 * Handle sync / creation of a cashbook idempotently
 */
export async function handleSyncCashbook(req: Request, res: Response) {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { id, name, user_id, user_name, created_at } = req.body;
    if (!id || !name) {
      return res.status(400).json({ success: false, error: 'Missing id or name for cashbook' });
    }

    const resolvedUserId = await resolveValidUserId(user_id, id);

    // 1. Check if cashbook already exists
    const { data: existing } = await supabaseAdmin
      .from('cashbooks')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (existing) {
      if (existing.name !== name) {
        await supabaseAdmin
          .from('cashbooks')
          .update({ name })
          .eq('id', id);
      }
      return res.json({ success: true, duplicated: true, message: 'Cashbook already exists', cashbook: { ...existing, name } });
    }

    // 2. Insert cashbook
    const payload: any = {
      id,
      name,
      user_id: resolvedUserId,
      created_at: created_at || new Date().toISOString()
    };
    if (user_name) {
      payload.user_name = user_name;
    }

    const { data: created, error } = await supabaseAdmin
      .from('cashbooks')
      .upsert([payload], { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[Sync Server] Cashbook upsert note, retrying without optional columns:', error.message);
      const fallbackPayload = {
        id,
        name,
        user_id: resolvedUserId,
        created_at: created_at || new Date().toISOString()
      };
      const { data: retryCreated, error: retryErr } = await supabaseAdmin
        .from('cashbooks')
        .upsert([fallbackPayload], { onConflict: 'id' })
        .select()
        .maybeSingle();

      if (retryErr) {
        return res.status(500).json({ success: false, error: retryErr.message });
      }
      return res.json({ success: true, created: true, cashbook: retryCreated || fallbackPayload });
    }

    return res.json({ success: true, created: true, cashbook: created || payload });
  } catch (err: any) {
    console.error('[Sync Server] Error in handleSyncCashbook:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
}

export default async function syncHandler(req: any, res: any) {
  if (req.method === 'POST') {
    if (req.body?.entries) {
      return handleBatchSyncOfflineEntries(req, res);
    }
    if (req.body?.name && !req.body?.amount) {
      return handleSyncCashbook(req, res);
    }
    return handleSyncOfflineEntry(req, res);
  }
  return res.status(200).json({ ok: true, message: 'Sync module ready' });
}
