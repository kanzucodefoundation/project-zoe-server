# Permission System Migration Guide

## Overview

This guide walks through migrating from the current 18-permission system to the simplified 8-permission domain-based system.

## Current vs New Permission Mapping

### Permissions Being Removed (Replaced by Automatic Domain Authority)

| Old Permission | New Behavior |
|----------------|--------------|
| `CRM_VIEW` | Automatic for group leaders |
| `CRM_EDIT` | Automatic for group leaders |
| `REPORT_SUBMIT` | Automatic for group leaders |
| `REPORT_VIEW_SUBMISSIONS` | Automatic for group leaders |
| `EVENT_VIEW` | Automatic for group leaders |
| `EVENT_EDIT` | Automatic for group leaders |
| `GROUP_EDIT` | Automatic for group leaders |
| `MC_VIEW` | Merged into group viewing logic |

### Permissions Being Renamed/Consolidated

| Old Permission | New Permission | Notes |
|----------------|----------------|-------|
| `ROLE_EDIT` | `CONFIG_USERS` | Broader user management |
| `REPORT_EDIT` | `CONFIG_TEMPLATES` | Template configuration |
| `TAG_VIEW` + `TAG_EDIT` | Automatic for group leaders | Scoped to domain |
| `USER_VIEW` + `USER_EDIT` | `CONFIG_USERS` | Administrative function |

### New Permissions

| New Permission | Purpose |
|----------------|---------|
| `SYSTEM_ADMIN` | Full system access |
| `CROSS_DOMAIN_VIEW` | View data across all groups |
| `CROSS_DOMAIN_MANAGE` | Manage data across all groups |
| `GROUP_CREATE_ANY` | Create groups anywhere |
| `GROUP_MANAGE_ANY` | Manage groups without leadership |

## Migration Strategy

### Phase 1: Prepare Backend (Week 1)

#### 1.1 Add New Permission Constants

```typescript
// src/auth/constants.ts - Add alongside existing permissions
export const newAppPermissions = {
  systemAdmin: 'SYSTEM_ADMIN',
  crossDomainView: 'CROSS_DOMAIN_VIEW', 
  crossDomainManage: 'CROSS_DOMAIN_MANAGE',
  configTemplates: 'CONFIG_TEMPLATES',
  configUsers: 'CONFIG_USERS',
  groupCreateAny: 'GROUP_CREATE_ANY',
  groupManageAny: 'GROUP_MANAGE_ANY',
  userRoleAssign: 'USER_ROLE_ASSIGN',
};

// Keep old permissions for backward compatibility during migration
export const legacyPermissions = {
  crmView: 'CRM_VIEW',
  crmEdit: 'CRM_EDIT', 
  // ... rest of current permissions
};
```

#### 1.2 Create Migration Scripts

```typescript
// migrations/permission-system-migration.ts
export class PermissionSystemMigration {
  
  async migrateUserPermissions() {
    console.log('Migrating user permissions...');
    
    // 1. Create new permission roles
    await this.createNewRoles();
    
    // 2. Migrate existing users to new system
    await this.migrateUsers();
    
    // 3. Verify migration
    await this.verifyMigration();
    
    console.log('Migration completed successfully');
  }
  
  private async createNewRoles() {
    const rolesToCreate = [
      {
        name: 'System Administrator',
        permissions: ['SYSTEM_ADMIN'],
        description: 'Full system access'
      },
      {
        name: 'Senior Pastor', 
        permissions: ['CROSS_DOMAIN_VIEW', 'CROSS_DOMAIN_MANAGE', 'CONFIG_USERS', 'CONFIG_TEMPLATES'],
        description: 'Organization-wide access'
      },
      {
        name: 'Ministry Coordinator',
        permissions: ['USER_ROLE_ASSIGN', 'GROUP_CREATE_ANY'],
        description: 'Ministry-level coordination'
      },
      {
        name: 'Group Leader',
        permissions: ['USER_ROLE_ASSIGN'], // Limited scope
        description: 'Group leadership authority'
      }
    ];
    
    for (const role of rolesToCreate) {
      await this.createRole(role);
    }
  }
  
  private async migrateUsers() {
    const usersWithOldPermissions = await this.getUsersWithOldPermissions();
    
    for (const user of usersWithOldPermissions) {
      const newPermissions = this.mapOldToNewPermissions(user.permissions);
      const suggestedRole = this.suggestRole(newPermissions);
      
      console.log(`User ${user.username}: ${user.permissions.join(', ')} -> ${suggestedRole}`);
      
      // Auto-assign if mapping is clear, otherwise log for manual review
      if (this.isClearMapping(user.permissions)) {
        await this.assignUserToRole(user.id, suggestedRole);
      } else {
        console.warn(`Manual review needed for user ${user.username}`);
      }
    }
  }
  
  private mapOldToNewPermissions(oldPermissions: string[]): string[] {
    const mapping = {
      // Users with broad CRM/Report access become cross-domain viewers
      'REPORT_VIEW_SUBMISSIONS': 'CROSS_DOMAIN_VIEW',
      'CRM_VIEW': null, // Becomes automatic via group leadership
      'CRM_EDIT': null, // Becomes automatic via group leadership
      'ROLE_EDIT': 'CONFIG_USERS',
      'REPORT_EDIT': 'CONFIG_TEMPLATES',
      'GROUP_EDIT': null, // Becomes automatic via group leadership
    };
    
    const newPermissions = [];
    
    // If user has administrative permissions, they get system admin
    if (oldPermissions.includes('ROLE_EDIT') && oldPermissions.includes('USER_EDIT')) {
      newPermissions.push('SYSTEM_ADMIN');
    }
    // If user has cross-cutting permissions, they get cross-domain access  
    else if (oldPermissions.includes('REPORT_VIEW_SUBMISSIONS') && oldPermissions.includes('CRM_VIEW')) {
      newPermissions.push('CROSS_DOMAIN_VIEW');
    }
    
    return newPermissions;
  }
  
  private async verifyMigration() {
    // Check that all users still have appropriate access
    const testCases = [
      { userId: 1, expectedRole: 'System Administrator' },
      { userId: 2, expectedRole: 'Senior Pastor' },
      // ... more test cases
    ];
    
    for (const testCase of testCases) {
      const userAccess = await this.checkUserAccess(testCase.userId);
      console.log(`User ${testCase.userId} access verified: ${userAccess.isCorrect}`);
    }
  }
}
```

#### 1.3 Implement Domain Permissions Service

```typescript
// src/auth/domain-permissions.service.ts
@Injectable() 
export class DomainPermissionsService {
  
  async getUserEffectivePermissions(userId: number): Promise<EffectivePermissions> {
    const [explicitPermissions, managedGroups] = await Promise.all([
      this.getExplicitPermissions(userId),
      this.getManagedGroups(userId)
    ]);
    
    return {
      explicit: explicitPermissions,
      managedGroups,
      
      // Computed capabilities
      canViewAllData: this.hasGlobalViewAccess(explicitPermissions),
      canManageAllData: this.hasGlobalManageAccess(explicitPermissions),
      isSystemAdmin: explicitPermissions.includes('SYSTEM_ADMIN'),
      
      // Backward compatibility flags
      legacy: {
        crmView: managedGroups.length > 0 || this.hasGlobalViewAccess(explicitPermissions),
        crmEdit: managedGroups.length > 0 || this.hasGlobalManageAccess(explicitPermissions),
        reportSubmit: managedGroups.length > 0,
        reportViewSubmissions: managedGroups.length > 0 || this.hasGlobalViewAccess(explicitPermissions),
      }
    };
  }
}
```

### Phase 2: Update Backend APIs (Week 2)

#### 2.1 Add Backward Compatibility Layer

```typescript
// src/auth/backward-compatibility.service.ts
@Injectable()
export class BackwardCompatibilityService {
  
  // Translate new permission checks to work with old permission names
  async hasLegacyPermission(userId: number, permission: string): Promise<boolean> {
    const effectivePermissions = await this.domainPermissions.getUserEffectivePermissions(userId);
    
    switch (permission) {
      case 'CRM_VIEW':
        return effectivePermissions.legacy.crmView;
      case 'CRM_EDIT':
        return effectivePermissions.legacy.crmEdit;
      case 'REPORT_SUBMIT':
        return effectivePermissions.legacy.reportSubmit;
      case 'REPORT_VIEW_SUBMISSIONS':
        return effectivePermissions.legacy.reportViewSubmissions;
      case 'EVENT_VIEW':
      case 'EVENT_EDIT':
        return effectivePermissions.managedGroups.length > 0 || effectivePermissions.canManageAllData;
      default:
        // Check explicit permissions for unmapped permissions
        return effectivePermissions.explicit.includes(permission);
    }
  }
}
```

#### 2.2 Update Auth Service

```typescript
// src/auth/auth.service.ts - Enhance buildUserDto
async buildUserDto(user: User): Promise<UserDto> {
  const effectivePermissions = await this.domainPermissions.getUserEffectivePermissions(user.id);
  
  return {
    // ... existing fields
    permissions: [
      ...effectivePermissions.explicit,
      
      // Add legacy permissions for backward compatibility
      ...(effectivePermissions.legacy.crmView ? ['CRM_VIEW'] : []),
      ...(effectivePermissions.legacy.crmEdit ? ['CRM_EDIT'] : []),
      ...(effectivePermissions.legacy.reportSubmit ? ['REPORT_SUBMIT'] : []),
      ...(effectivePermissions.legacy.reportViewSubmissions ? ['REPORT_VIEW_SUBMISSIONS'] : []),
    ]
  };
}
```

### Phase 3: Update Frontend Gradually (Week 3-4)

#### 3.1 Create Permission Adapter

```dart
// lib/services/permission_adapter.dart
class PermissionAdapter {
  static bool hasPermission(User user, Hierarchy hierarchy, String permission, {int? groupId}) {
    // New domain-based logic
    if (_isDomainPermission(permission) && groupId != null) {
      return _checkDomainPermission(user, hierarchy, permission, groupId);
    }
    
    // Fallback to explicit permission check
    return user.permissions.contains(permission);
  }
  
  static bool _isDomainPermission(String permission) {
    return ['CRM_VIEW', 'CRM_EDIT', 'REPORT_SUBMIT', 'REPORT_VIEW_SUBMISSIONS', 
            'EVENT_VIEW', 'EVENT_EDIT'].contains(permission);
  }
  
  static bool _checkDomainPermission(User user, Hierarchy hierarchy, String permission, int groupId) {
    // Check if user can manage this group
    if (hierarchy.canManageGroupIds.contains(groupId)) {
      return true;
    }
    
    // Check global permissions
    if (user.hasPermission('SYSTEM_ADMIN') || user.hasPermission('CROSS_DOMAIN_MANAGE')) {
      return true;
    }
    
    if (permission.contains('VIEW') && user.hasPermission('CROSS_DOMAIN_VIEW')) {
      return true;
    }
    
    return false;
  }
}
```

#### 3.2 Update Components Gradually

```dart
// lib/screens/members_screen.dart - Before migration
class MembersScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, auth, child) {
        // Old way
        if (!auth.user!.permissions.contains('CRM_VIEW')) {
          return UnauthorizedScreen();
        }
        
        return MembersList();
      },
    );
  }
}

// After migration
class MembersScreen extends StatelessWidget {
  final int? groupId;
  
  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, auth, child) {
        // New way with adapter for backward compatibility
        if (!PermissionAdapter.hasPermission(auth.user!, auth.hierarchy!, 'CRM_VIEW', groupId: groupId)) {
          return UnauthorizedScreen();
        }
        
        return MembersList(groupId: groupId);
      },
    );
  }
}
```

### Phase 4: Clean Up (Week 5)

#### 4.1 Remove Backward Compatibility

```typescript
// Remove BackwardCompatibilityService
// Remove legacy permission flags from UserDto
// Clean up permission constants

// Final UserDto structure
export class UserDto extends UserPermissions {
  // Basic fields
  id: number;
  contactId: number;
  username: string;
  email: string;
  fullName: string;
  roles: string[];
  isActive: boolean;
  
  // Clean permission system
  permissions: string[]; // Only the 8 new permissions
}
```

#### 4.2 Update Frontend to Pure New System

```dart
// lib/services/permission_service.dart - Final clean version
class PermissionService {
  final User user;
  final Hierarchy hierarchy;
  
  bool canPerformAction(String feature, String action, {int? groupId}) {
    switch (feature) {
      case 'members':
        return _canAccessMembers(action, groupId);
      case 'reports':
        return _canAccessReports(action, groupId);
      default:
        return false;
    }
  }
  
  bool _canAccessMembers(String action, int? groupId) {
    // Clean, domain-based logic
    if (user.hasPermission('SYSTEM_ADMIN') || user.hasPermission('CROSS_DOMAIN_MANAGE')) {
      return true;
    }
    
    if (groupId != null && hierarchy.canManageGroupIds.contains(groupId)) {
      return true; // Domain authority
    }
    
    return false;
  }
}
```

## Database Migration Scripts

### 1. Add New Permissions

```sql
-- migrations/001_add_new_permissions.sql
INSERT INTO roles (name, description, permissions, is_active) VALUES 
('System Administrator', 'Full system access', '["SYSTEM_ADMIN"]', true),
('Senior Pastor', 'Organization leadership', '["CROSS_DOMAIN_VIEW", "CROSS_DOMAIN_MANAGE", "CONFIG_USERS", "CONFIG_TEMPLATES"]', true),
('Ministry Coordinator', 'Ministry management', '["USER_ROLE_ASSIGN", "GROUP_CREATE_ANY"]', true);
```

### 2. Migrate Existing Users

```sql
-- migrations/002_migrate_users.sql

-- Users with ROLE_EDIT become System Admins
INSERT INTO user_roles (user_id, role_id)
SELECT DISTINCT ur.user_id, (SELECT id FROM roles WHERE name = 'System Administrator')
FROM user_roles ur 
JOIN roles r ON ur.role_id = r.id
WHERE r.permissions::jsonb ? 'ROLE_EDIT';

-- Users with broad permissions become Senior Pastors  
INSERT INTO user_roles (user_id, role_id)
SELECT DISTINCT ur.user_id, (SELECT id FROM roles WHERE name = 'Senior Pastor')
FROM user_roles ur 
JOIN roles r ON ur.role_id = r.id
WHERE r.permissions::jsonb ? 'REPORT_VIEW_SUBMISSIONS'
  AND r.permissions::jsonb ? 'CRM_VIEW'
  AND ur.user_id NOT IN (
    SELECT user_id FROM user_roles WHERE role_id = (SELECT id FROM roles WHERE name = 'System Administrator')
  );

-- Group leaders get Ministry Coordinator if they need role assignment
INSERT INTO user_roles (user_id, role_id) 
SELECT DISTINCT u.id, (SELECT id FROM roles WHERE name = 'Ministry Coordinator')
FROM users u
JOIN group_membership gm ON gm.contact_id = u.contact_id
WHERE gm.role IN ('Leader', 'Admin')
  AND u.id NOT IN (
    SELECT user_id FROM user_roles WHERE role_id IN (
      SELECT id FROM roles WHERE name IN ('System Administrator', 'Senior Pastor')
    )
  );
```

### 3. Clean Up Old Data

```sql
-- migrations/003_cleanup_old_permissions.sql

-- Remove old permission-based roles after migration is verified
DELETE FROM user_roles WHERE role_id IN (
  SELECT id FROM roles WHERE permissions::jsonb ? 'CRM_VIEW'
);

DELETE FROM roles WHERE permissions::jsonb ? 'CRM_VIEW';
```

## Validation & Testing

### 1. Pre-Migration Tests

```typescript
// tests/migration.spec.ts
describe('Permission Migration', () => {
  beforeEach(() => {
    // Set up test data with old permission system
  });
  
  it('should preserve user access after migration', async () => {
    const usersBefore = await getUserAccessMap();
    
    await runMigration();
    
    const usersAfter = await getUserAccessMap();
    
    // Verify each user retains their access
    for (const userId in usersBefore) {
      expect(usersAfter[userId].canViewMembers).toBe(usersBefore[userId].canViewMembers);
      expect(usersAfter[userId].canEditMembers).toBe(usersBefore[userId].canEditMembers);
      // ... other access checks
    }
  });
});
```

### 2. Post-Migration Verification

```bash
#!/bin/bash
# scripts/verify-migration.sh

echo "Verifying permission migration..."

# Check that all users have appropriate access
node scripts/verify-user-access.js

# Check that no permissions were lost
node scripts/verify-no-access-loss.js

# Check that new permission system works
npm run test:permissions

echo "Migration verification complete"
```

## Rollback Plan

### 1. Database Rollback

```sql
-- rollback/001_restore_old_permissions.sql
-- Restore old role structure from backup
-- Restore user_roles from backup
-- Remove new permission roles
```

### 2. Code Rollback

```typescript
// Keep old permission constants available
// Restore old permission checking logic
// Remove new domain permission service
```

## Timeline Summary

- **Week 1**: Backend preparation, migration scripts
- **Week 2**: API updates, backward compatibility
- **Week 3**: Frontend adapter, gradual updates
- **Week 4**: Complete frontend migration  
- **Week 5**: Clean up, remove old system

Total: **5 weeks** for complete migration with minimal disruption to users.