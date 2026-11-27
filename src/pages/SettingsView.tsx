import React, { useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Lock,
  ShieldCheck,
  Wallet,
  HelpCircle,
  MessageSquare,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SettingsViewProps {
  session: any;
  userName: string;
  setUserName: (name: string) => void;
  userPhone: string | null;
  userPhoneVerified: boolean;
  booksCount: number;
  entriesCount: number;
  onOpenPhoneComingSoon: () => void;
  onOpenHelpModal: () => void;
  onClearLocalCache: () => void;
  onSignOut: () => void;
}

export default function SettingsView({
  session,
  userName,
  setUserName,
  userPhone,
  userPhoneVerified,
  booksCount,
  entriesCount,
  onOpenPhoneComingSoon,
  onOpenHelpModal,
  onClearLocalCache,
  onSignOut,
}: SettingsViewProps) {
  const [nameInput, setNameInput] = useState(userName || '');
  const [savingName, setSavingName] = useState(false);
  const [nameFeedback, setNameFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [resetLoading, setResetLoading] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !session?.user) return;
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setNameFeedback({ type: 'error', text: 'Name cannot be empty.' });
      return;
    }

    setSavingName(true);
    setNameFeedback(null);
    try {
      const { error: authErr } = await supabase.auth.updateUser({
        data: {
          full_name: trimmed,
          name: trimmed,
          username: trimmed,
          user_name: trimmed,
        },
      });
      if (authErr) throw authErr;

      try {
        await supabase.from('profiles').upsert(
          {
            id: session.user.id,
            email: session.user.email || null,
            full_name: trimmed,
            phone: session.user.phone || null,
            phone_verified: !!session.user.phone_confirmed_at,
          },
          { onConflict: 'id' }
        );
      } catch (dbErr) {
        console.warn('Profiles upsert warning:', dbErr);
      }

      setUserName(trimmed);
      setNameFeedback({ type: 'success', text: 'Profile name updated successfully.' });
    } catch (err: any) {
      setNameFeedback({ type: 'error', text: err?.message || 'Failed to update profile name.' });
    } finally {
      setSavingName(false);
    }
  };

  const handleSendPasswordReset = async () => {
    const userEmail = session?.user?.email;
    if (!supabase || !userEmail) {
      setResetFeedback({ type: 'error', text: 'No email address associated with this account.' });
      return;
    }

    setResetLoading(true);
    setResetFeedback(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/resetpassword`,
      });
      if (error) throw error;
      setResetFeedback({
        type: 'success',
        text: `Password reset email sent to ${userEmail}.`,
      });
    } catch (err: any) {
      setResetFeedback({
        type: 'error',
        text: err?.message || 'Unable to send password reset email.',
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-5">
      {/* My Profile */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EAF2FF] text-[#2866C7] flex items-center justify-center shrink-0">
            <User size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#263445]">My Profile</h2>
            <p className="text-xs text-[#748197]">Manage your display name and verified contact channels</p>
          </div>
        </div>

        <form onSubmit={handleSaveName} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#748197] mb-1.5">Full Name</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-[#263445] outline-none focus:border-[#2866C7] focus:ring-2 focus:ring-[#2866C7]/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#748197] mb-1.5">Email Address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#748197]" />
                <input
                  type="text"
                  readOnly
                  disabled
                  value={session?.user?.email || 'No email registered'}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-sm text-[#748197] cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {nameFeedback && (
            <div
              className={
                nameFeedback.type === 'success'
                  ? 'p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2'
                  : 'p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2'
              }
            >
              {nameFeedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              <span>{nameFeedback.text}</span>
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs font-mono text-[#748197]">
              Account ID: {session?.user?.id || '—'}
            </span>
            <button
              type="submit"
              disabled={savingName}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2866C7] hover:bg-[#2058A8] text-white text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
            >
              {savingName && <Loader2 size={15} className="animate-spin" />}
              <span>{savingName ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>

        {/* Phone Linking Card */}
        <div className="p-4 rounded-xl border border-slate-200 bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Phone size={18} className="text-[#2866C7] mt-0.5 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#263445]">Phone Authentication</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[#748197]">
                  {userPhoneVerified ? 'Verified' : userPhone ? 'Unverified' : 'Unlinked'}
                </span>
              </div>
              <p className="text-xs text-[#748197] mt-0.5">
                {userPhone ? `Linked number: ${userPhone}` : 'Phone OTP linking is coming soon.'}
              </p>
            </div>
          </div>

          {!userPhone && (
            <button
              type="button"
              onClick={onOpenPhoneComingSoon}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-[#EAF2FF] text-xs font-medium text-[#2866C7] transition-colors shrink-0"
            >
              Link Phone Number
            </button>
          )}
        </div>
      </section>

      {/* Password & Security */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EAF2FF] text-[#2866C7] flex items-center justify-center shrink-0">
            <Lock size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#263445]">Password & Security</h2>
            <p className="text-xs text-[#748197]">Reset your password or review desktop session safety</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-[#F8FAFC] space-y-3">
            <div className="text-sm font-medium text-[#263445]">Password Reset</div>
            <p className="text-xs text-[#748197]">
              Receive a secure password recovery email to update your TrackBook sign-in credentials.
            </p>
            <button
              type="button"
              onClick={handleSendPasswordReset}
              disabled={resetLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2866C7] hover:bg-[#2058A8] text-white text-xs font-medium transition-colors disabled:opacity-60"
            >
              {resetLoading && <Loader2 size={14} className="animate-spin" />}
              <span>{resetLoading ? 'Sending link...' : 'Send Password Reset Email'}</span>
            </button>
            {resetFeedback && (
              <p
                className={
                  resetFeedback.type === 'success' ? 'text-xs text-emerald-600' : 'text-xs text-rose-600'
                }
              >
                {resetFeedback.text}
              </p>
            )}
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-[#F8FAFC] space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-[#263445]">
              <ShieldCheck size={16} className="text-[#21B987]" />
              <span>Desktop Auto-Logout Protection</span>
            </div>
            <p className="text-xs text-[#748197] leading-relaxed">
              Active desktop sessions automatically lock and sign out after 10 minutes of continuous inactivity to keep financial books safe.
            </p>
          </div>
        </div>
      </section>

      {/* Workspace Standards & Cache */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EAF2FF] text-[#2866C7] flex items-center justify-center shrink-0">
            <Wallet size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#263445]">Workspace & Data</h2>
            <p className="text-xs text-[#748197]">Ledger currency format and local sync storage</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-slate-200 bg-[#F8FAFC] space-y-1">
            <p className="text-[#748197]">Accounting Currency & Visual Theme</p>
            <p className="text-sm font-bold text-[#263445]">INR (₹) · Light Blue & White</p>
            <p className="text-[#748197]">Consistent high-contrast ledger styling across all views</p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-[#F8FAFC] flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[#748197]">Synced Local Cache</p>
              <p className="text-sm font-bold text-[#263445]">
                {booksCount} Cashbooks · {entriesCount} Entries
              </p>
            </div>
            <button
              type="button"
              onClick={onClearLocalCache}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 text-xs font-medium text-[#263445] transition-colors shrink-0"
            >
              <Trash2 size={14} />
              <span>Clear Cache</span>
            </button>
          </div>
        </div>
      </section>

      {/* Help & Support + Sign Out */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <section className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF2FF] text-[#2866C7] flex items-center justify-center shrink-0">
              <HelpCircle size={20} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#263445]">Help & Support</h3>
              <p className="text-xs text-[#748197] mt-0.5">
                Open the TrackBook Help assistant or contact support directly.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenHelpModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2866C7] hover:bg-[#2058A8] text-white text-xs font-medium transition-colors"
            >
              <MessageSquare size={14} />
              <span>Open Help Dialog</span>
            </button>
            <a
              href="mailto:triptraccker@gmail.com"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#2866C7] hover:underline"
            >
              <span>triptraccker@gmail.com</span>
              <ArrowRight size={13} />
            </a>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <LogOut size={20} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#263445]">Sign Out</h3>
              <p className="text-xs text-[#748197] mt-0.5">
                End your current authenticated TrackBook session on this device.
              </p>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium transition-colors"
            >
              <LogOut size={14} />
              <span>Logout of TrackBook</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
