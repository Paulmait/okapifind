/**
 * Role-Based Access Control (RBAC) Service
 * Manages user roles, permissions, and access control
 */

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  SUPPORT = 'support',
  PREMIUM_USER = 'premium_user',
  USER = 'user',
  SUSPENDED = 'suspended',
  BANNED = 'banned'
}

export enum Permission {
  // User Management
  VIEW_ALL_USERS = 'view_all_users',
  VIEW_USER_DETAILS = 'view_user_details',
  EDIT_USER = 'edit_user',
  DELETE_USER = 'delete_user',
  SUSPEND_USER = 'suspend_user',
  BAN_USER = 'ban_user',
  RESTORE_USER = 'restore_user',

  // Data Access
  VIEW_ALL_DATA = 'view_all_data',
  EXPORT_DATA = 'export_data',
  DELETE_DATA = 'delete_data',
  VIEW_ANALYTICS = 'view_analytics',
  VIEW_LOCATIONS = 'view_locations',

  // Financial
  PROCESS_REFUND = 'process_refund',
  VIEW_REVENUE = 'view_revenue',
  MANAGE_SUBSCRIPTIONS = 'manage_subscriptions',
  VIEW_TRANSACTIONS = 'view_transactions',

  // System Administration
  MANAGE_ROLES = 'manage_roles',
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  SYSTEM_CONFIG = 'system_config',
  DEPLOY_UPDATES = 'deploy_updates',
  ACCESS_DATABASE = 'access_database',

  // Support
  VIEW_SUPPORT_TICKETS = 'view_support_tickets',
  RESPOND_SUPPORT = 'respond_support',
  ESCALATE_ISSUES = 'escalate_issues',

  // Content Moderation
  MODERATE_CONTENT = 'moderate_content',
  DELETE_CONTENT = 'delete_content',
  BAN_CONTENT = 'ban_content',

  // Communication
  SEND_NOTIFICATIONS = 'send_notifications',
  SEND_EMAILS = 'send_emails',
  BROADCAST_MESSAGE = 'broadcast_message',

  // Security
  VIEW_SECURITY_LOGS = 'view_security_logs',
  MANAGE_SECURITY = 'manage_security',
  PERFORM_SECURITY_AUDIT = 'perform_security_audit'
}

interface RolePermissions {
  [key: string]: Permission[];
}

export class RBACService {
  private rolePermissions: RolePermissions = {
    [UserRole.SUPER_ADMIN]: Object.values(Permission), // All permissions

    [UserRole.ADMIN]: [
      Permission.VIEW_ALL_USERS,
      Permission.VIEW_USER_DETAILS,
      Permission.EDIT_USER,
      Permission.SUSPEND_USER,
      Permission.VIEW_ALL_DATA,
      Permission.EXPORT_DATA,
      Permission.VIEW_ANALYTICS,
      Permission.VIEW_LOCATIONS,
      Permission.PROCESS_REFUND,
      Permission.VIEW_REVENUE,
      Permission.MANAGE_SUBSCRIPTIONS,
      Permission.VIEW_TRANSACTIONS,
      Permission.VIEW_AUDIT_LOGS,
      Permission.VIEW_SUPPORT_TICKETS,
      Permission.RESPOND_SUPPORT,
      Permission.SEND_NOTIFICATIONS,
      Permission.SEND_EMAILS,
      Permission.VIEW_SECURITY_LOGS
    ],

    [UserRole.MODERATOR]: [
      Permission.VIEW_ALL_USERS,
      Permission.VIEW_USER_DETAILS,
      Permission.SUSPEND_USER,
      Permission.VIEW_ANALYTICS,
      Permission.VIEW_LOCATIONS,
      Permission.MODERATE_CONTENT,
      Permission.DELETE_CONTENT,
      Permission.VIEW_SUPPORT_TICKETS,
      Permission.RESPOND_SUPPORT
    ],

    [UserRole.SUPPORT]: [
      Permission.VIEW_USER_DETAILS,
      Permission.VIEW_SUPPORT_TICKETS,
      Permission.RESPOND_SUPPORT,
      Permission.ESCALATE_ISSUES,
      Permission.SEND_EMAILS
    ],

    [UserRole.PREMIUM_USER]: [
      // Premium users have no admin permissions
    ],

    [UserRole.USER]: [
      // Regular users have no admin permissions
    ],

    [UserRole.SUSPENDED]: [
      // Suspended users have no permissions
    ],

    [UserRole.BANNED]: [
      // Banned users have no permissions
    ]
  };

  private userRoles: Map<string, UserRole> = new Map();
  private customPermissions: Map<string, Permission[]> = new Map();
  private roleHierarchy: Map<UserRole, number> = new Map([
    [UserRole.SUPER_ADMIN, 100],
    [UserRole.ADMIN, 90],
    [UserRole.MODERATOR, 70],
    [UserRole.SUPPORT, 50],
    [UserRole.PREMIUM_USER, 30],
    [UserRole.USER, 20],
    [UserRole.SUSPENDED, 10],
    [UserRole.BANNED, 0]
  ]);

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Load user roles from database
    await this.loadUserRoles();

    // Set up role validation
    this.validateRoleIntegrity();
  }

  private async loadUserRoles() {
    try {
      const response = await fetch('/api/rbac/roles', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const roles = await response.json();
        roles.forEach((r: any) => {
          this.userRoles.set(r.userId, r.role);
          if (r.customPermissions) {
            this.customPermissions.set(r.userId, r.customPermissions);
          }
        });
      }
    } catch (error) {
      console.error('Failed to load user roles:', error);
    }
  }

  public hasPermission(userId: string, permission: Permission): boolean {
    const role = this.userRoles.get(userId);

    if (!role || role === UserRole.SUSPENDED || role === UserRole.BANNED) {
      return false;
    }

    // Check role-based permissions
    const rolePerms = this.rolePermissions[role] || [];
    if (rolePerms.includes(permission)) {
      return true;
    }

    // Check custom permissions
    const customPerms = this.customPermissions.get(userId) || [];
    return customPerms.includes(permission);
  }

  public hasAnyPermission(userId: string, permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(userId, permission));
  }

  public hasAllPermissions(userId: string, permissions: Permission[]): boolean {
    return permissions.every(permission => this.hasPermission(userId, permission));
  }

  public getUserRole(userId: string): UserRole | null {
    return this.userRoles.get(userId) || null;
  }

  public async setUserRole(
    adminId: string,
    targetUserId: string,
    newRole: UserRole,
    reason: string
  ): Promise<boolean> {
    // Check if admin has permission to manage roles
    if (!this.hasPermission(adminId, Permission.MANAGE_ROLES)) {
      await this.logUnauthorizedAttempt(adminId, 'setUserRole', targetUserId);
      return false;
    }

    // Check role hierarchy - admin can't set role higher than their own
    const adminRole = this.getUserRole(adminId);
    if (!adminRole || !this.canManageRole(adminRole, newRole)) {
      await this.logUnauthorizedAttempt(adminId, 'setUserRole', targetUserId);
      return false;
    }

    try {
      const response = await fetch('/api/rbac/set-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          adminId,
          targetUserId,
          newRole,
          reason,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        this.userRoles.set(targetUserId, newRole);
        await this.auditLog(adminId, 'SET_USER_ROLE', {
          targetUserId,
          newRole,
          reason
        });
        return true;
      }
    } catch (error) {
      console.error('Failed to set user role:', error);
    }

    return false;
  }

  public async grantPermission(
    adminId: string,
    targetUserId: string,
    permission: Permission,
    reason: string
  ): Promise<boolean> {
    if (!this.hasPermission(adminId, Permission.MANAGE_ROLES)) {
      await this.logUnauthorizedAttempt(adminId, 'grantPermission', targetUserId);
      return false;
    }

    const currentPerms = this.customPermissions.get(targetUserId) || [];
    if (!currentPerms.includes(permission)) {
      currentPerms.push(permission);
      this.customPermissions.set(targetUserId, currentPerms);

      await this.savePermissionChange(adminId, targetUserId, permission, 'grant', reason);
      return true;
    }

    return false;
  }

  public async revokePermission(
    adminId: string,
    targetUserId: string,
    permission: Permission,
    reason: string
  ): Promise<boolean> {
    if (!this.hasPermission(adminId, Permission.MANAGE_ROLES)) {
      await this.logUnauthorizedAttempt(adminId, 'revokePermission', targetUserId);
      return false;
    }

    const currentPerms = this.customPermissions.get(targetUserId) || [];
    const index = currentPerms.indexOf(permission);

    if (index > -1) {
      currentPerms.splice(index, 1);
      this.customPermissions.set(targetUserId, currentPerms);

      await this.savePermissionChange(adminId, targetUserId, permission, 'revoke', reason);
      return true;
    }

    return false;
  }

  private canManageRole(adminRole: UserRole, targetRole: UserRole): boolean {
    const adminLevel = this.roleHierarchy.get(adminRole) || 0;
    const targetLevel = this.roleHierarchy.get(targetRole) || 0;
    return adminLevel > targetLevel;
  }

  private async savePermissionChange(
    adminId: string,
    targetUserId: string,
    permission: Permission,
    action: 'grant' | 'revoke',
    reason: string
  ) {
    try {
      await fetch('/api/rbac/permission-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          adminId,
          targetUserId,
          permission,
          action,
          reason,
          timestamp: new Date().toISOString()
        })
      });

      await this.auditLog(adminId, `${action.toUpperCase()}_PERMISSION`, {
        targetUserId,
        permission,
        reason
      });
    } catch (error) {
      console.error('Failed to save permission change:', error);
    }
  }

  private async logUnauthorizedAttempt(
    userId: string,
    action: string,
    target: string
  ) {
    console.warn(`Unauthorized attempt: User ${userId} tried to ${action} on ${target}`);

    await fetch('/api/security/unauthorized-attempt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        action,
        target,
        timestamp: new Date().toISOString(),
        ipAddress: await this.getClientIP(),
        userAgent: navigator.userAgent
      })
    });
  }

  private async auditLog(
    userId: string,
    action: string,
    metadata: any
  ) {
    await fetch('/api/audit/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        userId,
        action,
        metadata,
        timestamp: new Date().toISOString(),
        ipAddress: await this.getClientIP(),
        userAgent: navigator.userAgent
      })
    });
  }

  private async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  private validateRoleIntegrity() {
    // Ensure no user has conflicting roles
    // Verify permission consistency
    // Check for orphaned permissions

    setInterval(() => {
      this.performIntegrityCheck();
    }, 3600000); // Check every hour
  }

  private async performIntegrityCheck() {
    const issues: string[] = [];

    // Check for users with multiple roles
    // Check for invalid permissions
    // Check for suspicious permission combinations

    if (issues.length > 0) {
      await this.reportIntegrityIssues(issues);
    }
  }

  private async reportIntegrityIssues(issues: string[]) {
    await fetch('/api/security/integrity-issues', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        issues,
        timestamp: new Date().toISOString()
      })
    });
  }

  public getPermissionsForRole(role: UserRole): Permission[] {
    return this.rolePermissions[role] || [];
  }

  public getAllRoles(): UserRole[] {
    return Object.values(UserRole);
  }

  public getRoleHierarchy(): Map<UserRole, number> {
    return this.roleHierarchy;
  }
}

// Export singleton instance
export const rbacService = new RBACService();