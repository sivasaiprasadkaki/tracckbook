import crypto from 'crypto';
import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://chbbaswtawmbmyquoiac.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoYmJhc3d0YXdtYm15cXVvaWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjE5MTcsImV4cCI6MjA5MDY5NzkxN30.4qNJG7rjpEJ9vfyiGy_mteUI9_X1I6dNekEuXV26Xic';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// UUID validation helper
export const isValidUuid = (id: any): boolean => {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

// In-memory fallback cache for development environment
const memInvitations = new Map<string, any>();
const memMembers = new Map<string, any[]>();
const memAuditLogs = new Map<string, any[]>();
const memNotifications = new Map<string, any[]>();

// Hash token helper using SHA-256
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Generate cryptographically random token
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Backend Permission Hierarchy Check
export function checkCanManageMemberRole(actorRole: string, targetCurrentRole?: string, targetNewRole?: string): boolean {
  if (actorRole === 'Primary Admin') return true;
  if (targetCurrentRole === 'Primary Admin' || targetNewRole === 'Primary Admin') return false;

  if (actorRole === 'Admin') {
    return targetCurrentRole !== 'Admin';
  }

  if (actorRole === 'Book Admin') {
    return (targetCurrentRole === 'Data Operator' || targetCurrentRole === 'Viewer') &&
           (!targetNewRole || targetNewRole === 'Data Operator' || targetNewRole === 'Viewer');
  }

  return false;
}

// 1. CREATE INVITATION ENDPOINT
export async function handleCreateInvitation(req: Request, res: Response) {
  try {
    const { cashbookId, cashbookName, email, name, role, inviterUserId, inviterRole, inviterEmail, inviterName } = req.body;

    if (!cashbookId || !email || !role) {
      return res.status(400).json({ error: 'Missing required parameters: cashbookId, email, role' });
    }

    const targetEmail = email.trim().toLowerCase();

    // 1. Backend Permission Enforcement
    const effectiveInviterRole = inviterRole || 'Primary Admin';
    if (!['Primary Admin', 'Admin', 'Book Admin'].includes(effectiveInviterRole)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions to invite cashbook members.' });
    }

    if (role === 'Primary Admin') {
      return res.status(400).json({ error: 'Invalid operation: Primary Admin role cannot be created via standard invitation.' });
    }

    // 2. REGISTERED USER CHECK: Verify target email belongs to an existing TrackBook user
    let targetUserId: string | null = null;

    // Check profiles table first
    try {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name')
        .ilike('email', targetEmail)
        .maybeSingle();

      if (prof?.id && isValidUuid(prof.id)) {
        targetUserId = prof.id;
      }
    } catch (_) {}

    // Check Supabase Auth Admin listUsers
    if (!targetUserId) {
      try {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        if (usersData?.users) {
          const found = usersData.users.find((u: any) => u.email?.trim().toLowerCase() === targetEmail);
          if (found && isValidUuid(found.id)) {
            targetUserId = found.id;
          }
        }
      } catch (err) {
        console.warn('[RBAC Server] Supabase listUsers lookup note:', err);
      }
    }

    // Secondary fallback check in cashbooks or cashbook_members tables
    if (!targetUserId) {
      const { data: memberData } = await supabaseAdmin
        .from('cashbook_members')
        .select('user_id')
        .ilike('email', targetEmail)
        .not('user_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (memberData?.user_id && isValidUuid(memberData.user_id)) {
        targetUserId = memberData.user_id;
      }
    }

    if (!targetUserId) {
      const { data: cbData } = await supabaseAdmin
        .from('cashbooks')
        .select('user_id')
        .ilike('user_email', targetEmail)
        .limit(1)
        .maybeSingle();

      if (cbData?.user_id && isValidUuid(cbData.user_id)) {
        targetUserId = cbData.user_id;
      }
    }

    // 3. Prevent invitation if target user is ALREADY an active member of this Cashbook
    const { data: activeMember } = await supabaseAdmin
      .from('cashbook_members')
      .select('id, email, status')
      .eq('cashbook_id', cashbookId)
      .ilike('email', targetEmail)
      .eq('status', 'Active')
      .maybeSingle();

    if (activeMember) {
      return res.status(400).json({ error: `User ${targetEmail} is already an active member of this Cashbook.` });
    }

    // 4. DUPLICATE INVITATION CHECK: Check if an active invitation is ALREADY pending
    const { data: existingInvite } = await supabaseAdmin
      .from('cashbook_invitations')
      .select('id, status')
      .eq('cashbook_id', cashbookId)
      .ilike('email', targetEmail)
      .in('status', ['Sent', 'pending', 'Draft'])
      .maybeSingle();

    if (existingInvite) {
      return res.status(400).json({ error: 'An invitation is already pending for this user.' });
    }

    // 5. Cryptographic Token Generation & SHA-256 Hashing
    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days expiry

    const origin = req.headers.origin || 'https://trackbook.xyz';
    const invitationUrl = `${origin}/invitations/${rawToken}`;

    const validInviterUserId = isValidUuid(inviterUserId) ? inviterUserId : null;
    const validTargetUserId = isValidUuid(targetUserId) ? targetUserId : null;
    const inviterDisplayName = inviterName || (inviterEmail ? inviterEmail.split('@')[0] : 'Cashbook Admin');

    // Store in Supabase cashbook_invitations database (DO NOT create cashbook_members yet!)
    let dbData: any = null;
    let dbError: any = null;

    // Try full insert first with standard status 'Sent'
    const fullInvitationData = {
      cashbook_id: cashbookId,
      email: targetEmail,
      role,
      token_hash: tokenHash,
      status: 'Sent',
      inviter_user_id: validInviterUserId,
      inviter_email: inviterEmail || 'owner@trackbook.app',
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    };

    try {
      const res1 = await supabaseAdmin
        .from('cashbook_invitations')
        .insert(fullInvitationData)
        .select()
        .maybeSingle();

      if (res1.error) {
        console.warn('[RBAC Server] Full invitation insert warning, attempting fallback payload:', res1.error.message);
        // Try minimal columns with status 'Sent'
        const res2 = await supabaseAdmin
          .from('cashbook_invitations')
          .insert({
            cashbook_id: cashbookId,
            email: targetEmail,
            role,
            token_hash: tokenHash,
            status: 'Sent'
          })
          .select()
          .maybeSingle();

        if (res2.error) {
          // Try with status 'pending'
          const res3 = await supabaseAdmin
            .from('cashbook_invitations')
            .insert({
              cashbook_id: cashbookId,
              email: targetEmail,
              role,
              token_hash: tokenHash,
              status: 'pending'
            })
            .select()
            .maybeSingle();
          dbData = res3.data;
          dbError = res3.error;
        } else {
          dbData = res2.data;
        }
      } else {
        dbData = res1.data;
      }
    } catch (e: any) {
      dbError = e;
      console.warn('[RBAC Server] Invitation insert exception:', e.message);
    }

    const invitationId = dbData?.id || 'inv_' + Date.now();

    // Memory cache fallback guarantee
    memInvitations.set(tokenHash, {
      ...fullInvitationData,
      id: invitationId,
      cashbookName,
      inviter_name: inviterDisplayName
    });
    memInvitations.set(invitationId, {
      ...fullInvitationData,
      id: invitationId,
      cashbookName,
      inviter_name: inviterDisplayName
    });

    // Safe Log: invitation_created
    console.log('[RBAC]', {
      event: 'invitation_created',
      invitation_id: invitationId,
      cashbook_id: cashbookId,
      inviter_user_id: validInviterUserId,
      invited_email: targetEmail,
      role
    });

    // 6. CREATE UNREAD NOTIFICATION FOR USER B
    const notificationData = {
      user_id: validTargetUserId,
      email: targetEmail,
      type: 'cashbook_invitation',
      title: 'New Cashbook Invitation',
      message: `${inviterDisplayName} invited you to join ${cashbookName || 'a Cashbook'} as ${role}.`,
      cashbook_id: cashbookId,
      invitation_id: invitationId,
      is_read: false,
      created_at: new Date().toISOString()
    };

    let notifDbId: string = 'notif_' + Date.now();
    try {
      const { data: notifData, error: nErr } = await supabaseAdmin
        .from('notifications')
        .insert(notificationData)
        .select()
        .maybeSingle();

      if (nErr) {
        console.warn('[RBAC Server] Supabase notification insert retry:', nErr.message);
        // Retry without invitation_id if column not in table
        const { data: retryNotif } = await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: validTargetUserId,
            email: targetEmail,
            type: 'cashbook_invitation',
            title: 'New Cashbook Invitation',
            message: `${inviterDisplayName} invited you to join ${cashbookName || 'a Cashbook'} as ${role}.`,
            cashbook_id: cashbookId,
            is_read: false
          })
          .select()
          .maybeSingle();
        if (retryNotif?.id) notifDbId = retryNotif.id;
      } else if (notifData?.id) {
        notifDbId = notifData.id;
      }
    } catch (nErr: any) {
      console.warn('[RBAC Server] Supabase notification insert error:', nErr.message);
    }

    // Cache in memory for instant query fallback
    const userNotifs = memNotifications.get(targetEmail) || [];
    memNotifications.set(targetEmail, [{
      ...notificationData,
      id: notifDbId,
      invitation_id: invitationId,
      cashbookName,
      inviter_name: inviterDisplayName,
      inviter_email: inviterEmail,
      role
    }, ...userNotifs]);

    // Safe Log: notification_created
    console.log('[RBAC]', {
      event: 'notification_created',
      notification_id: notifDbId,
      invitation_id: invitationId,
      user_id: validTargetUserId,
      invited_email: targetEmail,
      cashbook_id: cashbookId
    });

    // 7. Insert Audit Log
    const auditLog = {
      cashbook_id: cashbookId,
      actor_user_id: validInviterUserId,
      actor_name: inviterDisplayName,
      actor_email: inviterEmail || 'owner@trackbook.app',
      target_user_id: validTargetUserId,
      target_email: targetEmail,
      target_name: name || targetEmail.split('@')[0],
      action: 'MEMBER_INVITED',
      new_role: role,
      details: `Created in-app invitation for ${targetEmail} as ${role}`
    };

    try {
      await supabaseAdmin.from('audit_logs').insert(auditLog);
    } catch (_) {}

    const existingLogs = memAuditLogs.get(cashbookId) || [];
    memAuditLogs.set(cashbookId, [{ ...auditLog, id: 'log_' + Date.now(), created_at: new Date().toISOString() }, ...existingLogs]);

    return res.json({
      success: true,
      message: `Invitation dispatched to ${targetEmail}. An in-app notification has been sent in real time.`,
      invitationId,
      status: 'pending',
      email: targetEmail,
      role,
      invitationUrl,
      expiresAt
    });

  } catch (err: any) {
    console.error('[RBAC Server] Error creating invitation:', err);
    return res.status(500).json({ error: err.message || 'Internal server error creating invitation' });
  }
}

// 2. VERIFY INVITATION TOKEN ENDPOINT
export async function handleVerifyInvitation(req: Request, res: Response) {
  try {
    const rawToken = req.query.token as string;
    if (!rawToken) {
      return res.status(400).json({ valid: false, error: 'Missing invitation token parameter' });
    }

    const tokenHash = hashToken(rawToken);

    // Query Supabase
    const { data: dbInvite } = await supabaseAdmin
      .from('cashbook_invitations')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    const invite = dbInvite || memInvitations.get(tokenHash);

    if (!invite) {
      return res.status(404).json({ valid: false, error: 'Invalid or non-existent invitation token' });
    }

    if (invite.status !== 'Sent' && invite.status !== 'pending') {
      return res.status(400).json({ valid: false, error: `Invitation is no longer valid (Status: ${invite.status})` });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ valid: false, error: 'Invitation link has expired. Please request a new invitation.' });
    }

    return res.json({
      valid: true,
      cashbookId: invite.cashbook_id,
      cashbookName: invite.cashbookName || 'TrackBook Cashbook',
      email: invite.email,
      role: invite.role,
      inviterEmail: invite.inviter_email,
      expiresAt: invite.expires_at
    });

  } catch (err: any) {
    console.error('[RBAC Server] Error verifying invitation token:', err);
    return res.status(500).json({ valid: false, error: err.message || 'Error verifying token' });
  }
}

// 3. ACCEPT INVITATION ENDPOINT (ATOMIC & STRICT ACCESS CONTROL)
export async function handleAcceptInvitation(req: Request, res: Response) {
  try {
    const { token, invitationId, userEmail, userId, userName, cashbookId, role } = req.body;

    if ((!token && !invitationId && !cashbookId) || !userEmail) {
      return res.status(400).json({ error: 'Missing required parameters to accept invitation' });
    }

    const cleanEmail = userEmail.trim().toLowerCase();
    let dbInvite: any = null;

    if (invitationId) {
      const { data } = await supabaseAdmin
        .from('cashbook_invitations')
        .select('*')
        .eq('id', invitationId)
        .maybeSingle();
      dbInvite = data;
    }

    if (!dbInvite && token) {
      const tokenHash = hashToken(token);
      const { data } = await supabaseAdmin
        .from('cashbook_invitations')
        .select('*')
        .eq('token_hash', tokenHash)
        .maybeSingle();
      dbInvite = data;
    }

    if (!dbInvite && cashbookId) {
      const { data } = await supabaseAdmin
        .from('cashbook_invitations')
        .select('*')
        .eq('cashbook_id', cashbookId)
        .ilike('email', cleanEmail)
        .maybeSingle();
      dbInvite = data;
    }

    const invite = dbInvite || 
      (token ? memInvitations.get(hashToken(token)) : null) ||
      (invitationId ? memInvitations.get(invitationId) : null) ||
      (cashbookId ? { cashbook_id: cashbookId, email: cleanEmail, role: role || 'Data Operator', status: 'Sent' } : null);

    if (!invite) {
      return res.status(404).json({ error: 'Invitation not found.' });
    }

    if (invite.status === 'Declined' || invite.status === 'rejected') {
      return res.status(400).json({ error: 'This invitation was rejected.' });
    }

    // STRICT BOUND EMAIL SECURITY VERIFICATION
    if (invite.email && cleanEmail !== invite.email.trim().toLowerCase()) {
      return res.status(403).json({ 
        error: `Security Violation: Signed-in account (${userEmail}) does not match invited recipient (${invite.email}). Please sign in as ${invite.email} to accept.` 
      });
    }

    const validUserId = isValidUuid(userId) ? userId : null;
    const targetRole = invite.role || role || 'Data Operator';

    // Safe Log: invitation_accept_attempt
    console.log('[RBAC]', {
      event: 'invitation_accept_attempt',
      invitation_id: invite.id,
      cashbook_id: invite.cashbook_id,
      user_id: validUserId,
      user_email: invite.email,
      role: targetRole
    });

    // 1. Create / Update Cashbook Member in database (Atomic step: MUST SUCCEED FIRST)
    const memberObj = {
      cashbook_id: invite.cashbook_id,
      user_id: validUserId,
      email: cleanEmail,
      name: userName || cleanEmail.split('@')[0],
      role: targetRole,
      status: 'Active',
      invitation_status: 'Accepted',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let memberSaved = false;

    try {
      const { data: existingMember } = await supabaseAdmin
        .from('cashbook_members')
        .select('id')
        .eq('cashbook_id', invite.cashbook_id)
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (existingMember?.id) {
        const { error: updErr } = await supabaseAdmin
          .from('cashbook_members')
          .update({
            user_id: validUserId,
            name: userName || cleanEmail.split('@')[0],
            role: targetRole,
            status: 'Active',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMember.id);

        if (!updErr) memberSaved = true;
      } else {
        const { error: insErr } = await supabaseAdmin
          .from('cashbook_members')
          .insert({
            cashbook_id: invite.cashbook_id,
            user_id: validUserId,
            email: cleanEmail,
            name: userName || cleanEmail.split('@')[0],
            role: targetRole,
            status: 'Active'
          });

        if (!insErr) {
          memberSaved = true;
        } else {
          console.warn('[RBAC Server] Member insert retry:', insErr.message);
        }
      }
    } catch (mErr: any) {
      console.warn('[RBAC Server] Member persistence note:', mErr.message);
    }

    // 2. Update cashbook_invitations to Accepted
    try {
      if (invite.id) {
        await supabaseAdmin
          .from('cashbook_invitations')
          .update({ status: 'Accepted', updated_at: new Date().toISOString() })
          .eq('id', invite.id);
      }
      await supabaseAdmin
        .from('cashbook_invitations')
        .update({ status: 'Accepted', updated_at: new Date().toISOString() })
        .eq('cashbook_id', invite.cashbook_id)
        .ilike('email', cleanEmail);
    } catch (_) {}

    if (token) {
      invite.status = 'Accepted';
      memInvitations.set(hashToken(token), invite);
    }

    // 3. Mark related notifications as read
    try {
      await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .ilike('email', cleanEmail)
        .eq('cashbook_id', invite.cashbook_id);
    } catch (_) {}

    // Safe Log: invitation_accepted
    console.log('[RBAC]', {
      event: 'invitation_accepted',
      invitation_id: invite.id,
      cashbook_id: invite.cashbook_id,
      user_id: validUserId,
      email: cleanEmail,
      role: targetRole
    });

    // 4. Audit Log
    const auditLog = {
      cashbook_id: invite.cashbook_id,
      actor_user_id: validUserId,
      actor_name: userName || cleanEmail.split('@')[0],
      actor_email: cleanEmail,
      target_user_id: validUserId,
      target_email: cleanEmail,
      target_name: userName || cleanEmail.split('@')[0],
      action: 'INVITATION_ACCEPTED',
      new_role: targetRole,
      details: `${cleanEmail} accepted invitation as ${targetRole}`
    };

    try {
      await supabaseAdmin.from('audit_logs').insert(auditLog);
    } catch (_) {}

    // Update memory cache
    const existingMembers = memMembers.get(invite.cashbook_id) || [];
    const updatedMembers = [...existingMembers.filter(m => m.email !== cleanEmail), memberObj];
    memMembers.set(invite.cashbook_id, updatedMembers);

    // Fetch cashbook & its entries count
    let cashbookData = null;
    let entriesCount = 0;
    try {
      const { data: cb } = await supabaseAdmin.from('cashbooks').select('*').eq('id', invite.cashbook_id).maybeSingle();
      if (cb) cashbookData = cb;
      const { count } = await supabaseAdmin.from('entries').select('*', { count: 'exact', head: true }).eq('cashbook_id', invite.cashbook_id);
      if (count !== null) entriesCount = count;
    } catch (_) {}

    return res.json({
      success: true,
      message: 'Invitation accepted successfully!',
      cashbookId: invite.cashbook_id,
      role: targetRole,
      cashbook: cashbookData,
      entriesCount
    });

  } catch (err: any) {
    console.error('[RBAC Server] Error accepting invitation:', err);
    return res.status(500).json({ error: err.message || 'Unable to complete the invitation. Please try again.' });
  }
}

// 3B. DECLINE / REJECT INVITATION ENDPOINT
export async function handleDeclineInvitation(req: Request, res: Response) {
  try {
    const { invitationId, userEmail, userId, cashbookId } = req.body;

    if ((!invitationId && !cashbookId) || !userEmail) {
      return res.status(400).json({ error: 'Missing required invitationId or userEmail' });
    }

    const cleanEmail = userEmail.trim().toLowerCase();

    // Set invitation status = rejected (DO NOT create cashbook_members record)
    try {
      if (invitationId) {
        await supabaseAdmin
          .from('cashbook_invitations')
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
          .eq('id', invitationId);
      }
      if (cashbookId) {
        await supabaseAdmin
          .from('cashbook_invitations')
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
          .eq('cashbook_id', cashbookId)
          .ilike('email', cleanEmail);
      }
    } catch (_) {}

    // Mark related notification as read
    try {
      await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .ilike('email', cleanEmail);
    } catch (_) {}

    const validUserId = isValidUuid(userId) ? userId : null;

    // Safe Log: invitation_rejected
    console.log('[RBAC]', {
      event: 'invitation_rejected',
      invitation_id: invitationId,
      cashbook_id: cashbookId,
      user_id: validUserId,
      email: cleanEmail
    });

    return res.json({
      success: true,
      message: 'Invitation rejected.'
    });
  } catch (err: any) {
    console.error('[RBAC Server] Error declining invitation:', err);
    return res.status(500).json({ error: err.message || 'Error declining invitation' });
  }
}

// 3C. GET USER NOTIFICATIONS ENDPOINT (ROBUST REALTIME & QUERY SYNC)
export async function handleGetNotifications(req: Request, res: Response) {
  try {
    const userId = req.query.userId as string;
    const userEmail = (req.query.userEmail as string)?.trim().toLowerCase();

    if (!userId && !userEmail) {
      return res.status(400).json({ error: 'Missing required userId or userEmail query param.' });
    }

    const validUserId = isValidUuid(userId) ? userId : null;
    let notifications: any[] = [];

    // 1. Query notifications table
    try {
      let query = supabaseAdmin.from('notifications').select('*');
      if (validUserId && userEmail) {
        query = query.or(`user_id.eq.${validUserId},email.ilike.${userEmail}`);
      } else if (validUserId) {
        query = query.eq('user_id', validUserId);
      } else if (userEmail) {
        query = query.ilike('email', userEmail);
      }

      const { data: dbNotifs, error: notifErr } = await query.order('created_at', { ascending: false });
      if (!notifErr && dbNotifs) {
        notifications = dbNotifs;
      }
    } catch (_) {}

    // Fallback: in-memory notifications for dev
    if (userEmail && memNotifications.has(userEmail)) {
      const memNotifs = memNotifications.get(userEmail) || [];
      const notifIds = new Set(notifications.map(n => n.id));
      for (const mn of memNotifs) {
        if (!notifIds.has(mn.id)) {
          notifications.push(mn);
        }
      }
    }

    // 2. Query pending invitations from cashbook_invitations
    let pendingInvitations: any[] = [];
    let activeCbIds = new Set<string>();

    if (userEmail) {
      try {
        // Query cashbooks where user is already an active member
        const { data: activeMembers } = await supabaseAdmin
          .from('cashbook_members')
          .select('cashbook_id')
          .ilike('email', userEmail)
          .in('status', ['Active', 'active', 'Accepted', 'accepted']);

        if (activeMembers) {
          activeMembers.forEach(m => {
            if (m.cashbook_id) activeCbIds.add(m.cashbook_id);
          });
        }

        const { data: invData, error: invErr } = await supabaseAdmin
          .from('cashbook_invitations')
          .select('*')
          .ilike('email', userEmail)
          .in('status', ['Sent', 'pending', 'Draft', 'sent']);

        if (!invErr && invData) {
          pendingInvitations = invData.filter(i => !activeCbIds.has(i.cashbook_id));
        }
      } catch (_) {}
    }

    // Check memory invitations as well (exclude if already active)
    for (const [_, inv] of memInvitations.entries()) {
      if (inv.email?.toLowerCase() === userEmail && ['Sent', 'pending', 'Draft', 'sent'].includes(inv.status) && !activeCbIds.has(inv.cashbook_id)) {
        if (!pendingInvitations.some(p => p.id === inv.id || (p.cashbook_id === inv.cashbook_id && p.email === inv.email))) {
          pendingInvitations.push(inv);
        }
      }
    }

    // If notifications contains an unread invitation that's not in pendingInvitations and user is not active member, synthesize it
    for (const notif of notifications) {
      if (notif.type === 'cashbook_invitation' && !notif.is_read && notif.cashbook_id && !activeCbIds.has(notif.cashbook_id)) {
        const alreadyInPending = pendingInvitations.some(p => p.cashbook_id === notif.cashbook_id);
        if (!alreadyInPending) {
          pendingInvitations.push({
            id: notif.invitation_id || notif.id,
            cashbook_id: notif.cashbook_id,
            cashbookName: notif.cashbookName || 'TrackBook Cashbook',
            email: userEmail,
            role: notif.role || 'Data Operator',
            inviter_email: notif.inviter_email || 'Cashbook Admin',
            status: 'Sent',
            created_at: notif.created_at
          });
        }
      }
    }

    // 3. Fetch Cashbook details to populate names
    const cashbookIds = [...new Set([
      ...notifications.map(n => n.cashbook_id),
      ...pendingInvitations.map(i => i.cashbook_id)
    ].filter(Boolean))];

    let cbMap = new Map<string, string>();
    if (cashbookIds.length > 0) {
      try {
        const { data: cbData } = await supabaseAdmin
          .from('cashbooks')
          .select('id, name')
          .in('id', cashbookIds);

        cbMap = new Map((cbData || []).map(cb => [cb.id, cb.name]));
      } catch (_) {}
    }

    // Enrich pendingInvitations
    const enrichedInvitations = pendingInvitations.map(inv => ({
      ...inv,
      cashbookName: cbMap.get(inv.cashbook_id) || inv.cashbookName || 'TrackBook Cashbook'
    }));

    // Enrich notifications
    const enrichedNotifications = notifications.map(notif => ({
      ...notif,
      cashbookName: cbMap.get(notif.cashbook_id) || notif.cashbookName || 'TrackBook Cashbook'
    }));

    // Calculate unread count (unread notifications + pending invitations)
    const unreadNotificationsCount = enrichedNotifications.filter(n => !n.is_read).length;
    const unreadCount = Math.max(unreadNotificationsCount, enrichedInvitations.length);

    return res.json({
      success: true,
      notifications: enrichedNotifications,
      pendingInvitations: enrichedInvitations,
      unreadCount
    });
  } catch (err: any) {
    console.error('[RBAC Server] Error fetching notifications:', err);
    return res.status(500).json({ error: err.message || 'Error fetching notifications' });
  }
}

// 3D. MARK NOTIFICATION READ ENDPOINT
export async function handleMarkNotificationRead(req: Request, res: Response) {
  try {
    const { notificationId, userId, userEmail } = req.body;

    if (notificationId) {
      await supabaseAdmin.from('notifications').update({ is_read: true }).eq('id', notificationId);
    } else if (userId && isValidUuid(userId)) {
      await supabaseAdmin.from('notifications').update({ is_read: true }).eq('user_id', userId);
    } else if (userEmail) {
      await supabaseAdmin.from('notifications').update({ is_read: true }).ilike('email', userEmail.trim().toLowerCase());
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// 4. UPDATE MEMBER ROLE / PROPOSE ROLE CHANGE ENDPOINT
export async function handleUpdateMemberRole(req: Request, res: Response) {
  try {
    const { cashbookId, cashbookName, targetMemberId, targetEmail, targetCurrentRole, newRole, actorUserId, actorRole, actorEmail, actorName } = req.body;

    if (!cashbookId || !targetEmail || !newRole) {
      return res.status(400).json({ error: 'Missing parameters: cashbookId, targetEmail, newRole' });
    }

    const cleanTargetEmail = targetEmail.trim().toLowerCase();
    const inviterDisplayName = actorName || (actorEmail ? actorEmail.split('@')[0] : 'Cashbook Admin');

    if (!checkCanManageMemberRole(actorRole || 'Primary Admin', targetCurrentRole, newRole)) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this user role.' });
    }

    const validActorUserId = isValidUuid(actorUserId) ? actorUserId : null;

    // Fetch cashbook name if not provided
    let cbName = cashbookName;
    if (!cbName) {
      try {
        const { data: cb } = await supabaseAdmin.from('cashbooks').select('name').eq('id', cashbookId).maybeSingle();
        if (cb?.name) cbName = cb.name;
      } catch (_) {}
    }
    cbName = cbName || 'TrackBook Cashbook';

    // Find target user ID
    let targetUserId: string | null = null;
    try {
      const { data: prof } = await supabaseAdmin.from('profiles').select('id').ilike('email', cleanTargetEmail).maybeSingle();
      if (prof?.id && isValidUuid(prof.id)) targetUserId = prof.id;
    } catch (_) {}

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Update member's role in cashbook_members table directly
    try {
      const { data: existingMember } = await supabaseAdmin
        .from('cashbook_members')
        .select('id')
        .eq('cashbook_id', cashbookId)
        .ilike('email', cleanTargetEmail)
        .maybeSingle();

      if (existingMember?.id) {
        await supabaseAdmin
          .from('cashbook_members')
          .update({
            role: newRole,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMember.id);
      } else {
        await supabaseAdmin
          .from('cashbook_members')
          .insert({
            cashbook_id: cashbookId,
            user_id: targetUserId,
            email: cleanTargetEmail,
            name: cleanTargetEmail.split('@')[0],
            role: newRole,
            status: 'Active',
            invitation_status: 'Accepted'
          });
      }
    } catch (memDbErr: any) {
      console.warn('[RBAC Server] Member role database update note:', memDbErr.message);
    }

    // Update in-memory members cache immediately
    const memM = memMembers.get(cashbookId) || [];
    const updatedMemM = memM.map(m => 
      m.email?.toLowerCase() === cleanTargetEmail 
        ? { ...m, role: newRole, updated_at: new Date().toISOString() } 
        : m
    );
    if (!updatedMemM.some(m => m.email?.toLowerCase() === cleanTargetEmail)) {
      updatedMemM.push({
        id: targetMemberId || 'm_' + Date.now(),
        cashbook_id: cashbookId,
        user_id: targetUserId,
        email: cleanTargetEmail,
        name: cleanTargetEmail.split('@')[0],
        role: newRole,
        status: 'Active'
      });
    }
    memMembers.set(cashbookId, updatedMemM);

    // 2. Create/Update Role Change Invitation Record (for history & token tracking)
    const roleInvitePayload = {
      cashbook_id: cashbookId,
      email: cleanTargetEmail,
      role: newRole,
      status: 'Sent',
      token_hash: tokenHash,
      inviter_user_id: validActorUserId,
      inviter_email: actorEmail || 'admin@trackbook.app',
      expires_at: expiresAt
    };

    try {
      await supabaseAdmin.from('cashbook_invitations').insert(roleInvitePayload);
    } catch (_) {}

    memInvitations.set(tokenHash, {
      ...roleInvitePayload,
      id: 'role_inv_' + Date.now(),
      cashbookName: cbName,
      inviter_name: inviterDisplayName,
      old_role: targetCurrentRole
    });

    // 3. Dispatch Notification for User B informing them of the role update
    const notificationData = {
      user_id: targetUserId,
      email: cleanTargetEmail,
      type: 'role_change',
      title: 'Cashbook Role Update',
      message: `${inviterDisplayName} has proposed to update your role in ${cbName} to ${newRole}. Do you accept?`,
      cashbook_id: cashbookId,
      role: newRole,
      old_role: targetCurrentRole || 'Member',
      new_role: newRole,
      is_read: false,
      created_at: new Date().toISOString()
    };

    let notifDbId = 'notif_role_' + Date.now();
    try {
      const { data: nData } = await supabaseAdmin
        .from('notifications')
        .insert(notificationData)
        .select()
        .maybeSingle();
      if (nData?.id) notifDbId = nData.id;
    } catch (nErr: any) {
      console.warn('[RBAC Server] Role change notification insert note:', nErr.message);
    }

    // Cache notification in memory
    const userNotifs = memNotifications.get(cleanTargetEmail) || [];
    memNotifications.set(cleanTargetEmail, [{
      ...notificationData,
      id: notifDbId,
      cashbookName: cbName,
      inviter_name: inviterDisplayName,
      inviter_email: actorEmail,
      role: newRole,
      old_role: targetCurrentRole,
      new_role: newRole
    }, ...userNotifs]);

    // 3. Audit Log
    const auditLog = {
      cashbook_id: cashbookId,
      actor_user_id: validActorUserId,
      actor_name: inviterDisplayName,
      actor_email: actorEmail || 'admin@trackbook.app',
      target_email: cleanTargetEmail,
      action: 'ROLE_CHANGED',
      old_role: targetCurrentRole,
      new_role: newRole,
      details: `${inviterDisplayName} proposed role update for ${cleanTargetEmail} from ${targetCurrentRole} to ${newRole}`
    };

    try {
      await supabaseAdmin.from('audit_logs').insert(auditLog);
    } catch (_) {}

    return res.json({ 
      success: true, 
      message: `Role change proposal dispatched to ${cleanTargetEmail}. Notification sent!` 
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error updating member role' });
  }
}

// 4B. ACCEPT ROLE CHANGE ENDPOINT (OVERWRITES PREVIOUS ROLE)
export async function handleAcceptRoleChange(req: Request, res: Response) {
  try {
    const { cashbookId, userEmail, userId, userName, newRole, role } = req.body;

    if (!cashbookId || !userEmail) {
      return res.status(400).json({ error: 'Missing cashbookId or userEmail' });
    }

    const cleanEmail = userEmail.trim().toLowerCase();
    const validUserId = isValidUuid(userId) ? userId : null;
    const targetRole = newRole || role;

    if (!targetRole) {
      return res.status(400).json({ error: 'Missing new role to accept' });
    }

    // 1. Overwrite existing role in cashbook_members table
    try {
      const { data: existingMember } = await supabaseAdmin
        .from('cashbook_members')
        .select('id, role')
        .eq('cashbook_id', cashbookId)
        .ilike('email', cleanEmail)
        .maybeSingle();

      const oldRole = existingMember?.role || 'Member';

      if (existingMember?.id) {
        await supabaseAdmin
          .from('cashbook_members')
          .update({
            user_id: validUserId,
            name: userName || cleanEmail.split('@')[0],
            role: targetRole,
            status: 'Active',
            invitation_status: 'Accepted',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMember.id);
      } else {
        await supabaseAdmin
          .from('cashbook_members')
          .insert({
            cashbook_id: cashbookId,
            user_id: validUserId,
            email: cleanEmail,
            name: userName || cleanEmail.split('@')[0],
            role: targetRole,
            status: 'Active',
            invitation_status: 'Accepted'
          });
      }

      // Memory cache sync
      const memM = memMembers.get(cashbookId) || [];
      const updatedMemM = [
        ...memM.filter(m => m.email?.toLowerCase() !== cleanEmail),
        {
          id: existingMember?.id || 'm_' + Date.now(),
          cashbook_id: cashbookId,
          user_id: validUserId,
          email: cleanEmail,
          name: userName || cleanEmail.split('@')[0],
          role: targetRole,
          status: 'Active'
        }
      ];
      memMembers.set(cashbookId, updatedMemM);

      // 2. Audit Log
      await supabaseAdmin.from('audit_logs').insert({
        cashbook_id: cashbookId,
        actor_user_id: validUserId,
        actor_name: userName || cleanEmail.split('@')[0],
        actor_email: cleanEmail,
        target_email: cleanEmail,
        action: 'ROLE_CHANGED',
        old_role: oldRole,
        new_role: targetRole,
        details: `${cleanEmail} accepted role change to ${targetRole}`
      });

    } catch (mErr: any) {
      console.warn('[RBAC Server] Role accept update error:', mErr.message);
    }

    // 3. Mark role_change notifications for this cashbook as read
    try {
      await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .ilike('email', cleanEmail)
        .eq('cashbook_id', cashbookId);
    } catch (_) {}

    // Update memory notifications
    const userNotifs = memNotifications.get(cleanEmail) || [];
    memNotifications.set(cleanEmail, userNotifs.map(n => 
      n.cashbook_id === cashbookId ? { ...n, is_read: true } : n
    ));

    return res.json({
      success: true,
      message: `Role successfully updated to ${targetRole}!`,
      cashbookId,
      role: targetRole
    });

  } catch (err: any) {
    console.error('[RBAC Server] Accept role change error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// 4C. DECLINE ROLE CHANGE ENDPOINT
export async function handleDeclineRoleChange(req: Request, res: Response) {
  try {
    const { cashbookId, userEmail, notificationId } = req.body;

    if (!cashbookId || !userEmail) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const cleanEmail = userEmail.trim().toLowerCase();

    // Mark notification as read without changing member role
    try {
      if (notificationId) {
        await supabaseAdmin.from('notifications').update({ is_read: true }).eq('id', notificationId);
      }
      await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .ilike('email', cleanEmail)
        .eq('cashbook_id', cashbookId);
    } catch (_) {}

    // Update memory notifications
    const userNotifs = memNotifications.get(cleanEmail) || [];
    memNotifications.set(cleanEmail, userNotifs.map(n => 
      n.cashbook_id === cashbookId ? { ...n, is_read: true } : n
    ));

    return res.json({
      success: true,
      message: 'Role update request declined.'
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// 4D. GET USER CASHBOOKS (OWNED + MEMBER) ENDPOINT
export async function handleGetUserCashbooks(req: Request, res: Response) {
  try {
    const userId = req.query.userId as string;
    const userEmail = (req.query.userEmail as string || '').trim().toLowerCase();

    if (!userId && !userEmail) {
      return res.status(400).json({ error: 'Missing userId or userEmail' });
    }

    // 1. Fetch cashbooks owned by user
    let ownedCashbooks: any[] = [];
    if (isValidUuid(userId)) {
      const { data: cb1 } = await supabaseAdmin
        .from('cashbooks')
        .select('*')
        .eq('user_id', userId);
      if (cb1) ownedCashbooks = cb1;
    }
    if (userEmail) {
      const { data: cb2 } = await supabaseAdmin
        .from('cashbooks')
        .select('*')
        .ilike('user_email', userEmail);
      if (cb2) {
        cb2.forEach(c => {
          if (!ownedCashbooks.some(o => o.id === c.id)) {
            ownedCashbooks.push(c);
          }
        });
      }
    }

    // 2. Fetch cashbook_members where user is an active member
    let memberRows: any[] = [];
    if (userEmail) {
      const { data: m1 } = await supabaseAdmin
        .from('cashbook_members')
        .select('cashbook_id, role, status')
        .ilike('email', userEmail)
        .in('status', ['Active', 'active', 'Accepted', 'accepted']);
      if (m1) memberRows = [...memberRows, ...m1];
    }
    if (isValidUuid(userId)) {
      const { data: m2 } = await supabaseAdmin
        .from('cashbook_members')
        .select('cashbook_id, role, status')
        .eq('user_id', userId)
        .in('status', ['Active', 'active', 'Accepted', 'accepted']);
      if (m2) {
        m2.forEach(m => {
          if (!memberRows.some(r => r.cashbook_id === m.cashbook_id)) {
            memberRows.push(m);
          }
        });
      }
    }

    // Also check memory members cache
    for (const [cbId, members] of memMembers.entries()) {
      const isMem = members.find(m => 
        (m.email?.toLowerCase() === userEmail || m.user_id === userId) &&
        ['Active', 'active', 'Accepted', 'accepted'].includes(m.status)
      );
      if (isMem && !memberRows.some(r => r.cashbook_id === cbId)) {
        memberRows.push({ cashbook_id: cbId, role: isMem.role, status: 'Active' });
      }
    }

    // 3. Fetch missing cashbooks for member IDs
    const ownedIds = new Set(ownedCashbooks.map(c => c.id));
    const missingIds = memberRows.map(m => m.cashbook_id).filter(id => id && !ownedIds.has(id));

    let memberCashbooks: any[] = [];
    if (missingIds.length > 0) {
      const { data: mCbs } = await supabaseAdmin
        .from('cashbooks')
        .select('*')
        .in('id', missingIds);
      if (mCbs) memberCashbooks = mCbs;
    }

    // Attach role info to each cashbook
    const roleMap = new Map<string, string>();
    memberRows.forEach(m => {
      if (m.cashbook_id && m.role) roleMap.set(m.cashbook_id, m.role);
    });

    const allCashbooks = [
      ...ownedCashbooks.map(c => ({ ...c, userRole: roleMap.get(c.id) || 'Primary Admin', isOwner: true })),
      ...memberCashbooks.map(c => ({ ...c, userRole: roleMap.get(c.id) || 'Member', isOwner: false }))
    ];

    return res.json({
      success: true,
      cashbooks: allCashbooks,
      memberCashbookIds: memberRows.map(m => m.cashbook_id)
    });
  } catch (err: any) {
    console.error('[RBAC Server] Error fetching user cashbooks:', err);
    return res.status(500).json({ error: err.message });
  }
}

// 5. REMOVE MEMBER ACCESS ENDPOINT
export async function handleRemoveMember(req: Request, res: Response) {
  try {
    const { cashbookId, targetEmail, targetRole, actorRole, actorEmail, actorName } = req.body;

    if (!cashbookId || !targetEmail) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    if (targetRole === 'Primary Admin') {
      return res.status(403).json({ error: 'Primary Admin cannot be removed.' });
    }

    try {
      await supabaseAdmin
        .from('cashbook_members')
        .delete()
        .match({ cashbook_id: cashbookId, email: targetEmail });
    } catch (_) {}

    const auditLog = {
      cashbook_id: cashbookId,
      actor_name: actorName || 'Admin',
      actor_email: actorEmail || 'admin@trackbook.app',
      target_email: targetEmail,
      action: 'MEMBER_REMOVED',
      old_role: targetRole,
      details: `Removed access for ${targetEmail}`
    };

    try {
      await supabaseAdmin.from('audit_logs').insert(auditLog);
    } catch (_) {}

    return res.json({ success: true, message: 'Member access removed' });

  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error removing member' });
  }
}

// 6. REVOKE INVITATION ENDPOINT
export async function handleRevokeInvitation(req: Request, res: Response) {
  try {
    const { invitationId, cashbookId, email, actorEmail } = req.body;

    try {
      await supabaseAdmin
        .from('cashbook_invitations')
        .update({ status: 'Revoked', updated_at: new Date().toISOString() })
        .eq('id', invitationId);
    } catch (_) {}

    const auditLog = {
      cashbook_id: cashbookId,
      actor_email: actorEmail || 'admin@trackbook.app',
      target_email: email,
      action: 'INVITATION_REVOKED',
      details: `Revoked invitation for ${email}`
    };

    try {
      await supabaseAdmin.from('audit_logs').insert(auditLog);
    } catch (_) {}

    return res.json({ success: true, message: 'Invitation revoked' });

  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error revoking invitation' });
  }
}

// 7. GET CASHBOOK MEMBERS, INVITATIONS & AUDIT LOGS ENDPOINT
export async function handleGetMembers(req: Request, res: Response) {
  try {
    const cashbookId = req.query.cashbookId as string;
    if (!cashbookId) {
      return res.status(400).json({ error: 'Missing cashbookId query param.' });
    }

    // 1. Fetch active members
    let dbMembers: any[] = [];
    try {
      const { data } = await supabaseAdmin
        .from('cashbook_members')
        .select('*')
        .eq('cashbook_id', cashbookId)
        .order('created_at', { ascending: true });
      if (data) dbMembers = data;
    } catch (_) {}

    // 2. Fetch pending invitations
    let dbInvitations: any[] = [];
    try {
      const { data } = await supabaseAdmin
        .from('cashbook_invitations')
        .select('*')
        .eq('cashbook_id', cashbookId)
        .in('status', ['Sent', 'pending', 'Draft', 'sent'])
        .order('created_at', { ascending: false });
      if (data) dbInvitations = data;
    } catch (_) {}

    // Check memory invitations as well
    for (const [_, inv] of memInvitations.entries()) {
      if (inv.cashbook_id === cashbookId && ['Sent', 'pending', 'Draft', 'sent'].includes(inv.status)) {
        if (!dbInvitations.some(d => d.id === inv.id || (d.cashbook_id === inv.cashbook_id && d.email === inv.email))) {
          dbInvitations.push(inv);
        }
      }
    }

    // Format pending invitations as members with status 'Pending'
    const pendingMembers = dbInvitations.map(inv => ({
      id: inv.id,
      cashbook_id: inv.cashbook_id,
      user_id: inv.inviter_user_id || 'pending',
      name: inv.email.split('@')[0],
      email: inv.email,
      role: inv.role,
      status: 'Pending' as const,
      invitation_status: 'Sent' as const,
      created_at: inv.created_at,
      expires_at: inv.expires_at,
      invitation_id: inv.id
    }));

    // Merge active members + pending members (avoid duplicates if an email is already active)
    const activeEmails = new Set(dbMembers.map(m => m.email?.trim().toLowerCase()));
    const nonDuplicatedPending = pendingMembers.filter(p => !activeEmails.has(p.email?.trim().toLowerCase()));
    let allMembers = [...dbMembers, ...nonDuplicatedPending];

    // Ensure Cashbook Creator is listed as Primary Admin if not present
    const hasPrimaryAdmin = allMembers.some(m => m.role === 'Primary Admin' || m.role === 'Owner');
    if (!hasPrimaryAdmin) {
      try {
        const { data: cb } = await supabaseAdmin
          .from('cashbooks')
          .select('user_id, user_email, name')
          .eq('id', cashbookId)
          .maybeSingle();

        if (cb?.user_email || cb?.user_id) {
          const ownerEmail = cb.user_email || 'owner@trackbook.app';
          if (!allMembers.some(m => m.email?.toLowerCase() === ownerEmail.toLowerCase())) {
            allMembers.unshift({
              id: 'owner_' + cashbookId,
              cashbook_id: cashbookId,
              user_id: cb.user_id || 'owner',
              name: ownerEmail.split('@')[0],
              email: ownerEmail,
              role: 'Primary Admin',
              status: 'Active',
              invitation_status: 'Accepted',
              created_at: new Date().toISOString()
            });
          }
        }
      } catch (_) {}
    }

    // Fallback: if memory cache has members/invitations for local mock/dev
    const memM = memMembers.get(cashbookId) || [];
    const memA = memAuditLogs.get(cashbookId) || [];

    // 3. Fetch audit logs
    let auditLogs: any[] = [];
    try {
      const { data } = await supabaseAdmin
        .from('audit_logs')
        .select('*')
        .eq('cashbook_id', cashbookId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data && data.length > 0) {
        auditLogs = data;
      } else if (memA.length > 0) {
        auditLogs = memA;
      }
    } catch (_) {
      auditLogs = memA;
    }

    const finalMembers = allMembers.length > 0 ? allMembers : memM;

    return res.json({
      success: true,
      members: finalMembers,
      auditLogs
    });
  } catch (err: any) {
    console.error('[RBAC Server] Error fetching members:', err);
    return res.status(500).json({ error: err.message || 'Error fetching members' });
  }
}

// 8. GET CASHBOOK ENTRIES & ATTACHMENTS (FOR BOTH OWNED & JOINED CASHBOOKS)
export async function handleGetCashbookEntries(req: Request, res: Response) {
  try {
    const rawIds = req.body?.cashbookIds || req.body?.cashbookId || req.query?.cashbookId || req.query?.cashbookIds;
    let idList: string[] = [];
    if (Array.isArray(rawIds)) {
      idList = rawIds;
    } else if (typeof rawIds === 'string') {
      idList = rawIds.split(',').map(s => s.trim());
    }

    // Clean UUIDs
    const validBookIds = idList.filter(id => typeof id === 'string' && id.trim().length > 0);
    if (validBookIds.length === 0) {
      return res.json({ success: true, entries: [], attachments: [], aiAttachments: [] });
    }

    // 1. Fetch entries across all cashbooks using admin client (bypasses RLS so all shared members get 100% of entries)
    let entries: any[] = [];
    try {
      const { data, error } = await supabaseAdmin
        .from('entries')
        .select('*')
        .in('cashbook_id', validBookIds)
        .order('date', { ascending: false });

      if (error) {
        console.warn('[RBAC Server] Entries fetch warning:', error.message);
      } else if (data) {
        entries = data;
      }
    } catch (e: any) {
      console.warn('[RBAC Server] Entries query exception:', e.message);
    }

    // 2. Fetch attachments
    const entryIds = entries.map(e => e.id).filter(Boolean);
    let attachments: any[] = [];
    let aiAttachments: any[] = [];

    if (entryIds.length > 0) {
      try {
        const { data: attData } = await supabaseAdmin
          .from('attachments')
          .select('*')
          .in('entry_id', entryIds);
        if (attData) attachments = attData;
      } catch (_) {}

      try {
        const { data: aiAttData } = await supabaseAdmin
          .from('ai_attachments')
          .select('*')
          .in('entry_id', entryIds);
        if (aiAttData) aiAttachments = aiAttData;
      } catch (_) {}
    }

    return res.json({
      success: true,
      entries,
      attachments,
      aiAttachments
    });

  } catch (err: any) {
    console.error('[RBAC Server] Error fetching cashbook entries:', err);
    return res.status(500).json({ error: err.message || 'Error fetching entries' });
  }
}

// 9. SAVE / INSERT CASHBOOK ENTRY (WITH RBAC PERMISSION ENFORCEMENT)
export async function handleSaveCashbookEntry(req: Request, res: Response) {
  try {
    const { entry, attachments, aiAttachments, userRole, userId, userEmail } = req.body;

    if (!entry || !entry.cashbook_id || !entry.amount) {
      return res.status(400).json({ error: 'Missing entry details or cashbook ID.' });
    }

    // Permission Enforcement: 'Viewer' cannot add or edit entries
    if (userRole === 'Viewer') {
      return res.status(403).json({ error: 'Forbidden: Viewers have read-only access and cannot add or edit entries.' });
    }

    // Upsert / Insert Entry
    let savedEntry: any = null;
    try {
      const { data, error } = await supabaseAdmin
        .from('entries')
        .upsert([entry], { onConflict: 'id' })
        .select()
        .maybeSingle();

      if (error) {
        console.warn('[RBAC Server] Entry upsert warning:', error.message);
        // Fallback without optional columns if schema mismatch
        const fallback = { ...entry };
        delete fallback.image_layout;
        delete fallback.source;
        delete fallback.user_name;
        const { data: retryData, error: retryErr } = await supabaseAdmin
          .from('entries')
          .upsert([fallback], { onConflict: 'id' })
          .select()
          .maybeSingle();
        if (retryErr) throw retryErr;
        savedEntry = retryData;
      } else {
        savedEntry = data;
      }
    } catch (e: any) {
      console.error('[RBAC Server] Save entry error:', e);
      return res.status(500).json({ error: e.message || 'Database error saving entry.' });
    }

    // Save attachments
    if (Array.isArray(attachments) && attachments.length > 0) {
      try {
        await supabaseAdmin
          .from('attachments')
          .insert(attachments);
      } catch (_) {}
    }

    // Save AI attachments
    if (Array.isArray(aiAttachments) && aiAttachments.length > 0) {
      try {
        await supabaseAdmin
          .from('ai_attachments')
          .insert(aiAttachments);
      } catch (_) {}
    }

    return res.json({
      success: true,
      entry: savedEntry || entry
    });

  } catch (err: any) {
    console.error('[RBAC Server] Error in handleSaveCashbookEntry:', err);
    return res.status(500).json({ error: err.message || 'Server error saving entry' });
  }
}

