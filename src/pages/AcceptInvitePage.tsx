import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, Mail, CheckCircle2, AlertTriangle, ArrowRight, Lock, UserCheck, RefreshCw, Layers } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, vibrate } from '../lib/utils';
import { ROLE_DEFINITIONS, Role } from '../lib/rbac';

interface AcceptInvitePageProps {
  theme: 'light' | 'dark';
  currentUserEmail?: string;
  currentUserId?: string;
  currentUserName?: string;
}

export default function AcceptInvitePage({
  theme,
  currentUserEmail = 'owner@trackbook.app',
  currentUserId = 'u_current',
  currentUserName = 'Logged User'
}: AcceptInvitePageProps) {
  const [searchParams] = useSearchParams();
  const routeParams = useParams();
  const navigate = useNavigate();
  const token = routeParams.token || searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [inviteDetails, setInviteDetails] = useState<{
    cashbookId: string;
    cashbookName: string;
    email: string;
    role: Role;
    inviterEmail?: string;
    expiresAt: string;
  } | null>(null);

  // Verify Token on Mount
  useEffect(() => {
    if (!token) {
      setError('No invitation token provided in URL. Please use the complete link from your invitation email.');
      setLoading(false);
      return;
    }

    async function verifyToken() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/rbac/verify-invitation?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!data.valid) {
          setError(data.error || 'Invalid or expired invitation token.');
        } else {
          setInviteDetails({
            cashbookId: data.cashbookId,
            cashbookName: data.cashbookName || 'TrackBook Cashbook',
            email: data.email,
            role: data.role as Role,
            inviterEmail: data.inviterEmail,
            expiresAt: data.expiresAt
          });
        }
      } catch (err: any) {
        setError(err.message || 'Error communicating with verification server.');
      } finally {
        setLoading(false);
      }
    }

    verifyToken();
  }, [token]);

  const handleAcceptInvite = async () => {
    if (!token || !inviteDetails) return;
    vibrate(15);

    setAccepting(true);
    setError(null);

    try {
      const res = await fetch('/api/rbac/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          userEmail: currentUserEmail || inviteDetails.email,
          userId: currentUserId,
          userName: currentUserName
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to accept invitation.');
      }

      setSuccess(true);
      window.dispatchEvent(new CustomEvent('cashbook_updated', { detail: { cashbookId: data.cashbookId || inviteDetails.cashbookId } }));
      window.dispatchEvent(new CustomEvent('trackbook_refresh_cashbooks'));
      setTimeout(() => {
        const slug = inviteDetails.cashbookName ? inviteDetails.cashbookName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : inviteDetails.cashbookId;
        navigate(`/cashbooks/${slug}`);
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Error accepting invitation.');
    } finally {
      setAccepting(false);
    }
  };

  const isEmailMatch = inviteDetails && currentUserEmail.toLowerCase() === inviteDetails.email.toLowerCase();

  return (
    <div className={cn(
      "min-h-screen flex items-center justify-center p-4 font-sans transition-colors duration-200",
      theme === 'dark' ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-900"
    )}>
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className={cn(
          "w-full max-w-lg rounded-2xl border shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden",
          theme === 'dark' ? "bg-zinc-900/90 border-zinc-800" : "bg-white border-zinc-200"
        )}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b pb-5 border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 font-extrabold text-sm">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">TrackBook Cashbooks</h1>
              <p className="text-xs text-zinc-400 font-medium">Invitation Verification & Acceptance</p>
            </div>
          </div>
          <span className="text-[10px] uppercase font-mono font-extrabold px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            RBAC Phase 2
          </span>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="py-12 text-center space-y-3">
            <RefreshCw size={28} className="animate-spin text-emerald-500 mx-auto" />
            <p className="text-xs font-bold text-zinc-400">Verifying secure cryptographic invitation token...</p>
          </div>
        )}

        {/* ERROR STATE */}
        {!loading && error && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle size={18} />
                <span>Invitation Error</span>
              </div>
              <p className="font-medium text-rose-400 leading-relaxed">{error}</p>
            </div>

            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-all cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        )}

        {/* SUCCESS ACCEPTED STATE */}
        {!loading && success && (
          <div className="py-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 mx-auto animate-bounce">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-lg font-bold text-emerald-500">Invitation Accepted!</h2>
            <p className="text-xs text-zinc-400">
              You are now assigned as <strong className="text-zinc-200">{inviteDetails?.role}</strong> in <strong className="text-emerald-400">{inviteDetails?.cashbookName}</strong>. Redirecting...
            </p>
          </div>
        )}

        {/* VALID INVITATION DETAILS */}
        {!loading && !error && !success && inviteDetails && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">You're Invited To Join</p>
              <h2 className="text-xl font-black text-emerald-500">{inviteDetails.cashbookName}</h2>
              {inviteDetails.inviterEmail && (
                <p className="text-xs text-zinc-400">
                  Invited by <span className="font-bold text-zinc-200">{inviteDetails.inviterEmail}</span>
                </p>
              )}
            </div>

            {/* Details Box */}
            <div className={cn(
              "p-4 rounded-xl border space-y-3 text-xs",
              theme === 'dark' ? "bg-zinc-950/60 border-zinc-800" : "bg-zinc-50 border-zinc-200"
            )}>
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-400">Assigned Role:</span>
                <span className="font-extrabold px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  {inviteDetails.role}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-400">Invited Email:</span>
                <span className="font-bold text-zinc-200 font-mono">{inviteDetails.email}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Expires:</span>
                <span className="font-medium text-zinc-400 font-mono">{new Date(inviteDetails.expiresAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Permissions Preview */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Role Capabilities ({inviteDetails.role})</p>
              <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1.5 max-h-36 overflow-y-auto text-xs">
                {ROLE_DEFINITIONS[inviteDetails.role].permissions.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 font-medium">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Email Check Warning */}
            {!isEmailMatch && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs space-y-3">
                <div className="flex items-start gap-2">
                  <Lock size={16} className="shrink-0 mt-0.5 text-amber-500" />
                  <div>
                    <p className="font-bold text-amber-400">Different Email Address Detected</p>
                    <p className="text-[11px] text-amber-300/90 mt-1 leading-relaxed">
                      This invitation was sent to <strong>{inviteDetails.email}</strong>, but you are currently signed in as <strong>{currentUserEmail}</strong>.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/login?email=${encodeURIComponent(inviteDetails.email)}&redirect=${encodeURIComponent('/invitations/' + token)}`)}
                  className="w-full py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[11px] border border-amber-500/30 transition-all cursor-pointer"
                >
                  Sign in or Register as {inviteDetails.email}
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleAcceptInvite}
                disabled={accepting}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {accepting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Processing Acceptance...</span>
                  </>
                ) : (
                  <>
                    <UserCheck size={16} />
                    <span>Accept Invitation & Access Cashbook</span>
                  </>
                )}
              </button>

              <button
                onClick={() => navigate('/')}
                className="w-full py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
