import useAuthStore from '../store/authStore'

const DEFAULT = {
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canViewFinancials: false,
  canManageUsers: false,
  canViewAuditLogs: false,
  canManageSettings: false,
}

const BY_ROLE = {
  SUPER_ADMIN: {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canViewFinancials: true,
    canManageUsers: true,
    canViewAuditLogs: true,
    canManageSettings: true,
  },
  ADMIN: {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canViewFinancials: true,
    canManageUsers: true,
    canViewAuditLogs: true,
    canManageSettings: true,
  },
  MANAGER: {
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canViewFinancials: true,
    canManageUsers: false,
    canViewAuditLogs: true,
    canManageSettings: false,
  },
  FRONT_DESK: {
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canViewFinancials: false,
    canManageUsers: false,
    canViewAuditLogs: false,
    canManageSettings: false,
  },
  HOUSEKEEPING: {
    canCreate: false,
    canEdit: true,
    canDelete: false,
    canViewFinancials: false,
    canManageUsers: false,
    canViewAuditLogs: false,
    canManageSettings: false,
  },
  MAINTENANCE: {
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canViewFinancials: false,
    canManageUsers: false,
    canViewAuditLogs: false,
    canManageSettings: false,
  },
  VIEWER: {
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canViewFinancials: true,
    canManageUsers: false,
    canViewAuditLogs: true,
    canManageSettings: false,
  },
}

/**
 * Maps JWT user.role to UI capability flags (data-model.md).
 * Backend remains authoritative for authorization.
 */
export function usePermissions() {
  const role = useAuthStore((s) => s.user?.role)
  if (!role || !BY_ROLE[role]) {
    return { ...DEFAULT, role: role ?? null }
  }
  return { ...BY_ROLE[role], role }
}

export default usePermissions
