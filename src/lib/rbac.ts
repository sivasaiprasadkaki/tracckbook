export type Role = 'Primary Admin' | 'Admin' | 'Book Admin' | 'Data Operator' | 'Viewer';

export type InvitationStatus = 'Draft' | 'Sending' | 'Sent' | 'Expired' | 'Accepted' | 'Revoked';

export interface RoleDefinition {
  role: Role;
  title: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  description: string;
  permissions: string[];
  restrictions: string[];
}

export const ALL_ROLES: Role[] = [
  'Primary Admin',
  'Admin',
  'Book Admin',
  'Data Operator',
  'Viewer'
];

export const ROLE_DEFINITIONS: Record<Role, RoleDefinition> = {
  'Primary Admin': {
    role: 'Primary Admin',
    title: 'Primary Admin',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800/60',
    description: 'Complete unrestricted authority over all cashbooks, settings, members, and security.',
    permissions: [
      'View entries and download reports',
      'Add Cash In or Cash Out entries',
      'Edit and delete entries',
      'Access all Book Settings',
      'Move or copy entries between books',
      'Access Book Activity and Entry Edit History',
      'Duplicate and Delete Book',
      'Manage members',
      'Manage roles',
      'Manage permissions',
      'Manage security settings',
      'Manage integrations'
    ],
    restrictions: []
  },
  'Admin': {
    role: 'Admin',
    title: 'Admin',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/40',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeBorder: 'border-blue-200 dark:border-blue-800/60',
    description: 'Full operational access within assigned cashbooks, including entry and member management.',
    permissions: [
      'View entries and download reports',
      'Add Cash In or Cash Out entries',
      'Edit and delete entries',
      'Access Book Settings',
      'Move or copy permitted entries',
      'Access Book Activity and Entry Edit History',
      'Manage members',
      'Change Data Operator / Viewer roles',
      'Download reports'
    ],
    restrictions: [
      'Cannot remove Primary Admin',
      'Cannot change Primary Admin role',
      'Cannot transfer ownership',
      'Cannot perform protected ownership actions'
    ]
  },
  'Book Admin': {
    role: 'Book Admin',
    title: 'Book Admin',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/40',
    badgeText: 'text-purple-700 dark:text-purple-300',
    badgeBorder: 'border-purple-200 dark:border-purple-800/60',
    description: 'Full management over cashbook settings, activity logs, and assigned Data Operators or Viewers.',
    permissions: [
      'Full access to Book Settings and Activity Log',
      'Customize Data Operator permissions',
      'Change Data Operator / Viewer roles',
      'View entries',
      'Download PDF / Excel reports',
      'Manage permitted Cashbook members'
    ],
    restrictions: [
      'Cannot remove Primary Admin',
      'Cannot change Primary Admin',
      'Cannot transfer ownership',
      'Cannot delete the Cashbook'
    ]
  },
  'Data Operator': {
    role: 'Data Operator',
    title: 'Data Operator',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-200 dark:border-amber-800/60',
    description: 'Operational role responsible for logging new transactions and viewing cashbook status.',
    permissions: [
      'Add Cash In / Cash Out entries',
      'View entries',
      'View net balance',
      'Download PDF / Excel reports'
    ],
    restrictions: [
      'Cannot edit entries',
      'Cannot delete entries',
      'Cannot change roles',
      'Cannot manage members',
      'Cannot modify Cashbook settings',
      'Cannot manage security'
    ]
  },
  'Viewer': {
    role: 'Viewer',
    title: 'Viewer',
    badgeBg: 'bg-slate-100 dark:bg-zinc-800',
    badgeText: 'text-slate-700 dark:text-zinc-300',
    badgeBorder: 'border-slate-200 dark:border-zinc-700',
    description: 'Read-only access to view cashbook transactions, net balance, and download generated reports.',
    permissions: [
      'View entries',
      'View net balance',
      'Download PDF / Excel reports'
    ],
    restrictions: [
      'Cannot add entries',
      'Cannot edit entries',
      'Cannot delete entries',
      'Cannot manage members',
      'Cannot change roles',
      'Cannot modify Cashbook settings'
    ]
  }
};

// Centralized permission check functions
export const canViewEntries = (_role: Role | string): boolean => {
  return true; // All roles can view entries
};

export const canAddEntries = (role: Role | string): boolean => {
  return role === 'Primary Admin' || role === 'Admin' || role === 'Book Admin' || role === 'Data Operator';
};

export const canEditEntries = (role: Role | string): boolean => {
  return role === 'Primary Admin' || role === 'Admin';
};

export const canDeleteEntries = (role: Role | string): boolean => {
  return role === 'Primary Admin' || role === 'Admin';
};

export const canDownloadReports = (_role: Role | string): boolean => {
  return true; // All roles can download PDF/Excel reports
};

export const canAccessBookSettings = (role: Role | string): boolean => {
  return role === 'Primary Admin' || role === 'Admin' || role === 'Book Admin';
};

export const canMoveEntries = (role: Role | string): boolean => {
  return role === 'Primary Admin' || role === 'Admin';
};

export const canViewActivity = (role: Role | string): boolean => {
  return role === 'Primary Admin' || role === 'Admin' || role === 'Book Admin';
};

export const canManageMembers = (role: Role | string): boolean => {
  return role === 'Primary Admin' || role === 'Admin' || role === 'Book Admin';
};

export const canManageRoles = (actorRole: Role | string, targetCurrentRole?: Role | string, targetNewRole?: Role | string): boolean => {
  if (actorRole === 'Primary Admin') return true;
  if (targetCurrentRole === 'Primary Admin' || targetNewRole === 'Primary Admin') return false; // Non-Primary Admins cannot touch or assign Primary Admin

  if (actorRole === 'Admin') {
    // Admin can change roles of Book Admin, Data Operator, and Viewer
    return targetCurrentRole !== 'Admin'; 
  }

  if (actorRole === 'Book Admin') {
    // Book Admin can only change Data Operator or Viewer roles
    return (targetCurrentRole === 'Data Operator' || targetCurrentRole === 'Viewer') &&
           (targetNewRole === 'Data Operator' || targetNewRole === 'Viewer');
  }

  return false;
};

export const canDeleteBook = (role: Role | string): boolean => {
  return role === 'Primary Admin'; // Only Primary Admin can delete cashbooks
};

export const canManageSecurity = (role: Role | string): boolean => {
  return role === 'Primary Admin';
};

export interface CashbookMember {
  id: string;
  cashbook_id: string;
  user_id: string;
  name: string;
  email: string;
  role: Role;
  status: 'Active' | 'Pending' | 'Inactive';
  invitation_status?: InvitationStatus;
  created_at: string;
  updated_at?: string;
}

export interface AuditLogItem {
  id: string;
  cashbook_id: string;
  actor_user_id: string;
  actor_name: string;
  actor_email: string;
  target_user_id?: string;
  target_name?: string;
  target_email?: string;
  action: 'ROLE_CHANGED' | 'MEMBER_INVITED' | 'MEMBER_REMOVED' | 'PERMISSION_UPDATED';
  old_role?: Role;
  new_role?: Role;
  details?: string;
  created_at: string;
}
