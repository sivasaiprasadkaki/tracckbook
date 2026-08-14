import React, { useState } from 'react';
import { 
  X, 
  Check, 
  ShieldAlert, 
  ShieldCheck, 
  Info,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, vibrate } from '../lib/utils';
import { Role, ALL_ROLES, ROLE_DEFINITIONS } from '../lib/rbac';

interface RolesPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  initialRole?: Role;
}

export default function RolesPermissionsModal({
  isOpen,
  onClose,
  theme,
  initialRole = 'Primary Admin'
}: RolesPermissionsModalProps) {
  const [selectedRole, setSelectedRole] = useState<Role>(initialRole);

  if (!isOpen) return null;

  const roleDef = ROLE_DEFINITIONS[selectedRole];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 10 }}
          className={cn(
            "relative w-full max-w-3xl rounded-xl border shadow-2xl overflow-hidden z-10 flex flex-col my-auto transition-colors duration-200 max-h-[90vh]",
            theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900"
          )}
        >
          {/* Header */}
          <div className={cn(
            "flex items-center justify-between p-5 sm:p-6 border-b shrink-0",
            theme === 'dark' ? "border-zinc-850 bg-zinc-900/50" : "border-zinc-150 bg-zinc-50/50"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className={cn("text-lg font-bold tracking-tight", theme === 'dark' ? "text-zinc-100" : "text-zinc-900")}>
                  Roles & Permissions
                </h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                  Select a role below to review its precise capabilities and operational restrictions.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className={cn(
                "p-2 rounded-lg border transition-colors cursor-pointer text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200",
                theme === 'dark' ? "border-zinc-800 hover:bg-zinc-900" : "border-zinc-200 hover:bg-zinc-100"
              )}
            >
              <X size={18} />
            </button>
          </div>

          {/* Top Role Selector Chips / Tabs */}
          <div className={cn(
            "p-4 border-b flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0",
            theme === 'dark' ? "bg-zinc-950 border-zinc-850" : "bg-zinc-50/30 border-zinc-150"
          )}>
            {ALL_ROLES.map((role) => {
              const isSelected = selectedRole === role;
              return (
                <button
                  key={role}
                  onClick={() => {
                    vibrate(10);
                    setSelectedRole(role);
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 border flex items-center gap-1.5 whitespace-nowrap",
                    isSelected
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : theme === 'dark'
                        ? "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
                        : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:text-zinc-800"
                  )}
                >
                  <span>{role}</span>
                </button>
              );
            })}
          </div>

          {/* Main Role Content View */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
            {/* Role Header Banner */}
            <div className={cn(
              "p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3",
              roleDef.badgeBg,
              roleDef.badgeBorder
            )}>
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-base font-extrabold", roleDef.badgeText)}>
                    {roleDef.title}
                  </span>
                  <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border", roleDef.badgeBg, roleDef.badgeText, roleDef.badgeBorder)}>
                    Enterprise Role
                  </span>
                </div>
                <p className={cn("text-xs font-medium mt-1 leading-relaxed opacity-90", roleDef.badgeText)}>
                  {roleDef.description}
                </p>
              </div>
            </div>

            {/* Grid of Permissions & Restrictions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* PERMISSIONS SECTION */}
              <div className={cn(
                "p-5 rounded-xl border space-y-3.5",
                theme === 'dark' ? "bg-zinc-900/40 border-zinc-850" : "bg-emerald-50/20 border-emerald-100"
              )}>
                <div className="flex items-center gap-2 pb-2 border-b border-emerald-500/20">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Check size={13} strokeWidth={3} />
                  </div>
                  <h4 className={cn("text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400")}>
                    Permissions ({roleDef.permissions.length})
                  </h4>
                </div>

                <div className="space-y-2.5">
                  {roleDef.permissions.map((perm, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs font-semibold leading-relaxed">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] shrink-0 mt-0.5 font-bold">
                        ✓
                      </span>
                      <span className={theme === 'dark' ? "text-zinc-200" : "text-zinc-800"}>
                        {perm}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* RESTRICTIONS SECTION */}
              <div className={cn(
                "p-5 rounded-xl border space-y-3.5",
                theme === 'dark' ? "bg-zinc-900/40 border-zinc-850" : "bg-rose-50/20 border-rose-100"
              )}>
                <div className="flex items-center gap-2 pb-2 border-b border-rose-500/20">
                  <div className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
                    <X size={13} strokeWidth={3} />
                  </div>
                  <h4 className={cn("text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400")}>
                    Restrictions ({roleDef.restrictions.length})
                  </h4>
                </div>

                {roleDef.restrictions.length > 0 ? (
                  <div className="space-y-2.5">
                    {roleDef.restrictions.map((restr, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs font-semibold leading-relaxed">
                        <span className="w-4 h-4 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center text-[10px] shrink-0 mt-0.5 font-bold">
                          ✗
                        </span>
                        <span className={theme === 'dark' ? "text-zinc-300" : "text-zinc-700"}>
                          {restr}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
                    <Info size={15} />
                    <span>No restrictions. Primary Admin has full unrestricted control across all cashbooks.</span>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className={cn(
            "p-4 border-t flex items-center justify-between shrink-0 text-xs font-medium",
            theme === 'dark' ? "border-zinc-850 bg-zinc-900/60 text-zinc-400" : "border-zinc-150 bg-zinc-50/60 text-zinc-600"
          )}>
            <div className="flex items-center gap-1.5 text-[11px]">
              <Info size={14} className="text-emerald-500" />
              <span>Permissions are enforced per cashbook and verified on both client and server API.</span>
            </div>

            <button
              onClick={onClose}
              className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              Close View
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
