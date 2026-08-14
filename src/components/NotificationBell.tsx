import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, XCircle, Loader2, ShieldCheck, Mail, Check, X, ShieldAlert, AlertTriangle, Eye, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface NotificationBellProps {
  session: any;
  theme: 'light' | 'dark';
  onInviteAccepted?: () => void;
}

export default function NotificationBell({ session, theme, onInviteAccepted }: NotificationBellProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState<any | null>(null);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [loadingAction, setLoadingAction] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!session?.user?.id) return;

    const userEmail = session.user.email?.trim().toLowerCase() || '';
    const userId = session.user.id;

    let fetchedFromApi = false;
    try {
      const res = await fetch(`/api/notifications?userId=${encodeURIComponent(userId)}&userEmail=${encodeURIComponent(userEmail)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          setNotifications(data.notifications || []);
          setPendingInvitations(data.pendingInvitations || []);
          setUnreadCount(data.unreadCount || 0);
          fetchedFromApi = true;
          return;
        }
      }
    } catch (apiErr: any) {
      console.warn('[NotificationBell] Backend notifications API unavailable, switching to Supabase fallback:', apiErr?.message || apiErr);
    }

    if (!fetchedFromApi && supabase) {
      try {
        // 1. Direct fetch invitations
        const { data: invData } = await supabase
          .from('cashbook_invitations')
          .select('*')
          .eq('email', userEmail)
          .in('status', ['Sent', 'pending', 'Draft', 'sent']);

        // 2. Direct fetch notifications
        const { data: notifData } = await supabase
          .from('notifications')
          .select('*')
          .or(`user_id.eq.${userId},email.ilike.${userEmail}`)
          .order('created_at', { ascending: false });

        const rawNotifs = notifData || [];
        const rawInvs = invData || [];

        const cashbookIds = [...new Set([
          ...rawNotifs.map((n: any) => n.cashbook_id),
          ...rawInvs.map((i: any) => i.cashbook_id)
        ].filter(Boolean))];

        let cbMap = new Map<string, string>();
        if (cashbookIds.length > 0) {
          const { data: cbData } = await supabase
            .from('cashbooks')
            .select('id, name')
            .in('id', cashbookIds);

          cbMap = new Map((cbData || []).map((cb: any) => [cb.id, cb.name]));
        }

        const enrichedInvs = rawInvs.map((inv: any) => ({
          ...inv,
          cashbookName: inv.cashbookName || cbMap.get(inv.cashbook_id) || 'TrackBook Cashbook'
        }));

        const enrichedNotifs = rawNotifs.map((notif: any) => ({
          ...notif,
          cashbookName: notif.cashbookName || cbMap.get(notif.cashbook_id) || 'TrackBook Cashbook'
        }));

        const unreadCount = Math.max(
          enrichedNotifs.filter((n: any) => !n.is_read).length,
          enrichedInvs.length
        );

        setPendingInvitations(enrichedInvs);
        setNotifications(enrichedNotifs);
        setUnreadCount(unreadCount);
      } catch (fallbackErr: any) {
        console.warn('[NotificationBell] Direct Supabase fallback warning:', fallbackErr?.message || fallbackErr);
      }
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Set up Supabase Realtime channel for live in-app notifications
    let channel: any = null;
    if (supabase && session?.user?.id) {
      try {
        channel = supabase
          .channel(`notifications_${session.user.id}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${session.user.id}`
          }, () => {
            console.log('[NotificationBell]', {
              event: 'realtime_notification_received',
              user_id: session.user.id,
              user_email: session.user.email
            });
            fetchNotifications();
          })
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'cashbook_invitations',
            filter: `email=eq.${session.user.email?.trim().toLowerCase()}`
          }, () => {
            console.log('[NotificationBell]', {
              event: 'realtime_notification_received',
              user_id: session.user.id,
              user_email: session.user.email
            });
            fetchNotifications();
          })
          .subscribe();
      } catch (e) {
        console.warn('[NotificationBell] Realtime subscribe warning:', e);
      }
    }

    const interval = setInterval(fetchNotifications, 10000); // 10s fallback polling

    return () => {
      clearInterval(interval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [session]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAccept = async (invitation: any) => {
    setLoadingAction(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/rbac/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitationId: invitation.id,
          cashbookId: invitation.cashbook_id,
          role: invitation.role,
          userEmail: session.user.email,
          userId: session.user.id,
          userName: session.user.user_metadata?.full_name || session.user.email.split('@')[0]
        })
      });

      const data = await res.json();

      if (!res.ok && !data.success) {
        // If already accepted, treat as success and route user
        if (data.error && data.error.toLowerCase().includes('already been accepted')) {
          setStatusMessage({
            type: 'success',
            text: `You have already joined ${invitation.cashbookName || 'this Cashbook'}!`
          });
          setSelectedInvite(null);
          await fetchNotifications();
          window.dispatchEvent(new CustomEvent('trackbook_refresh_cashbooks'));
          if (invitation.cashbook_id) {
            setTimeout(() => {
              navigate(`/cashbooks/${invitation.cashbook_id}`);
            }, 500);
          }
          return;
        }
        throw new Error(data.error || 'Failed to accept invitation');
      }

      setStatusMessage({
        type: 'success',
        text: `Successfully joined ${invitation.cashbookName || 'Cashbook'} as ${data.role || invitation.role}!`
      });

      setSelectedInvite(null);
      setShowRejectConfirm(false);

      await fetchNotifications();

      // Trigger app-wide refresh
      window.dispatchEvent(new CustomEvent('cashbook_updated', { detail: { cashbookId: data.cashbookId } }));
      window.dispatchEvent(new CustomEvent('trackbook_refresh_cashbooks'));

      if (onInviteAccepted) {
        onInviteAccepted();
      }

      // Automatically navigate to accepted cashbook
      if (data.cashbookId) {
        setTimeout(() => {
          navigate(`/cashbooks/${data.cashbookId}`);
        }, 800);
      }

      setTimeout(() => {
        setStatusMessage(null);
        setIsOpen(false);
      }, 3000);
    } catch (err: any) {
      console.error('[NotificationBell] Accept error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error accepting invitation'
      });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDecline = async (invitation: any) => {
    setLoadingAction(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/rbac/decline-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitationId: invitation.id,
          cashbookId: invitation.cashbook_id,
          userEmail: session.user.email,
          userId: session.user.id
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to reject invitation');
      }

      setStatusMessage({
        type: 'success',
        text: 'Invitation rejected.'
      });

      setSelectedInvite(null);
      setShowRejectConfirm(false);

      await fetchNotifications();

      setTimeout(() => {
        setStatusMessage(null);
      }, 3000);
    } catch (err: any) {
      console.error('[NotificationBell] Decline error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error rejecting invitation'
      });
    } finally {
      setLoadingAction(false);
    }
  };

  // Handler for accepting a proposed Role Change
  const handleAcceptRoleChange = async (notif: any) => {
    if (!session?.user?.email) return;
    setLoadingAction(true);
    setStatusMessage(null);

    const targetRole = notif.new_role || notif.role;
    try {
      const res = await fetch('/api/rbac/accept-role-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashbookId: notif.cashbook_id,
          userEmail: session.user.email,
          userId: session.user.id,
          userName: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
          newRole: targetRole,
          role: targetRole
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to accept role change');
      }

      setStatusMessage({
        type: 'success',
        text: `Role updated to ${targetRole} in ${notif.cashbookName || 'Cashbook'}!`
      });

      await fetchNotifications();

      // Trigger app-wide refresh so new permissions/roles take effect immediately
      window.dispatchEvent(new CustomEvent('cashbook_updated', { detail: { cashbookId: notif.cashbook_id } }));
      window.dispatchEvent(new CustomEvent('trackbook_refresh_cashbooks'));

      setTimeout(() => {
        setStatusMessage(null);
        setIsOpen(false);
      }, 3000);
    } catch (err: any) {
      console.error('[NotificationBell] Role change accept error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error updating role'
      });
    } finally {
      setLoadingAction(false);
    }
  };

  // Handler for declining a proposed Role Change
  const handleDeclineRoleChange = async (notif: any) => {
    if (!session?.user?.email) return;
    setLoadingAction(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/rbac/decline-role-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashbookId: notif.cashbook_id,
          userEmail: session.user.email,
          notificationId: notif.id
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to decline role change');
      }

      setStatusMessage({
        type: 'success',
        text: 'Role change declined.'
      });

      await fetchNotifications();

      setTimeout(() => {
        setStatusMessage(null);
      }, 3000);
    } catch (err: any) {
      console.error('[NotificationBell] Role change decline error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error declining role change'
      });
    } finally {
      setLoadingAction(false);
    }
  };

  // Helper for Role Permissions breakdown in modal
  const getRolePermissions = (role: string) => {
    switch (role) {
      case 'Admin':
      case 'Book Admin':
        return {
          allowed: [
            'Full management of Cash In & Cash Out entries',
            'Edit and delete transaction records',
            'Invite and manage Data Operators and Viewers',
            'Download and export full financial reports'
          ],
          restricted: [
            'Cannot delete the Primary Admin',
            'Cannot transfer cashbook ownership'
          ]
        };
      case 'Data Operator':
        return {
          allowed: [
            'Add new Cash In & Cash Out entries',
            'Attach receipt images to entries',
            'View transaction history and cash balance'
          ],
          restricted: [
            'Cannot modify cashbook settings or members',
            'Cannot delete cashbook or transfer ownership'
          ]
        };
      case 'Viewer':
      default:
        return {
          allowed: [
            'View cashbook balance and entries',
            'Filter and search transactions',
            'View attached receipt images'
          ],
          restricted: [
            'Cannot add, edit, or delete transactions',
            'Cannot invite new members'
          ]
        };
    }
  };

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        id="notification-bell-btn"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        title="Notifications & Invitations"
        className={cn(
          "relative p-2.5 rounded-xl transition-all cursor-pointer outline-none",
          theme === 'dark' 
            ? "hover:bg-zinc-800/80 text-slate-300 hover:text-white" 
            : "hover:bg-slate-100 text-slate-600 hover:text-slate-900",
          unreadCount > 0 && "text-emerald-600 dark:text-emerald-400"
        )}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-black text-white shadow-md ring-2 ring-white dark:ring-black animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={cn(
              "absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-24px)] rounded-2xl shadow-2xl border z-50 overflow-hidden transition-colors duration-300",
              theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-900"
            )}
          >
            {/* Panel Header */}
            <div className={cn(
              "px-4 py-3 border-b flex items-center justify-between",
              theme === 'dark' ? "border-zinc-900 bg-zinc-900/50" : "border-slate-100 bg-slate-50/80"
            )}>
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-xs font-black uppercase tracking-wider">Notifications</h4>
              </div>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/30">
                  {unreadCount} New
                </span>
              )}
            </div>

            {/* Status Alert Banner inside panel */}
            {statusMessage && (
              <div className={cn(
                "p-3 text-xs font-bold flex items-center gap-2 border-b animate-fadeIn",
                statusMessage.type === 'success'
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200/50"
                  : "bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200/50"
              )}>
                {statusMessage.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* Notification List */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-2">
              {pendingInvitations.length === 0 && notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 dark:text-zinc-500 space-y-2">
                  <Mail size={28} className="mx-auto opacity-40 mb-1" />
                  <p className="font-bold text-slate-600 dark:text-zinc-400">No Notifications</p>
                  <p className="text-[11px] opacity-75">When someone invites you to join a cashbook, invitation alerts will appear here in real time.</p>
                </div>
              ) : (
                <>
                  {/* Pending Cashbook Invitations */}
                  {pendingInvitations.map((inv) => (
                    <div 
                      key={inv.id} 
                      className={cn(
                        "p-3.5 rounded-xl border transition-all space-y-3",
                        theme === 'dark' 
                          ? "bg-zinc-900/90 border-emerald-500/30 hover:border-emerald-500/50" 
                          : "bg-emerald-50/70 border-emerald-300 hover:border-emerald-400"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 w-full">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <h5 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                                Cashbook Invitation
                              </h5>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-600 text-white shadow-xs">
                              {inv.role}
                            </span>
                          </div>
                          <p className="text-sm font-black text-emerald-800 dark:text-emerald-300">
                            {inv.cashbookName}
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-zinc-300">
                            You have been invited to collaborate as <span className="font-extrabold text-slate-900 dark:text-white underline decoration-emerald-500 underline-offset-2">{inv.role}</span>
                          </p>
                          {inv.inviter_email && (
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                              From: {inv.inviter_email}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons: Direct Accept & Reject & View Details */}
                      <div className="pt-1 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={loadingAction}
                          onClick={() => handleAccept(inv)}
                          className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {loadingAction ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          <span>Accept</span>
                        </button>

                        <button
                          type="button"
                          disabled={loadingAction}
                          onClick={() => {
                            setSelectedInvite(inv);
                            setShowRejectConfirm(false);
                          }}
                          className={cn(
                            "py-2 px-2.5 rounded-lg border font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50",
                            theme === 'dark' 
                              ? "border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700" 
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          )}
                          title="Review Permissions"
                        >
                          <Eye size={14} />
                          <span>Details</span>
                        </button>

                        <button
                          type="button"
                          disabled={loadingAction}
                          onClick={() => {
                            setSelectedInvite(inv);
                            setShowRejectConfirm(true);
                          }}
                          className={cn(
                            "py-2 px-2 rounded-lg border font-bold text-xs transition-all flex items-center justify-center cursor-pointer disabled:opacity-50",
                            theme === 'dark'
                              ? "border-zinc-800 text-rose-400 hover:bg-rose-950/40 hover:border-rose-900"
                              : "border-rose-200 text-rose-600 hover:bg-rose-50"
                          )}
                          title="Reject Invitation"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Role Change Request Notifications */}
                  {notifications.filter(n => n.type === 'role_change' && !n.is_read).map((notif) => (
                    <div 
                      key={notif.id} 
                      className={cn(
                        "p-3.5 rounded-xl border transition-all space-y-2.5",
                        theme === 'dark' 
                          ? "bg-zinc-900/90 border-blue-500/30 hover:border-blue-500/50" 
                          : "bg-blue-50/70 border-blue-300 hover:border-blue-400"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 w-full">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <ShieldCheck size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                              <h5 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                                Role Update Request
                              </h5>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-600 text-white shadow-xs">
                              {notif.new_role || notif.role}
                            </span>
                          </div>
                          <p className="text-sm font-black text-blue-900 dark:text-blue-300">
                            {notif.cashbookName || 'TrackBook Cashbook'}
                          </p>
                          <p className="text-[11px] text-slate-700 dark:text-zinc-200">
                            Your role is changing to <span className="font-extrabold text-blue-700 dark:text-blue-400 underline decoration-blue-500 underline-offset-2">{notif.new_role || notif.role}</span>. Accept to activate new permissions?
                          </p>
                          {notif.old_role && (
                            <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                              Previous Role: <span className="font-semibold">{notif.old_role}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons: Accept & Decline Role Change */}
                      <div className="pt-1 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={loadingAction}
                          onClick={() => handleAcceptRoleChange(notif)}
                          className="flex-1 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {loadingAction ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          <span>Accept Role</span>
                        </button>

                        <button
                          type="button"
                          disabled={loadingAction}
                          onClick={() => handleDeclineRoleChange(notif)}
                          className={cn(
                            "py-2 px-3 rounded-lg border font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50",
                            theme === 'dark'
                              ? "border-zinc-800 text-rose-400 hover:bg-rose-950/40 hover:border-rose-900"
                              : "border-rose-200 text-rose-600 hover:bg-rose-50"
                          )}
                        >
                          <X size={14} />
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Other General Notifications */}
                  {notifications.filter(n => n.type !== 'cashbook_invitation' && (n.type !== 'role_change' || n.is_read)).map((notif) => (
                    <div 
                      key={notif.id} 
                      className={cn(
                        "p-3 rounded-xl border text-xs space-y-1 transition-colors",
                        theme === 'dark' ? "bg-zinc-900/40 border-zinc-900" : "bg-slate-50 border-slate-100"
                      )}
                    >
                      <h5 className="font-bold text-slate-900 dark:text-white">{notif.title}</h5>
                      <p className="text-slate-600 dark:text-zinc-300 text-[11px]">{notif.message}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VIEW INVITATION MODAL */}
      <AnimatePresence>
        {selectedInvite && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden transition-colors duration-300",
                theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-slate-200 text-slate-900"
              )}
            >
              {/* Modal Header */}
              <div className={cn(
                "p-5 border-b flex items-center justify-between",
                theme === 'dark' ? "border-zinc-800 bg-zinc-900/50" : "border-slate-100 bg-slate-50/80"
              )}>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black leading-tight">Cashbook Invitation</h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">Review details before joining</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedInvite(null);
                    setShowRejectConfirm(false);
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                {/* Cashbook Card */}
                <div className={cn(
                  "p-4 rounded-xl border space-y-2",
                  theme === 'dark' ? "bg-zinc-900/80 border-zinc-800" : "bg-slate-50 border-slate-200/80"
                )}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Cashbook</span>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-emerald-600 text-white shadow-sm">
                      {selectedInvite.role}
                    </span>
                  </div>
                  <p className="text-lg font-black text-slate-900 dark:text-white">
                    {selectedInvite.cashbookName}
                  </p>
                  {selectedInvite.inviter_email && (
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Invited by: <span className="font-bold text-slate-700 dark:text-zinc-200">{selectedInvite.inviter_email}</span>
                    </p>
                  )}
                </div>

                {/* Role & Permissions Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Role Permissions ({selectedInvite.role})
                  </h4>

                  {/* Allowed Permissions Checklist */}
                  <div className="space-y-2">
                    {getRolePermissions(selectedInvite.role).allowed.map((perm, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-zinc-300">
                        <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{perm}</span>
                      </div>
                    ))}
                  </div>

                  {/* Restricted Actions */}
                  <div className="pt-2 space-y-2 border-t border-slate-100 dark:border-zinc-900">
                    {getRolePermissions(selectedInvite.role).restricted.map((rest, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-400 dark:text-zinc-500">
                        <XCircle size={16} className="text-slate-400 dark:text-zinc-600 shrink-0 mt-0.5" />
                        <span>{rest}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Confirmation Box if Rejecting */}
                {showRejectConfirm && (
                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-3 animate-fadeIn">
                    <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-black text-xs">
                      <AlertTriangle size={18} className="shrink-0 text-rose-600 dark:text-rose-400" />
                      <span>Are you sure you want to reject this invitation?</span>
                    </div>
                    <p className="text-[11px] text-rose-700 dark:text-rose-400/90 leading-relaxed">
                      If you reject this invitation, you will not be granted access to "{selectedInvite.cashbookName}". The inviter will need to dispatch a new invitation.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={loadingAction}
                        onClick={() => handleDecline(selectedInvite)}
                        className="flex-1 py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {loadingAction ? <Loader2 size={14} className="animate-spin" /> : 'Yes, Reject Invitation'}
                      </button>
                      <button
                        type="button"
                        disabled={loadingAction}
                        onClick={() => setShowRejectConfirm(false)}
                        className="py-2 px-3 rounded-lg border border-slate-300 dark:border-zinc-700 font-extrabold text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              {!showRejectConfirm && (
                <div className={cn(
                  "p-4 border-t flex items-center gap-3",
                  theme === 'dark' ? "border-zinc-800 bg-zinc-900/50" : "border-slate-100 bg-slate-50/80"
                )}>
                  <button
                    type="button"
                    disabled={loadingAction}
                    onClick={() => handleAccept(selectedInvite)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loadingAction ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        <Check size={18} />
                        <span>Accept Invitation</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={loadingAction}
                    onClick={() => setShowRejectConfirm(true)}
                    className={cn(
                      "py-2.5 px-4 rounded-xl text-sm font-bold transition-all border cursor-pointer disabled:opacity-50",
                      theme === 'dark'
                        ? "border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                        : "border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    Reject
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
