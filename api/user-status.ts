import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const getAdminSupabase = () => {
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey);
};

/**
 * Helper to normalize raw status string
 */
function normalizeStatus(raw: string | null | undefined): 'active' | 'blocked' | 'unknown' {
  if (!raw) return 'unknown';
  const clean = raw.trim().toLowerCase();
  if (clean.includes('block') || clean.includes('ban') || clean.includes('suspended')) {
    return 'blocked';
  }
  if (clean.includes('active')) {
    return 'active';
  }
  return 'unknown';
}

/**
 * POST /api/auth/check-status
 * Body: { userId?: string, email?: string }
 */
export async function handleCheckUserStatus(req: Request, res: Response) {
  try {
    const { userId, email } = req.body || {};
    const cleanId = userId ? String(userId).trim() : '';
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';

    if (!cleanId && !cleanEmail) {
      return res.status(400).json({ error: 'Missing userId or email parameter' });
    }

    const supabase = getAdminSupabase();
    if (!supabase) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    // 1. Check `users` table
    let query = supabase.from('users').select('*');
    if (cleanId && cleanEmail) {
      query = query.or(`id.eq.${cleanId},email.ilike.${cleanEmail}`);
    } else if (cleanId) {
      query = query.eq('id', cleanId);
    } else {
      query = query.ilike('email', cleanEmail);
    }

    const { data: usersData, error: usersError } = await query.limit(10);
    if (!usersError && usersData && usersData.length > 0) {
      for (const user of usersData) {
        const norm = normalizeStatus(user.status);
        if (norm === 'blocked') {
          return res.json({
            status: 'blocked',
            message: 'User blocked',
            rawStatus: user.status,
            userId: user.id,
            email: user.email,
          });
        }
      }

      for (const user of usersData) {
        const norm = normalizeStatus(user.status);
        if (norm === 'active') {
          return res.json({
            status: 'active',
            rawStatus: user.status,
            userId: user.id,
            email: user.email,
          });
        }
      }
    }

    // 2. Check Auth GoTrue for `banned_until` if service role key is available
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        if (cleanId) {
          const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(cleanId);
          if (!authErr && authUser?.user) {
            const bannedUntil = (authUser.user as any).banned_until;
            if (bannedUntil && new Date(bannedUntil).getTime() > Date.now()) {
              return res.json({
                status: 'blocked',
                message: 'User blocked',
                source: 'auth_banned_until',
                rawStatus: bannedUntil,
                userId: authUser.user.id,
                email: authUser.user.email,
              });
            }
          }
        }

        if (cleanEmail) {
          const { data: listRes } = await supabase.auth.admin.listUsers();
          if (listRes?.users) {
            const found = listRes.users.find(
              (u) => u.email?.toLowerCase() === cleanEmail
            );
            if (found) {
              const bannedUntil = (found as any).banned_until;
              if (bannedUntil && new Date(bannedUntil).getTime() > Date.now()) {
                return res.json({
                  status: 'blocked',
                  message: 'User blocked',
                  source: 'auth_banned_until',
                  rawStatus: bannedUntil,
                  userId: found.id,
                  email: found.email,
                });
              }
            }
          }
        }
      } catch (authLookupErr) {
        console.warn('[handleCheckUserStatus] Auth admin check note:', authLookupErr);
      }
    }

    // Default: active
    return res.json({ status: 'active' });
  } catch (err: any) {
    console.error('[handleCheckUserStatus] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

/**
 * GET /api/admin/users
 * Returns list of users for administration
 */
export async function handleGetAdminUsers(req: Request, res: Response) {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Merge with auth.users if available
    let enrichedUsers = users || [];
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { data: authList } = await supabase.auth.admin.listUsers();
        if (authList?.users) {
          const authMap = new Map<string, any>();
          authList.users.forEach((u) => {
            if (u.id) authMap.set(u.id, u);
            if (u.email) authMap.set(u.email.toLowerCase(), u);
          });

          enrichedUsers = enrichedUsers.map((u) => {
            const authUser = authMap.get(u.id) || (u.email ? authMap.get(u.email.toLowerCase()) : null);
            const isBanned = authUser?.banned_until && new Date(authUser.banned_until).getTime() > Date.now();
            return {
              ...u,
              banned_until: authUser?.banned_until,
              effective_status: isBanned ? 'blocked' : (normalizeStatus(u.status) === 'blocked' ? 'blocked' : 'active'),
            };
          });
        }
      } catch (authErr) {
        console.warn('[handleGetAdminUsers] Auth list enrichment note:', authErr);
      }
    }

    return res.json({ users: enrichedUsers });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/admin/user-status
 * Body: { userId?: string, email?: string, status: 'active' | 'blocked' }
 */
export async function handleSetUserStatus(req: Request, res: Response) {
  try {
    const { userId, email, status } = req.body || {};
    const norm = normalizeStatus(status);

    if (norm !== 'active' && norm !== 'blocked') {
      return res.status(400).json({ error: "status must be 'active' or 'blocked'" });
    }

    const supabase = getAdminSupabase();
    if (!supabase) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const targetStatus = norm === 'blocked' ? 'blocked' : 'active';
    let updatedRows: any[] = [];

    // 1. Update `users` table
    if (userId) {
      const { data, error } = await supabase
        .from('users')
        .update({ status: targetStatus })
        .eq('id', userId)
        .select();

      if (!error && data) {
        updatedRows = data;
      }
    }

    if (email && (!updatedRows || updatedRows.length === 0)) {
      const { data, error } = await supabase
        .from('users')
        .update({ status: targetStatus })
        .ilike('email', email)
        .select();

      if (!error && data) {
        updatedRows = data;
      }
    }

    // If row did not exist in `users` table, insert it
    if ((!updatedRows || updatedRows.length === 0) && (userId || email)) {
      const { data: insData, error: insErr } = await supabase
        .from('users')
        .insert([{
          id: userId || crypto.randomUUID(),
          email: email || '',
          status: targetStatus,
          is_admin: false,
        }])
        .select();

      if (!insErr && insData) {
        updatedRows = insData;
      }
    }

    // 2. Also update GoTrue banned status if service role key available
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        let targetAuthId = userId;
        if (!targetAuthId && email) {
          const { data: listRes } = await supabase.auth.admin.listUsers();
          const found = listRes?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
          if (found) targetAuthId = found.id;
        }

        if (targetAuthId) {
          await supabase.auth.admin.updateUserById(targetAuthId, {
            ban_duration: norm === 'blocked' ? '876000h' : 'none',
          });
        }
      } catch (authBanErr) {
        console.warn('[handleSetUserStatus] Auth ban sync note:', authBanErr);
      }
    }

    return res.json({
      success: true,
      status: targetStatus,
      updatedUsers: updatedRows,
    });
  } catch (err: any) {
    console.error('[handleSetUserStatus] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
