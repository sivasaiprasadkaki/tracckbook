import { supabase } from '../lib/supabase';

export type UserAccountStatus = 'active' | 'blocked' | 'unknown';

export interface UserAccountStatusResult {
  status: UserAccountStatus;
  message?: string;
  source?: string;
  rawStatus?: string;
}

/**
 * Normalizes any raw status string to 'active', 'blocked', or 'unknown'.
 * Handles strings like:
 * - 'active'
 * - 'Active'
 * - 'Active|2026-09-22T14:58:14.810Z'
 * - 'blocked'
 * - 'Blocked'
 * - 'banned'
 * - 'Banned'
 * - 'Blocked|...'
 * - 'inactive'
 */
export function normalizeAccountStatus(raw: string | null | undefined): UserAccountStatus {
  if (!raw) return 'unknown';
  const clean = raw.trim().toLowerCase();

  // If contains block or ban, it is definitely blocked
  if (clean.includes('block') || clean.includes('ban') || clean.includes('suspended')) {
    return 'blocked';
  }

  // If contains active, it is active
  if (clean.includes('active')) {
    return 'active';
  }

  return 'unknown';
}

/**
 * SINGLE SOURCE OF TRUTH: Reusable account-status validation function.
 * 
 * Verifies whether a given user is allowed to access TrackBook.
 * Checks both backend API (which accesses database with service role)
 * and client-side Supabase `users` and `profiles` tables.
 * 
 * @param identifier - Object with userId and/or email
 * @returns UserAccountStatusResult with normalized status ('active' | 'blocked' | 'unknown')
 */
export async function checkUserAccountStatus(identifier: {
  userId?: string | null;
  email?: string | null;
}): Promise<UserAccountStatusResult> {
  const userId = identifier.userId?.trim();
  const email = identifier.email?.trim().toLowerCase();

  if (!userId && !email) {
    return { status: 'unknown' };
  }

  // 1. Try server-side check first (robust, bypasses client-side RLS, checks users table & banned_until)
  try {
    const res = await fetch('/api/auth/check-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, email }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && (data.status === 'blocked' || data.status === 'active')) {
        return {
          status: data.status,
          message: data.status === 'blocked' ? 'User blocked' : undefined,
          source: 'api',
          rawStatus: data.rawStatus,
        };
      }
    }
  } catch (err) {
    console.warn('[UserStatusService] Server status check fallback to direct database query:', err);
  }

  // 2. Direct client-side database query to `users` table as fallback
  if (supabase) {
    try {
      let query = supabase.from('users').select('id, email, status');

      if (userId && email) {
        query = query.or(`id.eq.${userId},email.ilike.${email}`);
      } else if (userId) {
        query = query.eq('id', userId);
      } else if (email) {
        query = query.ilike('email', email);
      }

      const { data, error } = await query.limit(5);

      if (!error && data && data.length > 0) {
        // If any matching record is blocked, the user is blocked
        for (const row of data) {
          const norm = normalizeAccountStatus(row.status);
          if (norm === 'blocked') {
            return {
              status: 'blocked',
              message: 'User blocked',
              source: 'users_table',
              rawStatus: row.status,
            };
          }
        }

        // If any record is explicitly active
        for (const row of data) {
          const norm = normalizeAccountStatus(row.status);
          if (norm === 'active') {
            return {
              status: 'active',
              source: 'users_table',
              rawStatus: row.status,
            };
          }
        }
      }
    } catch (dbErr) {
      console.warn('[UserStatusService] Direct users table query error:', dbErr);
    }

    // 3. Check profiles table as secondary source
    try {
      let profQuery = supabase.from('profiles').select('id, email, status');
      if (userId && email) {
        profQuery = profQuery.or(`id.eq.${userId},email.ilike.${email}`);
      } else if (userId) {
        profQuery = profQuery.eq('id', userId);
      } else if (email) {
        profQuery = profQuery.ilike('email', email);
      }

      const { data: profData } = await profQuery.limit(1);
      if (profData && profData.length > 0) {
        const norm = normalizeAccountStatus((profData[0] as any).status);
        if (norm === 'blocked') {
          return {
            status: 'blocked',
            message: 'User blocked',
            source: 'profiles_table',
            rawStatus: (profData[0] as any).status,
          };
        }
        if (norm === 'active') {
          return {
            status: 'active',
            source: 'profiles_table',
            rawStatus: (profData[0] as any).status,
          };
        }
      }
    } catch {
      // profiles.status might not exist in some environments, ignore gracefully
    }
  }

  // Default to active if no blocked records found
  return { status: 'active', source: 'default' };
}
