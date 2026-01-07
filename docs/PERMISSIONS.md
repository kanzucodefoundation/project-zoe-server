# Permission System Documentation

## Overview

Project Zoe uses a simplified, domain-based permission system that combines explicit permissions with automatic group leadership authority. The system is designed around the principle: **"If you lead a group, you automatically control everything within that group and its sub-groups."**

## Core Philosophy

- **Group Leadership = Domain Authority**: Leaders automatically get full control over their groups
- **Explicit Permissions for Edge Cases**: Global permissions for cross-domain access and system administration
- **Single Source of Truth**: All permission information is included in the auth response

## Permission Structure

### 1. Simplified Permission List (8 Total)

```typescript
export const appPermissions = {
  // System Administration
  systemAdmin: 'SYSTEM_ADMIN',          // Full system access

  // Cross-Domain Data Access  
  crossDomainView: 'CROSS_DOMAIN_VIEW', // View data across all groups
  crossDomainManage: 'CROSS_DOMAIN_MANAGE', // Manage data across all groups

  // Configuration Management
  configTemplates: 'CONFIG_TEMPLATES',   // Manage report templates, event types, etc.
  configUsers: 'CONFIG_USERS',           // Manage user roles and assignments

  // Group Management
  groupCreateAny: 'GROUP_CREATE_ANY',    // Create groups anywhere (not just sub-groups)
  groupManageAny: 'GROUP_MANAGE_ANY',    // Manage groups you don't lead

  // Special Features
  userRoleAssign: 'USER_ROLE_ASSIGN',    // Assign system roles to users
};
```

### 2. Automatic Group Leadership Powers

If you're a **Leader** or **Admin** of a group, you automatically get these capabilities for your group + all sub-groups:

#### People Management
- View all members (`CRM_VIEW` equivalent)
- Edit member information (`CRM_EDIT` equivalent)  
- Add new members
- Remove members
- Promote/demote members within the group
- Assign user roles (if you have `USER_ROLE_ASSIGN` permission)

#### Group Management  
- Edit group settings (name, description, meeting times, etc.)
- Create sub-groups under your group
- Archive/deactivate sub-groups
- Manage group hierarchy

#### Event Management
- View all events in your domain (`EVENT_VIEW` equivalent)
- Create events for your groups (`EVENT_CREATE` equivalent)
- Edit events in your domain (`EVENT_EDIT` equivalent)
- Manage event attendance

#### Reporting
- Submit reports for your groups (`REPORT_SUBMIT` equivalent)
- View all report submissions from your domain (`REPORT_VIEW_SUBMISSIONS` equivalent)
- Edit/modify report submissions from your groups
- Export report data for your domain

#### Basic Features  
- Domain-scoped dashboard access
- View and manage tags within your domain

## Data Structures

### User Object (Auth Response)

```typescript
export interface UserDto {
  // Basic user information
  id: number;
  contactId: number;
  username: string;
  email: string;
  fullName: string;
  roles: string[];
  isActive: boolean;
  
  // Permission system
  permissions: string[];  // Explicit permissions only
}

export interface LoginResponseDto {
  token: string;
  user: UserDto;
  hierarchy: HierarchyDto;  // Contains group access information
}

export interface HierarchyDto {
  myGroups: GroupHierarchyDto[];    // Groups user belongs to
  canManageGroupIds: number[];      // Groups user can manage (Leader/Admin)
  canViewGroupIds: number[];        // Groups user can view
}
```

## Permission Checking Logic

### Backend Permission Validation

```typescript
class PermissionsService {
  async canAccessResource(
    userId: number,
    resourceType: 'member' | 'group' | 'event' | 'report',
    resourceId: number,
    action: 'view' | 'edit' | 'create' | 'delete'
  ): Promise<boolean> {
    
    const user = await this.getUserWithHierarchy(userId);
    
    // 1. Check explicit global permissions first
    if (user.permissions.includes('SYSTEM_ADMIN')) return true;
    if (action === 'view' && user.permissions.includes('CROSS_DOMAIN_VIEW')) return true;
    if (action !== 'view' && user.permissions.includes('CROSS_DOMAIN_MANAGE')) return true;
    
    // 2. Check group leadership authority
    const resourceGroupId = await this.getResourceGroupId(resourceType, resourceId);
    if (user.hierarchy.canManageGroupIds.includes(resourceGroupId)) {
      return true; // Automatic domain authority
    }
    
    return false;
  }
}
```

### Frontend Permission Checking

```dart
class User {
  final List<String> permissions;
  final Hierarchy hierarchy;
  
  bool canAccess(String action, {int? groupId}) {
    // Check global permissions
    if (permissions.contains('SYSTEM_ADMIN')) return true;
    if (action == 'view' && permissions.contains('CROSS_DOMAIN_VIEW')) return true;
    if (action != 'view' && permissions.contains('CROSS_DOMAIN_MANAGE')) return true;
    
    // Check group leadership
    if (groupId != null && hierarchy.canManageGroupIds.contains(groupId)) {
      return true;
    }
    
    return false;
  }
  
  // Convenience methods
  bool get isSystemAdmin => permissions.contains('SYSTEM_ADMIN');
  bool get canViewAllData => isSystemAdmin || permissions.contains('CROSS_DOMAIN_VIEW');
  bool get canAssignUserRoles => permissions.contains('USER_ROLE_ASSIGN');
  
  List<int> get managedGroupIds => hierarchy.canManageGroupIds;
  List<int> get viewableGroupIds => hierarchy.canViewGroupIds;
}
```

## Common Use Cases

### Small Group Leader
**Automatic Powers:**
- Full control over "Small Group Alpha" 
- Can add/remove members, submit reports, create events
- Can view all data related to their group

**Explicit Permissions:** None needed for basic group leadership

**Example:** John leads a youth small group. He can automatically manage all aspects of his group without any explicit permissions.

### Ministry Coordinator
**Automatic Powers:**
- Full control over "Youth Ministry" + all youth small groups
- Can manage members across youth hierarchy
- Can submit/view reports for all youth groups

**Explicit Permissions:** 
- `USER_ROLE_ASSIGN` - to assign Youth Leader roles to members
- `GROUP_CREATE_ANY` - to create new top-level groups

**Example:** Sarah coordinates youth ministry. She can manage all youth groups and assign youth leadership roles.

### Senior Pastor
**Automatic Powers:**
- Control over groups they directly lead

**Explicit Permissions:**
- `SYSTEM_ADMIN` - full system access
- Or specific permissions like `CROSS_DOMAIN_VIEW`, `CONFIG_USERS`, etc.

**Example:** Pastor Mike can see organization-wide reports and manage any group in the system.

## API Implementation

### Automatic Data Scoping

All API endpoints automatically scope data based on user permissions and group access:

```typescript
@Get('/api/members')
async getMembers(@Query() filter: any, @CurrentUser() user: UserDto) {
  // Automatically scope to user's accessible groups
  const accessibleGroupIds = await this.permissionsService.getAccessibleGroupIds(user.id);
  
  if (accessibleGroupIds) {
    filter.groupIds = accessibleGroupIds;
  }
  // If null, user has global access - no filtering needed
  
  return this.membersService.findMembers(filter);
}
```

### Permission-Aware Responses

Responses include permission context when useful:

```typescript
@Get('/api/groups/:id/members')
async getGroupMembers(@Param('id') groupId: number, @CurrentUser() user: UserDto) {
  const members = await this.membersService.findByGroup(groupId);
  const canManage = await this.permissionsService.canAccessResource(
    user.id, 'member', members[0]?.id, 'edit'
  );
  
  return {
    members,
    permissions: {
      canAddMembers: canManage,
      canEditMembers: canManage,
      canAssignRoles: user.permissions.includes('USER_ROLE_ASSIGN') && canManage,
    }
  };
}
```

## Migration from Previous System

### Phase 1: Backend Updates
1. Implement new `PermissionsService` with domain-aware logic
2. Update all API endpoints to use automatic scoping
3. Maintain backward compatibility with existing permission checks

### Phase 2: Frontend Updates  
1. Update permission checking logic to use new `canAccess()` methods
2. Leverage existing `hierarchy` data for group-based access
3. Remove complex permission matrices in favor of simple boolean checks

### Phase 3: Permission Cleanup
1. Remove redundant explicit permissions that are now covered by group leadership
2. Consolidate similar permissions into the simplified set
3. Update role definitions to use new permission structure

## Security Considerations

### Principle of Least Privilege
- Users only get minimum required permissions
- Group leadership automatically grants appropriate domain access
- Explicit permissions only for cross-domain or administrative needs

### Audit Trail
- All permission assignments and group role changes are logged
- Clear attribution for who granted what access
- Regular permission audits to ensure appropriate access levels

### Validation Rules
- Users cannot assign roles higher than their own level
- Group leaders can only manage their actual organizational scope
- System administrators have separate controls for global access

### Data Protection
- Automatic scoping prevents accidental data exposure
- Group boundaries enforce organizational privacy
- Clear separation between domain access and global permissions

## Troubleshooting

### Common Issues

**User can't see expected data:**
1. Check if they're a leader of the relevant group
2. Verify group hierarchy relationships
3. Check for required explicit permissions for cross-domain access

**User has too much access:**
1. Review their group leadership roles
2. Check for unintended explicit permissions
3. Verify group hierarchy doesn't grant broader access than expected

**Permission denied errors:**
1. Confirm user has appropriate group leadership or explicit permissions
2. Check that resource belongs to user's accessible groups
3. Verify API endpoint is using correct permission checking logic

### Debugging Tools

```typescript
// Backend: Debug user's effective permissions
@Get('/api/debug/permissions')
async debugPermissions(@CurrentUser() user: UserDto) {
  return {
    explicitPermissions: user.permissions,
    managedGroups: user.hierarchy.canManageGroupIds,
    viewableGroups: user.hierarchy.canViewGroupIds,
    computedCapabilities: {
      isSystemAdmin: user.permissions.includes('SYSTEM_ADMIN'),
      canViewAllData: this.permissionsService.canViewAllData(user),
      canManageAllData: this.permissionsService.canManageAllData(user),
    }
  };
}
```

## Best Practices

### For Administrators
- Assign group leadership roles rather than explicit permissions when possible
- Use explicit permissions sparingly for cross-domain access only
- Regularly audit group leadership to ensure appropriate access
- Document any non-standard permission assignments

### For Developers
- Always use `PermissionsService` for access control decisions
- Leverage automatic scoping in API endpoints
- Include permission context in API responses when helpful
- Test permission logic with different user role combinations

### For System Design
- Align group hierarchy with organizational structure
- Keep permission checks simple and readable
- Use group leadership as primary access control mechanism
- Reserve explicit permissions for exceptional cases only