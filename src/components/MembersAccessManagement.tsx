import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Trash2, 
  Check, 
  CheckCircle2,
  Copy,
  X, 
  Search, 
  ShieldAlert, 
  Info, 
  History, 
  ArrowRight,
  Mail,
  Send,
  Eye,
  RefreshCw,
  AlertTriangle,
  UserX,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, vibrate, safeParseResponse } from '../lib/utils';
import { 
  Role, 
  ALL_ROLES, 
  ROLE_DEFINITIONS, 
  CashbookMember, 
  AuditLogItem, 
  canManageRoles,
  InvitationStatus
} from '../lib/rbac';
import { supabase } from '../lib/supabase';
import RolesPermissionsModal from './RolesPermissionsModal';
import { InAppSelect } from './InAppSelect';
import { InAppDialog, DialogOptions } from './InAppDialog';

interface MembersAccessManagementProps {
  cashbookId: string;
  cashbookName: string;
  theme: 'light' | 'dark';
  currentUserRole?: Role;
  currentUserId?: string;
  currentUserName?: string;
  currentUserEmail?: string;
  initialAddMode?: boolean;
  onMembersChange?: (members: CashbookMember[]) => void;
}

export default function MembersAccessManagement({
  cashbookId,
  cashbookName,
  theme,
  currentUserRole = 'Primary Admin',
  currentUserId = 'user-primary',
  currentUserName = 'Current User',
  currentUserEmail = 'user@trackbook.app',
  initialAddMode = false,
  onMembersChange
}: MembersAccessManagementProps) {

  // Load members from local storage or initialize ONLY with current real user as Primary Admin
  const [members, setMembers] = useState<CashbookMember[]>(() => {
    const saved = localStorage.getItem(`trackbook_members_${cashbookId}`);
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (_) {}
    }
    // Default: ONLY real active logged in user as Primary Admin, no fake mock users!
    return [
      { 
        id: `m_primary_${cashbookId}`, 
        cashbook_id: cashbookId, 
        user_id: currentUserId, 
        name: currentUserName || 'Cashbook Owner', 
        email: currentUserEmail || 'owner@trackbook.app', 
        role: 'Primary Admin', 
        status: 'Active', 
        invitation_status: 'Accepted',
        created_at: new Date().toISOString() 
      }
    ];
  });

  // Audit logs state (starts empty or loaded from local storage)
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(() => {
    const saved = localStorage.getItem(`trackbook_audit_logs_${cashbookId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (_) {}
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState<'members' | 'audit'>('members');
  const [searchQuery, setSearchQuery] = useState('');
  const [inAppDialog, setInAppDialog] = useState<DialogOptions | null>(null);
  
  // Real-time server sync function
  const loadMembersData = async () => {
    if (!cashbookId) return;
    try {
      const res = await fetch(`/api/rbac/members?cashbookId=${encodeURIComponent(cashbookId)}`);
      const parsed = await safeParseResponse(res);
      if (parsed.ok && parsed.data && parsed.data.success && Array.isArray(parsed.data.members)) {
        let serverMembers: CashbookMember[] = parsed.data.members;
        if (serverMembers.length === 0) {
          serverMembers = [
            {
              id: `m_primary_${cashbookId}`,
              cashbook_id: cashbookId,
              user_id: currentUserId,
              name: currentUserName || 'Cashbook Owner',
              email: currentUserEmail || 'owner@trackbook.app',
              role: 'Primary Admin',
              status: 'Active',
              invitation_status: 'Accepted',
              created_at: new Date().toISOString()
            }
          ];
        }
        setMembers(serverMembers);
        localStorage.setItem(`trackbook_members_${cashbookId}`, JSON.stringify(serverMembers));
        if (onMembersChange) onMembersChange(serverMembers);
        if (Array.isArray(parsed.data.auditLogs)) {
          setAuditLogs(parsed.data.auditLogs);
          localStorage.setItem(`trackbook_audit_logs_${cashbookId}`, JSON.stringify(parsed.data.auditLogs));
        }
      }
    } catch (err) {
      console.warn('[MembersAccessManagement] Load error:', err);
    }
  };

  useEffect(() => {
    loadMembersData();

    // Supabase Realtime Channel
    let channel: any = null;
    if (supabase && cashbookId) {
      try {
        channel = supabase
          .channel(`cb_members_${cashbookId}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'cashbook_members',
            filter: `cashbook_id=eq.${cashbookId}`
          }, () => {
            loadMembersData();
          })
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'cashbook_invitations',
            filter: `cashbook_id=eq.${cashbookId}`
          }, () => {
            loadMembersData();
          })
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'audit_logs',
            filter: `cashbook_id=eq.${cashbookId}`
          }, () => {
            loadMembersData();
          })
          .subscribe();
      } catch (e) {
        console.warn('[MembersAccessManagement] Realtime subscription note:', e);
      }
    }

    const interval = setInterval(loadMembersData, 8000);

    return () => {
      clearInterval(interval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [cashbookId]);
  
  // Roles & Permissions Reference Modal State
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [rolesModalRole, setRolesModalRole] = useState<Role>('Primary Admin');

  // Role Change Confirmation Modal State
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    member: CashbookMember;
    newRole: Role;
  } | null>(null);

  // Remove Member Confirmation Modal State
  const [memberToRemove, setMemberToRemove] = useState<CashbookMember | null>(null);

  // Invite Member Wizard State
  const [showInviteModal, setShowInviteModal] = useState(initialAddMode);
  const [inviteStep, setInviteStep] = useState<1 | 2 | 3 | 4>(1);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('Data Operator');
  const [inviteStatus, setInviteStatus] = useState<InvitationStatus>('Draft');
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [recentInviteMember, setRecentInviteMember] = useState<CashbookMember | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (initialAddMode) {
      setShowInviteModal(true);
      setInviteStep(1);
    }
  }, [initialAddMode]);

  // Save members & audit logs to local storage
  const updateMembersState = (newMembers: CashbookMember[]) => {
    setMembers(newMembers);
    localStorage.setItem(`trackbook_members_${cashbookId}`, JSON.stringify(newMembers));
    if (onMembersChange) onMembersChange(newMembers);
  };

  const addAuditLog = (item: Omit<AuditLogItem, 'id' | 'cashbook_id' | 'created_at'>) => {
    const newItem: AuditLogItem = {
      ...item,
      id: 'log_' + Date.now(),
      cashbook_id: cashbookId,
      created_at: new Date().toISOString()
    };
    const updated = [newItem, ...auditLogs];
    setAuditLogs(updated);
    localStorage.setItem(`trackbook_audit_logs_${cashbookId}`, JSON.stringify(updated));
  };

  // Execute Role Change
  const confirmRoleChange = async () => {
    if (!pendingRoleChange) return;
    vibrate(15);
    const { member, newRole } = pendingRoleChange;

    // 1. Optimistic state update
    const updated = members.map(m => 
      (m.email?.toLowerCase() === member.email?.toLowerCase() || m.id === member.id)
        ? { ...m, role: newRole }
        : m
    );
    updateMembersState(updated);

    try {
      await fetch('/api/rbac/role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashbookId,
          cashbookName: cashbookName || 'TrackBook Cashbook',
          targetMemberId: member.id,
          targetEmail: member.email,
          targetCurrentRole: member.role,
          newRole,
          actorUserId: currentUserId,
          actorRole: currentUserRole,
          actorEmail: currentUserEmail,
          actorName: currentUserName
        })
      }).catch(() => {});
    } catch (_) {}

    await loadMembersData();

    // Broadcast update so other components / target users sync
    try {
      window.dispatchEvent(new CustomEvent('cashbook_updated'));
      window.dispatchEvent(new CustomEvent('trackbook_refresh_cashbooks'));
    } catch (_) {}

    addAuditLog({
      actor_user_id: currentUserId,
      actor_name: currentUserName,
      actor_email: currentUserEmail,
      target_user_id: member.user_id,
      target_name: member.name,
      target_email: member.email,
      action: 'ROLE_CHANGED',
      old_role: member.role,
      new_role: newRole,
      details: `Role updated for ${member.name} (${member.email}) from ${member.role} to ${newRole}`
    });

    setPendingRoleChange(null);
  };

  // Confirm Remove Member Access
  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    vibrate(15);

    if (memberToRemove.role === 'Primary Admin') {
      setInAppDialog({
        title: "Access Restricted",
        message: "Primary Admin cannot be removed.",
        type: "warning"
      });
      setMemberToRemove(null);
      return;
    }

    try {
      await fetch('/api/rbac/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashbookId,
          targetEmail: memberToRemove.email,
          targetRole: memberToRemove.role,
          actorUserId: currentUserId,
          actorRole: currentUserRole,
          actorEmail: currentUserEmail,
          actorName: currentUserName
        })
      }).catch(() => {});
    } catch (_) {}

    await loadMembersData();

    addAuditLog({
      actor_user_id: currentUserId,
      actor_name: currentUserName,
      actor_email: currentUserEmail,
      target_user_id: memberToRemove.user_id,
      target_name: memberToRemove.name,
      target_email: memberToRemove.email,
      action: 'MEMBER_REMOVED',
      old_role: memberToRemove.role,
      details: `Removed access for ${memberToRemove.name} (${memberToRemove.email})`
    });

    setMemberToRemove(null);
  };

  // Submit Send Invitation (Phase 2 Backend Integration)
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    vibrate(15);
    if (!inviteEmail.trim()) return;

    setIsSubmittingInvite(true);
    setInviteError(null);

    const targetEmail = inviteEmail.trim().toLowerCase();
    const name = inviteName.trim() || targetEmail.split('@')[0];

    const payload = {
      cashbookId,
      cashbookName: cashbookName || 'TrackBook Cashbook',
      email: targetEmail,
      recipientEmail: targetEmail,
      name,
      recipientName: name,
      role: inviteRole,
      inviterUserId: currentUserId,
      inviterRole: currentUserRole,
      inviterEmail: currentUserEmail,
      inviterName: currentUserName
    };

    let resData: any = null;
    let errorMsg: string | null = null;

    try {
      // 1. Try Supabase Edge Function invocation if available
      if (supabase?.functions) {
        try {
          const edgeResult = await supabase.functions.invoke('send-cashbook-invitation', {
            body: payload
          });
          if (edgeResult.data && edgeResult.data.success) {
            resData = edgeResult.data;
          } else if (edgeResult.error) {
            console.warn('[MembersAccessManagement] Edge function returned note:', edgeResult.error);
            if ((edgeResult.error as any).context) {
              const parsed = await safeParseResponse((edgeResult.error as any).context);
              if (parsed.data?.error) errorMsg = parsed.data.error;
              else if (parsed.data?.message) errorMsg = parsed.data.message;
            } else if (edgeResult.error.message) {
              errorMsg = edgeResult.error.message;
            }
          }
        } catch (edgeErr: any) {
          console.warn('[MembersAccessManagement] Edge function invoke error:', edgeErr);
        }
      }

      // 2. Fall back to local Express /api/rbac/invite endpoint
      if (!resData) {
        try {
          const response = await fetch('/api/rbac/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const parsed = await safeParseResponse(response);

          if (parsed.data && parsed.data.success) {
            resData = parsed.data;
          } else {
            if (parsed.data && (parsed.data.error || parsed.data.message)) {
              errorMsg = parsed.data.error || parsed.data.message;
            } else if (!parsed.isJson) {
              console.error('[MembersAccessManagement] Non-JSON response received:', parsed.status, parsed.rawText);
              errorMsg = errorMsg || 'Invitation service returned an invalid response. Please try again.';
            } else if (parsed.error) {
              errorMsg = parsed.error;
            }
          }
        } catch (fetchErr: any) {
          console.warn('[MembersAccessManagement] Backend API invite endpoint error:', fetchErr);
          errorMsg = errorMsg || fetchErr.message;
        }
      }

      // 3. Fall back to direct Supabase database operation if both server endpoints are offline
      if (!resData && supabase) {
        try {
          // Check if already active member
          const { data: activeMember } = await supabase
            .from('cashbook_members')
            .select('id, email, status')
            .eq('cashbook_id', cashbookId)
            .ilike('email', targetEmail)
            .eq('status', 'Active')
            .maybeSingle();

          if (activeMember) {
            throw new Error(`User ${targetEmail} is already an active member of this Cashbook.`);
          }

          // Check if already pending invitation
          const { data: existingInvite } = await supabase
            .from('cashbook_invitations')
            .select('id, status')
            .eq('cashbook_id', cashbookId)
            .ilike('email', targetEmail)
            .in('status', ['Sent', 'pending', 'Draft'])
            .maybeSingle();

          if (existingInvite) {
            throw new Error('An invitation is already pending for this user.');
          }

          // Generate client token
          const rawToken = Array.from(window.crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          const tokenUint8 = new TextEncoder().encode(rawToken);
          const hashBuf = await window.crypto.subtle.digest('SHA-256', tokenUint8);
          const tokenHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

          // Look up user profile ID
          let targetUserId: string | null = null;
          const { data: prof } = await supabase
            .from('profiles')
            .select('id, email')
            .ilike('email', targetEmail)
            .maybeSingle();
          if (prof?.id) targetUserId = prof.id;

          const { data: invRow, error: invErr } = await supabase
            .from('cashbook_invitations')
            .insert({
              cashbook_id: cashbookId,
              email: targetEmail,
              role: inviteRole,
              token_hash: tokenHash,
              status: 'Sent',
              inviter_user_id: currentUserId || null,
              inviter_email: currentUserEmail || 'owner@trackbook.app',
              expires_at: expiresAt
            })
            .select()
            .maybeSingle();

          if (invErr) throw invErr;

          const invId = invRow?.id || 'inv_' + Date.now();

          // Dispatch notification to User B
          const notifPayload = {
            user_id: targetUserId || currentUserId,
            email: targetEmail,
            type: 'cashbook_invitation',
            title: 'New Cashbook Invitation',
            message: `${currentUserName || currentUserEmail || 'Admin'} invited you to join ${cashbookName || 'Cashbook'} as ${inviteRole}.`,
            cashbook_id: cashbookId,
            invitation_id: invId,
            is_read: false
          };

          const { data: notifRow } = await supabase
            .from('notifications')
            .insert(notifPayload)
            .select()
            .maybeSingle();

          resData = {
            success: true,
            invitation_id: invId,
            invitationId: invId,
            notification_id: notifRow?.id || 'notif_' + Date.now(),
            notificationId: notifRow?.id || 'notif_' + Date.now(),
            token: rawToken,
            invitationUrl: `${window.location.origin}/accept-invite?token=${rawToken}`,
            status: 'pending',
            message: 'Invitation sent successfully.'
          };
        } catch (directErr: any) {
          console.warn('[MembersAccessManagement] Direct Supabase fallback note:', directErr);
          if (!errorMsg) errorMsg = directErr.message;
        }
      }

      if (!resData || !resData.success) {
        throw new Error(errorMsg || 'Failed to dispatch member invitation. Please check the email and try again.');
      }

      const newMember: CashbookMember = {
        id: resData.invitation_id || resData.invitationId || 'm_' + Date.now(),
        cashbook_id: cashbookId,
        user_id: 'u_' + Date.now(),
        name,
        email: targetEmail,
        role: inviteRole,
        status: 'Pending',
        invitation_status: 'Sent',
        created_at: new Date().toISOString()
      };

      const updated = [...members.filter(m => m.email.toLowerCase() !== targetEmail), newMember];
      updateMembersState(updated);
      await loadMembersData();

      addAuditLog({
        actor_user_id: currentUserId,
        actor_name: currentUserName,
        actor_email: currentUserEmail,
        target_user_id: newMember.user_id,
        target_name: newMember.name,
        target_email: newMember.email,
        action: 'MEMBER_INVITED',
        new_role: inviteRole,
        details: `Dispatched secure invitation for ${newMember.email} as ${inviteRole}`
      });

      setRecentInviteMember(newMember);
      setGeneratedInviteUrl(resData.invitationUrl || (resData.token ? `${window.location.origin}/accept-invite?token=${resData.token}` : `${window.location.origin}/accept-invite`));
      setShowEmailPreview(true);

    } catch (err: any) {
      console.error('[MembersAccessManagement] Invitation dispatch error:', err);
      setInviteError(err.message || 'An error occurred while sending invitation.');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const closeInviteWizard = () => {
    setShowInviteModal(false);
    setShowEmailPreview(false);
    setInviteStep(1);
    setInviteEmail('');
    setInviteName('');
    setInviteRole('Data Operator');
    setRecentInviteMember(null);
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const nonPrimaryMembersCount = members.filter(m => m.role !== 'Primary Admin').length;

  return (
    <div className={cn(
      "p-4 sm:p-6 rounded-2xl border shadow-sm space-y-5 transition-colors duration-200",
      theme === 'dark' ? "bg-zinc-950 border-zinc-900 text-white" : "bg-white border-zinc-200 text-zinc-900"
    )}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-zinc-150 dark:border-zinc-850">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Users size={18} />
            </div>
            <h2 className={cn("text-base sm:text-lg font-bold tracking-tight", theme === 'dark' ? "text-zinc-100" : "text-zinc-900")}>
              Members & Access
            </h2>
            <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              RBAC
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-1">
            Manage team members and role permissions for <span className="font-bold text-emerald-600 dark:text-emerald-400">{cashbookName}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              vibrate(10);
              setRolesModalRole('Primary Admin');
              setShowRolesModal(true);
            }}
            className={cn(
              "flex-1 sm:flex-none px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs",
              theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white" : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:text-black"
            )}
          >
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            <span>Roles & Permissions</span>
          </button>

          <button
            onClick={() => {
              vibrate(10);
              setShowInviteModal(true);
              setShowEmailPreview(false);
              setInviteStep(1);
            }}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95 duration-150"
          >
            <UserPlus size={14} className="shrink-0" />
            <span>+ Add Member</span>
          </button>
        </div>
      </div>

      {/* Search & Members Count Row */}
      {members.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5",
              theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-300" : "bg-zinc-100/80 border-zinc-200 text-zinc-700"
            )}>
              <Users size={13} className="text-emerald-500" />
              <span>{members.length} {members.length === 1 ? 'Member' : 'Members'}</span>
            </span>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
            <input 
              type="text" 
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all",
                theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500" : "bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400"
              )}
            />
          </div>
        </div>
      )}

      {/* MEMBERS VIEW */}
      <div className="space-y-4">
        {filteredMembers.length === 0 ? (
          <div className={cn(
            "p-8 sm:p-12 text-center rounded-2xl border border-dashed flex flex-col items-center justify-center space-y-3",
            theme === 'dark' ? "border-zinc-800 bg-zinc-900/20" : "border-zinc-200 bg-zinc-50/50"
          )}>
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
              <Users size={22} />
            </div>
            <div>
              <p className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                No members found
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 max-w-sm mx-auto">
                {searchQuery ? "No members match your search criteria." : "Collaborate securely with team members by assigning custom roles and granular permission access."}
              </p>
            </div>
            {!searchQuery && (
              <button
                onClick={() => {
                  vibrate(10);
                  setShowInviteModal(true);
                  setShowEmailPreview(false);
                  setInviteStep(1);
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <UserPlus size={14} />
                <span>+ Add Member</span>
              </button>
            )}
          </div>
        ) : (
            <>
              {/* MOBILE CARDS VIEW (Only for mobile screens) */}
              <div className="block md:hidden space-y-3">
                {filteredMembers.map((member) => {
                  const roleDef = ROLE_DEFINITIONS[member.role];
                  const canChangeThisMemberRole = canManageRoles(currentUserRole, member.role);
                  const isPrimaryAdmin = member.role === 'Primary Admin';

                  return (
                    <div 
                      key={member.id}
                      className={cn(
                        "p-4 rounded-2xl border transition-all space-y-3 shadow-xs",
                        theme === 'dark' ? "bg-zinc-900/70 border-zinc-800" : "bg-white border-zinc-200/90"
                      )}
                    >
                      {/* Card Header: Avatar, Name & Role Badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-extrabold text-sm shrink-0 shadow-2xs">
                            {member.name ? member.name[0].toUpperCase() : 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className={cn("font-bold text-sm truncate", theme === 'dark' ? "text-zinc-100" : "text-zinc-900")}>
                                {member.name}
                              </h4>
                              {isPrimaryAdmin && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold uppercase tracking-wider border border-emerald-500/25 shrink-0">
                                  Owner
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                              <Mail size={12} className="text-zinc-400 shrink-0" />
                              <span className="truncate">{member.email}</span>
                            </div>
                          </div>
                        </div>

                        <span className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold border shrink-0",
                          roleDef.badgeBg,
                          roleDef.badgeText,
                          roleDef.badgeBorder
                        )}>
                          <ShieldCheck size={11} className="shrink-0" />
                          {member.role}
                        </span>
                      </div>

                      {/* Card Footer: Status Badge & Action Buttons */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-zinc-150 dark:border-zinc-800/80 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider",
                            member.status === 'Active'
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          )}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", member.status === 'Active' ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
                            {member.status}
                          </span>

                          {member.invitation_status && member.invitation_status !== 'Accepted' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
                              {member.invitation_status}
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5">
                          {canChangeThisMemberRole && !isPrimaryAdmin && (
                            <button
                              onClick={() => {
                                vibrate(10);
                                const targetRole: Role = member.role === 'Data Operator' ? 'Book Admin' : 'Data Operator';
                                setPendingRoleChange({ member, newRole: targetRole });
                              }}
                              className={cn(
                                "px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95",
                                theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white" : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                              )}
                            >
                              <RefreshCw size={11} className="text-zinc-400" />
                              <span>Role</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              vibrate(10);
                              setRolesModalRole(member.role);
                              setShowRolesModal(true);
                            }}
                            className={cn(
                              "p-1.5 rounded-lg border transition-all cursor-pointer text-zinc-400 hover:text-emerald-500 active:scale-95",
                              theme === 'dark' ? "border-zinc-800 bg-zinc-900 hover:bg-zinc-850" : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
                            )}
                            title="View Role Permissions"
                          >
                            <Info size={13} />
                          </button>

                          {!isPrimaryAdmin && (
                            <button
                              onClick={() => {
                                vibrate(10);
                                setMemberToRemove(member);
                              }}
                              className="p-1.5 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                              title="Remove Member Access"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE VIEW */}
              <div className="hidden md:block overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-850 shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={cn(
                      "text-[10px] uppercase font-bold tracking-wider border-b",
                      theme === 'dark' ? "bg-zinc-900/60 border-zinc-800 text-zinc-400" : "bg-zinc-50 border-zinc-200 text-zinc-600"
                    )}>
                      <th className="py-3.5 px-4">Member Name</th>
                      <th className="py-3.5 px-4">Email Address</th>
                      <th className="py-3.5 px-4">Assigned Role</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-150 dark:divide-zinc-850">
                    {filteredMembers.map((member) => {
                      const roleDef = ROLE_DEFINITIONS[member.role];
                      const canChangeThisMemberRole = canManageRoles(currentUserRole, member.role);

                      return (
                        <tr 
                          key={member.id}
                          className={cn(
                            "text-xs transition-colors duration-150",
                            theme === 'dark' ? "hover:bg-zinc-900/40" : "hover:bg-zinc-50/80"
                          )}
                        >
                          {/* Name */}
                          <td className="py-3.5 px-4 font-bold">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-extrabold text-xs">
                                {member.name ? member.name[0].toUpperCase() : 'U'}
                              </div>
                              <div>
                                <p className={cn("font-bold", theme === 'dark' ? "text-zinc-100" : "text-zinc-900")}>
                                  {member.name}
                                </p>
                                {member.role === 'Primary Admin' && (
                                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-extrabold uppercase tracking-wider">
                                    Primary Owner
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="py-3.5 px-4 font-medium text-zinc-500 dark:text-zinc-400">
                            <div className="flex items-center gap-1.5">
                              <Mail size={13} className="text-zinc-400" />
                              <span>{member.email}</span>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3.5 px-4">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold border",
                              roleDef.badgeBg,
                              roleDef.badgeText,
                              roleDef.badgeBorder
                            )}>
                              <ShieldCheck size={12} />
                              {member.role}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider",
                                member.status === 'Active'
                                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                              )}>
                                <span className={cn("w-1.5 h-1.5 rounded-full", member.status === 'Active' ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
                                {member.status}
                              </span>

                              {member.invitation_status && member.invitation_status !== 'Accepted' && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
                                  {member.invitation_status}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Change Role Action Button */}
                              {canChangeThisMemberRole && member.role !== 'Primary Admin' && (
                                <button
                                  onClick={() => {
                                    vibrate(10);
                                    const targetRole: Role = member.role === 'Data Operator' ? 'Book Admin' : 'Data Operator';
                                    setPendingRoleChange({ member, newRole: targetRole });
                                  }}
                                  className={cn(
                                    "px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1",
                                    theme === 'dark' ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white" : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                                  )}
                                >
                                  <RefreshCw size={11} className="text-zinc-400" />
                                  <span>Change Role</span>
                                </button>
                              )}

                              {/* View Permissions Reference */}
                              <button
                                onClick={() => {
                                  vibrate(10);
                                  setRolesModalRole(member.role);
                                  setShowRolesModal(true);
                                }}
                                className={cn(
                                  "p-1.5 rounded-lg border transition-all cursor-pointer text-zinc-400 hover:text-emerald-500",
                                  theme === 'dark' ? "border-zinc-800 hover:bg-zinc-900" : "border-zinc-200 hover:bg-zinc-100"
                                )}
                                title="View Role Permissions"
                              >
                                <Info size={14} />
                              </button>

                              {/* Remove Member Access Button */}
                              {member.role !== 'Primary Admin' && (
                                <button
                                  onClick={() => {
                                    vibrate(10);
                                    setMemberToRemove(member);
                                  }}
                                  className="px-2.5 py-1 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                  title="Remove Member Access"
                                >
                                  <Trash2 size={13} />
                                  <span>Remove Access</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
      </div>

      {/* ROLE CHANGE MODAL */}
      <AnimatePresence>
        {pendingRoleChange && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setPendingRoleChange(null)}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className={cn(
                "relative w-full max-w-lg rounded-xl border shadow-2xl p-6 z-10 space-y-5 overflow-hidden",
                theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <div className="flex items-center gap-3 border-b pb-4 border-zinc-150 dark:border-zinc-850">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold">Change Role</h3>
                  <p className="text-xs text-zinc-400">
                    Update access role for <strong className="text-zinc-200">{pendingRoleChange.member.name}</strong>
                  </p>
                </div>
              </div>

              {/* Role Transition Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className={cn("p-3 rounded-xl border space-y-1", theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200")}>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Current Role</p>
                  <p className="text-sm font-extrabold text-amber-500">{pendingRoleChange.member.role}</p>
                </div>

                <div className={cn("p-3 rounded-xl border space-y-1", theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200")}>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">New Role</p>
                  <InAppSelect
                    id="member-new-role-select"
                    value={pendingRoleChange.newRole}
                    onChange={(val) => setPendingRoleChange({ ...pendingRoleChange, newRole: val as Role })}
                    options={ALL_ROLES.filter(r => r !== 'Primary Admin')}
                    theme={theme}
                    size="sm"
                    triggerClassName="w-full text-xs font-extrabold text-emerald-500 bg-transparent border-0 p-0 shadow-none hover:bg-transparent"
                  />
                </div>
              </div>

              {/* Permission Difference */}
              <div className="space-y-3 border-t border-b py-3 border-zinc-150 dark:border-zinc-850">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Permission Summary for {pendingRoleChange.newRole}
                </h4>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-xs">
                  <p className="font-bold text-emerald-500 text-[10px] uppercase tracking-wider">✓ Allowed Permissions</p>
                  {ROLE_DEFINITIONS[pendingRoleChange.newRole].permissions.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 font-medium">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>{p}</span>
                    </div>
                  ))}

                  {ROLE_DEFINITIONS[pendingRoleChange.newRole].restrictions.length > 0 && (
                    <>
                      <p className="font-bold text-rose-500 text-[10px] uppercase tracking-wider pt-2">✕ Restrictions</p>
                      {ROLE_DEFINITIONS[pendingRoleChange.newRole].restrictions.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 font-medium text-rose-500">
                          <span className="font-bold">✕</span>
                          <span>{r}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={() => setPendingRoleChange(null)}
                  className={cn(
                    "px-4 py-2 rounded-lg border text-xs font-bold transition-all cursor-pointer",
                    theme === 'dark' ? "border-zinc-800 hover:bg-zinc-900" : "border-zinc-200 hover:bg-zinc-100"
                  )}
                >
                  Cancel
                </button>

                <button
                  onClick={confirmRoleChange}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  Confirm Role Change
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REMOVE MEMBER MODAL */}
      <AnimatePresence>
        {memberToRemove && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMemberToRemove(null)}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className={cn(
                "relative w-full max-w-md rounded-xl border shadow-2xl p-6 z-10 space-y-5 overflow-hidden",
                theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20 shrink-0">
                  <UserX size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold">Remove Member Access?</h3>
                  <p className="text-xs text-zinc-400">
                    Revoke access to this cashbook for the selected collaborator.
                  </p>
                </div>
              </div>

              <div className={cn(
                "p-4 rounded-xl border space-y-2 text-xs",
                theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
              )}>
                <div>
                  <span className="text-zinc-400 font-medium">Member Name: </span>
                  <span className="font-bold text-zinc-200">{memberToRemove.name}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-medium">Email Address: </span>
                  <span className="font-bold text-zinc-200">{memberToRemove.email}</span>
                </div>
                <div>
                  <span className="text-zinc-400 font-medium">Cashbook: </span>
                  <span className="font-bold text-emerald-500">{cashbookName}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setMemberToRemove(null)}
                  className={cn(
                    "px-4 py-2 rounded-lg border text-xs font-bold transition-all cursor-pointer",
                    theme === 'dark' ? "border-zinc-800 hover:bg-zinc-900" : "border-zinc-200 hover:bg-zinc-100"
                  )}
                >
                  Cancel
                </button>

                <button
                  onClick={confirmRemoveMember}
                  className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  Remove Access
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INVITE MEMBER WIZARD & EMAIL PREVIEW MODAL */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closeInviteWizard}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className={cn(
                "relative w-full max-w-xl rounded-xl border shadow-2xl p-6 z-10 space-y-6 overflow-hidden",
                theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <div className="flex items-center justify-between border-b pb-4 border-zinc-150 dark:border-zinc-850">
                <div className="flex items-center gap-2.5">
                  <UserPlus size={20} className="text-emerald-500" />
                  <div>
                    <h3 className="text-base font-bold">Add Member Flow</h3>
                    <p className="text-xs text-zinc-400">
                      {!showEmailPreview ? `Step ${inviteStep} of 4: Role-Based Access Control Setup` : 'Invitation Email Preview'}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={closeInviteWizard}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200"
                >
                  <X size={18} />
                </button>
              </div>

              {!showEmailPreview ? (
                <>
                  {/* STEP 1: Email Address */}
                  {inviteStep === 1 && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                          Step 1: Email Address *
                        </label>
                        <input 
                          type="email"
                          required
                          placeholder="Enter email address (e.g. user@email.com)"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className={cn(
                            "w-full px-3.5 py-2.5 text-xs rounded-lg border outline-none font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500",
                            theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-300 text-zinc-900"
                          )}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                          Full Name (Optional)
                        </label>
                        <input 
                          type="text"
                          placeholder="Enter member full name"
                          value={inviteName}
                          onChange={(e) => setInviteName(e.target.value)}
                          className={cn(
                            "w-full px-3.5 py-2.5 text-xs rounded-lg border outline-none font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500",
                            theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-300 text-zinc-900"
                          )}
                        />
                      </div>

                      <div className="pt-4 flex justify-end">
                        <button
                          disabled={!inviteEmail.trim()}
                          onClick={() => setInviteStep(2)}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                        >
                          Step 2: Select Role →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: Select Role */}
                  {inviteStep === 2 && (
                    <div className="space-y-4">
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                        Step 2: Select Role
                      </label>

                      <div className="grid grid-cols-1 gap-2.5">
                        {/* Primary Admin (Disabled for normal invitation) */}
                        <div className={cn(
                          "p-3.5 rounded-xl border opacity-50 cursor-not-allowed flex items-center justify-between",
                          theme === 'dark' ? "border-zinc-850 bg-zinc-900/20" : "border-zinc-200 bg-zinc-100"
                        )}>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400">Primary Admin</p>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">Not Selectable</span>
                            </div>
                            <p className="text-[11px] text-zinc-500 mt-0.5">Primary Admin cannot be created via normal member invitation.</p>
                          </div>
                        </div>

                        {/* Selectable Roles */}
                        {(['Admin', 'Book Admin', 'Data Operator', 'Viewer'] as Role[]).map((role) => {
                          const def = ROLE_DEFINITIONS[role];
                          const isSelected = inviteRole === role;
                          return (
                            <div
                              key={role}
                              onClick={() => setInviteRole(role)}
                              className={cn(
                                "p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all",
                                isSelected
                                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold ring-1 ring-emerald-500/20"
                                  : theme === 'dark' ? "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700" : "border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100/80"
                              )}
                            >
                              <div>
                                <p className="text-xs font-extrabold">{role}</p>
                                <p className="text-[11px] opacity-85 font-normal mt-0.5">{def.description}</p>
                              </div>
                              {isSelected && <Check size={16} className="text-emerald-600 dark:text-emerald-400" />}
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-4 flex justify-between">
                        <button
                          onClick={() => setInviteStep(1)}
                          className="px-4 py-2 border rounded-lg text-xs font-bold"
                        >
                          ← Back
                        </button>

                        <button
                          onClick={() => setInviteStep(3)}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm"
                        >
                          Step 3: Role & Permissions →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Role & Permissions View */}
                  {inviteStep === 3 && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                          Step 3: Role & Permissions ({inviteRole})
                        </h4>

                        <div className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/20 space-y-4">
                          {/* Permissions */}
                          <div className="space-y-2">
                            <p className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs uppercase tracking-wider">
                              Permissions
                            </p>
                            <div className="space-y-1.5 max-h-36 overflow-y-auto text-xs pr-1">
                              {ROLE_DEFINITIONS[inviteRole].permissions.map((p, i) => (
                                <div key={i} className="flex items-center gap-2 font-medium">
                                  <span className="text-emerald-500 font-bold">✓</span>
                                  <span>{p}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Restrictions */}
                          {ROLE_DEFINITIONS[inviteRole].restrictions.length > 0 && (
                            <div className="space-y-2 border-t pt-3 border-emerald-500/20">
                              <p className="font-extrabold text-rose-500 text-xs uppercase tracking-wider">
                                Restrictions
                              </p>
                              <div className="space-y-1.5 max-h-36 overflow-y-auto text-xs pr-1">
                                {ROLE_DEFINITIONS[inviteRole].restrictions.map((r, i) => (
                                  <div key={i} className="flex items-center gap-2 font-medium text-rose-500">
                                    <span className="font-bold">✕</span>
                                    <span>{r}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 flex justify-between">
                        <button
                          onClick={() => setInviteStep(2)}
                          className="px-4 py-2 border rounded-lg text-xs font-bold"
                        >
                          ← Back
                        </button>

                        <button
                          onClick={() => setInviteStep(4)}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                        >
                          Step 4: Confirmation →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: Confirmation */}
                  {inviteStep === 4 && (
                    <form onSubmit={handleSendInvite} className="space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                          Step 4: Confirmation
                        </h4>

                        <div className={cn(
                          "p-4 rounded-xl border space-y-3 text-xs",
                          theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-slate-50 border-slate-200 text-slate-900"
                        )}>
                          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-zinc-800">
                            <span className="font-bold text-slate-800 dark:text-zinc-200">Status State:</span>
                            <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-mono text-[11px] font-bold shadow-xs">
                              Invitation Draft Ready
                            </span>
                          </div>

                          <p><strong className="text-slate-700 dark:text-zinc-300 font-bold">Recipient Email:</strong> <span className="font-semibold text-slate-950 dark:text-white">{inviteEmail}</span></p>
                          {inviteName && <p><strong className="text-slate-700 dark:text-zinc-300 font-bold">Recipient Name:</strong> <span className="font-semibold text-slate-950 dark:text-white">{inviteName}</span></p>}
                          <p><strong className="text-slate-700 dark:text-zinc-300 font-bold">Cashbook:</strong> <span className="font-semibold text-slate-950 dark:text-white">{cashbookName}</span></p>
                          <p><strong className="text-slate-700 dark:text-zinc-300 font-bold">Assigned Role:</strong> <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">{inviteRole}</span></p>

                          <div className="p-3 rounded-lg bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 text-[11px] leading-relaxed font-medium">
                            <strong className="font-bold text-emerald-900 dark:text-emerald-300">Real-Time Notification:</strong> Clicking 'Send Invitation' validates the recipient account and dispatches an in-app notification directly to their TrackBook notification bell.
                          </div>
                        </div>
                      </div>

                      {inviteError && (
                        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 text-xs font-bold">
                          {inviteError}
                        </div>
                      )}

                      <div className="pt-4 flex justify-between">
                        <button
                          type="button"
                          disabled={isSubmittingInvite}
                          onClick={() => setInviteStep(3)}
                          className="px-4 py-2 border rounded-lg text-xs font-bold"
                        >
                          ← Back
                        </button>

                        <button
                          type="submit"
                          disabled={isSubmittingInvite}
                          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
                        >
                          {isSubmittingInvite ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              <span>Dispatching...</span>
                            </>
                          ) : (
                            <span>Send Invitation</span>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              ) : (
                /* INVITATION SENT CONFIRMATION UI */
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <h4 className="text-base font-black">Invitation Dispatched Successfully!</h4>
                    </div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300/80 leading-relaxed">
                      An in-app notification has been dispatched to <strong className="font-black text-emerald-900 dark:text-emerald-200">{inviteEmail}</strong> to join <strong className="font-black text-emerald-900 dark:text-emerald-200">{cashbookName}</strong> as <strong className="font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">{inviteRole}</strong>. They will see a badge in their TrackBook header notification bell.
                    </p>
                  </div>

                  {/* Direct Invitation Link Box */}
                  <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 space-y-2.5 text-xs">
                    <p className="font-black text-zinc-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider">Direct Invitation Link</p>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={generatedInviteUrl}
                        className="flex-1 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs outline-none shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedInviteUrl);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm"
                      >
                        {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                      </button>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                      <span className="font-bold text-emerald-600 shrink-0">🔔</span>
                      <span>An in-app notification bell badge has also been sent to <strong>{inviteEmail}</strong>. They will see it when logged into TrackBook!</span>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={closeInviteWizard}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl cursor-pointer shadow-md transition-all"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ROLES & PERMISSIONS MODAL */}
      <RolesPermissionsModal
        isOpen={showRolesModal}
        onClose={() => setShowRolesModal(false)}
        theme={theme}
        initialRole={rolesModalRole}
      />

      <InAppDialog
        isOpen={Boolean(inAppDialog)}
        options={inAppDialog}
        onClose={() => setInAppDialog(null)}
        theme={theme}
      />
    </div>
  );
}
