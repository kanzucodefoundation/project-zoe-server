# Permission System Implementation Guide

## Quick Start

This guide shows how to implement the new simplified permission system in your codebase.

## Backend Implementation

### 1. Update Constants

```typescript
// src/auth/constants.ts
export const appPermissions = {
  // System Administration
  systemAdmin: 'SYSTEM_ADMIN',
  
  // Cross-Domain Access
  crossDomainView: 'CROSS_DOMAIN_VIEW',
  crossDomainManage: 'CROSS_DOMAIN_MANAGE',
  
  // Configuration
  configTemplates: 'CONFIG_TEMPLATES',
  configUsers: 'CONFIG_USERS',
  
  // Group Management
  groupCreateAny: 'GROUP_CREATE_ANY',
  groupManageAny: 'GROUP_MANAGE_ANY',
  
  // User Management
  userRoleAssign: 'USER_ROLE_ASSIGN',
};

export const permissionsList = Object.values(appPermissions);
```

### 2. Create Domain Permissions Service

```typescript
// src/auth/domain-permissions.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { Connection } from 'typeorm';

@Injectable()
export class DomainPermissionsService {
  constructor(@Inject('CONNECTION') private connection: Connection) {}
  
  async getAccessibleGroupIds(userId: number): Promise<number[] | null> {
    const userPermissions = await this.getUserPermissions(userId);
    
    // Global access permissions return null (= all groups)
    if (this.hasGlobalAccess(userPermissions)) {
      return null;
    }
    
    // Get groups where user has leadership authority
    const query = `
      SELECT DISTINCT g.id
      FROM groups g
      JOIN group_membership gm ON g.id = gm.group_id
      JOIN users u ON u.contact_id = gm.contact_id
      WHERE u.id = ? AND gm.role IN ('Leader', 'Admin')
    `;
    
    const results = await this.connection.query(query, [userId]);
    return results.map(row => row.id);
  }
  
  async canAccessResource(
    userId: number,
    resourceType: 'member' | 'group' | 'event' | 'report',
    resourceId: number,
    action: 'view' | 'edit' | 'create' | 'delete'
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    
    // Check global permissions
    if (userPermissions.includes('SYSTEM_ADMIN')) return true;
    if (action === 'view' && userPermissions.includes('CROSS_DOMAIN_VIEW')) return true;
    if (action !== 'view' && userPermissions.includes('CROSS_DOMAIN_MANAGE')) return true;
    
    // Check group leadership authority
    const resourceGroupId = await this.getResourceGroupId(resourceType, resourceId);
    const accessibleGroupIds = await this.getAccessibleGroupIds(userId);
    
    if (accessibleGroupIds && accessibleGroupIds.includes(resourceGroupId)) {
      return true; // Domain authority
    }
    
    return false;
  }
  
  private hasGlobalAccess(permissions: string[]): boolean {
    return permissions.includes('SYSTEM_ADMIN') ||
           permissions.includes('CROSS_DOMAIN_VIEW') ||
           permissions.includes('CROSS_DOMAIN_MANAGE');
  }
  
  private async getResourceGroupId(resourceType: string, resourceId: number): Promise<number> {
    let query: string;
    
    switch (resourceType) {
      case 'member':
        query = 'SELECT group_id FROM group_membership WHERE contact_id = ?';
        break;
      case 'group':
        query = 'SELECT id as group_id FROM groups WHERE id = ?';
        break;
      case 'event':
        query = 'SELECT group_id FROM events WHERE id = ?';
        break;
      case 'report':
        query = 'SELECT group_id FROM report_submissions WHERE id = ?';
        break;
      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }
    
    const result = await this.connection.query(query, [resourceId]);
    return result[0]?.group_id;
  }
  
  private async getUserPermissions(userId: number): Promise<string[]> {
    const query = `
      SELECT DISTINCT r.permissions
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE u.id = ? AND r.is_active = true
    `;
    
    const results = await this.connection.query(query, [userId]);
    return results.flatMap(row => row.permissions);
  }
}
```

### 3. Update Auth Service

```typescript
// src/auth/auth.service.ts - Enhance existing buildUserDto method
import { DomainPermissionsService } from './domain-permissions.service';

@Injectable()
export class AuthService {
  constructor(
    // ... existing dependencies
    private domainPermissionsService: DomainPermissionsService,
  ) {}
  
  async buildUserDto(user: User): Promise<UserDto> {
    // Your existing logic for basic user info
    const basicUserDto = {
      id: user.id,
      contactId: user.contactId,
      username: user.username,
      email: user.contact?.person?.email || '',
      fullName: user.contact?.person ? getPersonFullName(user.contact.person) : '',
      isActive: user.isActive,
      roles: await this.getUserRoleNames(user.id),
      permissions: await this.domainPermissionsService.getUserPermissions(user.id),
    };
    
    return basicUserDto;
  }
  
  async buildHierarchyDto(userId: number): Promise<HierarchyDto> {
    const [myGroups, canManageGroupIds, canViewGroupIds] = await Promise.all([
      this.getUserGroups(userId),
      this.domainPermissionsService.getAccessibleGroupIds(userId),
      this.getViewableGroupIds(userId),
    ]);
    
    return {
      myGroups,
      canManageGroupIds: canManageGroupIds || [], // null becomes empty array
      canViewGroupIds: canViewGroupIds || [],
    };
  }
  
  // Your existing login method enhanced
  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    // ... your existing auth logic
    
    const [userDto, hierarchy] = await Promise.all([
      this.buildUserDto(user),
      this.buildHierarchyDto(user.id),
    ]);
    
    return {
      token: this.jwtService.sign({ userId: user.id }),
      user: userDto,
      hierarchy,
    };
  }
}
```

### 4. Create Permission Guard

```typescript
// src/auth/guards/domain-permission.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainPermissionsService } from '../domain-permissions.service';

@Injectable()
export class DomainPermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private domainPermissionsService: DomainPermissionsService,
  ) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<string>('permission', context.getHandler());
    if (!requiredPermission) return true;
    
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const groupId = request.params.groupId || request.body.groupId;
    
    const hasAccess = await this.domainPermissionsService.canAccessResource(
      user.id,
      this.getResourceType(context),
      this.getResourceId(request),
      this.getAction(context)
    );
    
    if (!hasAccess) {
      throw new ForbiddenException('Insufficient permissions for this resource');
    }
    
    return true;
  }
  
  private getResourceType(context: ExecutionContext): string {
    const controller = context.getClass().name;
    if (controller.includes('Member')) return 'member';
    if (controller.includes('Group')) return 'group';
    if (controller.includes('Event')) return 'event';
    if (controller.includes('Report')) return 'report';
    return 'unknown';
  }
  
  private getResourceId(request: any): number {
    return request.params.id || request.params.contactId || request.params.groupId;
  }
  
  private getAction(context: ExecutionContext): string {
    const handler = context.getHandler().name;
    if (handler.includes('create') || handler.includes('post')) return 'create';
    if (handler.includes('update') || handler.includes('put') || handler.includes('patch')) return 'edit';
    if (handler.includes('delete') || handler.includes('remove')) return 'delete';
    return 'view';
  }
}
```

### 5. Update Controllers

```typescript
// Example: src/groups/controllers/group-membership.controller.ts
import { DomainPermissionGuard } from '../../auth/guards/domain-permission.guard';
import { RequirePermission } from '../../auth/decorators/permission.decorator';

@UseGuards(JwtAuthGuard, DomainPermissionGuard)
@ApiTags('Groups Membership')
@Controller('api/groups/member')
export class GroupMembershipController {
  
  @Get()
  @RequirePermission('view') // Automatically scoped to user's accessible groups
  async findAll(@Query() req: GroupMembershipSearchDto, @CurrentUser() user: UserDto) {
    return this.service.findAll(req, user);
  }
  
  @Post()
  @RequirePermission('create')
  async create(@Body() data: BatchGroupMembershipDto, @CurrentUser() user: UserDto) {
    return this.service.create(data, user);
  }
}
```

## Frontend Implementation

### 1. Update User Model

```dart
// lib/models/user.dart
class User {
  final int id;
  final String username;
  final String email;
  final String fullName;
  final List<String> roles;
  final List<String> permissions;
  final bool isActive;
  
  User({
    required this.id,
    required this.username,
    required this.email,
    required this.fullName,
    required this.roles,
    required this.permissions,
    required this.isActive,
  });
  
  // Permission checking methods
  bool hasPermission(String permission) {
    return permissions.contains(permission);
  }
  
  bool get isSystemAdmin => hasPermission('SYSTEM_ADMIN');
  bool get canViewAllData => isSystemAdmin || hasPermission('CROSS_DOMAIN_VIEW');
  bool get canManageAllData => isSystemAdmin || hasPermission('CROSS_DOMAIN_MANAGE');
  bool get canAssignUserRoles => hasPermission('USER_ROLE_ASSIGN');
  bool get canConfigureSystem => hasPermission('CONFIG_TEMPLATES');
  bool get canManageUsers => hasPermission('CONFIG_USERS');
  
  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      username: json['username'],
      email: json['email'],
      fullName: json['fullName'],
      roles: List<String>.from(json['roles'] ?? []),
      permissions: List<String>.from(json['permissions'] ?? []),
      isActive: json['isActive'],
    );
  }
}
```

### 2. Update Hierarchy Model

```dart
// lib/models/hierarchy.dart
class Hierarchy {
  final List<GroupHierarchy> myGroups;
  final List<int> canManageGroupIds;
  final List<int> canViewGroupIds;
  
  Hierarchy({
    required this.myGroups,
    required this.canManageGroupIds,
    required this.canViewGroupIds,
  });
  
  bool canManageGroup(int groupId) {
    return canManageGroupIds.contains(groupId);
  }
  
  bool canViewGroup(int groupId) {
    return canViewGroupIds.contains(groupId);
  }
  
  factory Hierarchy.fromJson(Map<String, dynamic> json) {
    return Hierarchy(
      myGroups: (json['myGroups'] as List)
          .map((group) => GroupHierarchy.fromJson(group))
          .toList(),
      canManageGroupIds: List<int>.from(json['canManageGroupIds'] ?? []),
      canViewGroupIds: List<int>.from(json['canViewGroupIds'] ?? []),
    );
  }
}
```

### 3. Create Permission Service

```dart
// lib/services/permission_service.dart
class PermissionService {
  final User user;
  final Hierarchy hierarchy;
  
  PermissionService({required this.user, required this.hierarchy});
  
  bool canAccess(String action, {int? groupId}) {
    // Check global permissions first
    if (user.isSystemAdmin) return true;
    
    switch (action) {
      case 'view_all_data':
        return user.canViewAllData;
      case 'manage_all_data':
        return user.canManageAllData;
      case 'view_group':
        return groupId != null ? 
          (user.canViewAllData || hierarchy.canViewGroup(groupId)) : 
          user.canViewAllData;
      case 'manage_group':
        return groupId != null ? 
          (user.canManageAllData || hierarchy.canManageGroup(groupId)) : 
          user.canManageAllData;
      default:
        return false;
    }
  }
  
  bool canPerformAction(String feature, String action, {int? groupId}) {
    // Feature-specific permission checking
    switch (feature) {
      case 'members':
        return _canAccessMembers(action, groupId);
      case 'events':
        return _canAccessEvents(action, groupId);
      case 'reports':
        return _canAccessReports(action, groupId);
      case 'groups':
        return _canAccessGroups(action, groupId);
      default:
        return false;
    }
  }
  
  bool _canAccessMembers(String action, int? groupId) {
    switch (action) {
      case 'view':
        return canAccess('view_group', groupId: groupId);
      case 'edit':
      case 'add':
      case 'remove':
        return canAccess('manage_group', groupId: groupId);
      default:
        return false;
    }
  }
  
  bool _canAccessEvents(String action, int? groupId) {
    switch (action) {
      case 'view':
        return canAccess('view_group', groupId: groupId);
      case 'create':
      case 'edit':
      case 'delete':
        return canAccess('manage_group', groupId: groupId);
      default:
        return false;
    }
  }
  
  bool _canAccessReports(String action, int? groupId) {
    switch (action) {
      case 'view':
        return canAccess('view_group', groupId: groupId);
      case 'submit':
      case 'edit':
      case 'delete':
        return canAccess('manage_group', groupId: groupId);
      case 'configure':
        return user.hasPermission('CONFIG_TEMPLATES');
      default:
        return false;
    }
  }
  
  bool _canAccessGroups(String action, int? groupId) {
    switch (action) {
      case 'view':
        return canAccess('view_group', groupId: groupId);
      case 'edit':
        return canAccess('manage_group', groupId: groupId);
      case 'create_anywhere':
        return user.hasPermission('GROUP_CREATE_ANY');
      case 'manage_any':
        return user.hasPermission('GROUP_MANAGE_ANY');
      default:
        return false;
    }
  }
  
  List<int> get accessibleGroupIds {
    if (user.canViewAllData) return []; // Empty list = all groups
    return hierarchy.canViewGroupIds;
  }
  
  List<int> get manageableGroupIds {
    if (user.canManageAllData) return []; // Empty list = all groups
    return hierarchy.canManageGroupIds;
  }
}
```

### 4. Update Auth Provider

```dart
// lib/providers/auth_provider.dart
class AuthProvider extends ChangeNotifier {
  User? _user;
  Hierarchy? _hierarchy;
  PermissionService? _permissionService;
  
  User? get user => _user;
  Hierarchy? get hierarchy => _hierarchy;
  PermissionService? get permissions => _permissionService;
  
  Future<bool> login(String username, String password) async {
    try {
      final response = await authService.login(username, password);
      
      _user = User.fromJson(response['user']);
      _hierarchy = Hierarchy.fromJson(response['hierarchy']);
      _permissionService = PermissionService(user: _user!, hierarchy: _hierarchy!);
      
      notifyListeners();
      return true;
    } catch (e) {
      return false;
    }
  }
  
  bool get isRestricted => !(_user?.canManageAllData ?? false);
  bool get canAddMembers => _permissionService?.canPerformAction('members', 'add') ?? false;
  bool get canSubmitReports => _permissionService?.canPerformAction('reports', 'submit') ?? false;
  bool get canViewReports => _permissionService?.canPerformAction('reports', 'view') ?? false;
  bool get canViewSubmissions => _permissionService?.canPerformAction('reports', 'view') ?? false;
}
```

### 5. Update UI Components

```dart
// lib/screens/members_screen.dart
class MembersScreen extends StatelessWidget {
  final int? groupId;
  
  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, auth, child) {
        final permissions = auth.permissions!;
        
        if (!permissions.canPerformAction('members', 'view', groupId: groupId)) {
          return UnauthorizedScreen();
        }
        
        return Scaffold(
          appBar: AppBar(title: Text('Members')),
          body: MembersList(groupId: groupId),
          floatingActionButton: permissions.canPerformAction('members', 'add', groupId: groupId)
            ? FloatingActionButton(
                onPressed: () => Navigator.push(context, AddMemberRoute()),
                child: Icon(Icons.add),
              )
            : null,
        );
      },
    );
  }
}
```

## Testing

### 1. Backend Tests

```typescript
// src/auth/domain-permissions.service.spec.ts
describe('DomainPermissionsService', () => {
  let service: DomainPermissionsService;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DomainPermissionsService],
    }).compile();
    
    service = module.get<DomainPermissionsService>(DomainPermissionsService);
  });
  
  it('should allow group leaders to access their group resources', async () => {
    const canAccess = await service.canAccessResource(
      1, // userId (group leader)
      'member',
      123, // memberId in their group
      'edit'
    );
    
    expect(canAccess).toBe(true);
  });
  
  it('should deny access to resources outside user domain', async () => {
    const canAccess = await service.canAccessResource(
      1, // userId (group leader)
      'member', 
      456, // memberId in different group
      'edit'
    );
    
    expect(canAccess).toBe(false);
  });
  
  it('should allow system admins access to everything', async () => {
    const canAccess = await service.canAccessResource(
      2, // userId (system admin)
      'member',
      999, // any member
      'delete'
    );
    
    expect(canAccess).toBe(true);
  });
});
```

### 2. Frontend Tests

```dart
// test/services/permission_service_test.dart
void main() {
  group('PermissionService', () {
    late PermissionService permissionService;
    late User testUser;
    late Hierarchy testHierarchy;
    
    setUp(() {
      testUser = User(
        id: 1,
        username: 'test',
        email: 'test@example.com',
        fullName: 'Test User',
        roles: ['Group Leader'],
        permissions: ['USER_ROLE_ASSIGN'],
        isActive: true,
      );
      
      testHierarchy = Hierarchy(
        myGroups: [],
        canManageGroupIds: [10, 11, 12], // Youth groups
        canViewGroupIds: [10, 11, 12, 20], // Youth + some adult groups
      );
      
      permissionService = PermissionService(
        user: testUser,
        hierarchy: testHierarchy,
      );
    });
    
    test('should allow member management in managed groups', () {
      expect(permissionService.canPerformAction('members', 'add', groupId: 10), isTrue);
      expect(permissionService.canPerformAction('members', 'add', groupId: 99), isFalse);
    });
    
    test('should allow report submission in managed groups', () {
      expect(permissionService.canPerformAction('reports', 'submit', groupId: 11), isTrue);
      expect(permissionService.canPerformAction('reports', 'submit', groupId: 99), isFalse);
    });
  });
}
```

This implementation provides a clean, maintainable permission system that leverages your existing user and hierarchy structures while adding powerful domain-based access control.