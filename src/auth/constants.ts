export const jwtConstants = {
  secret: process.env.JWT_KEY || 'dWhaRFJETW5BTG01Znl1eA==',
};

export const roleAdmin = {
  role: 'RoleAdmin',
  description: 'Role required for managing All other Roles',
  permissions: ['ROLE_EDIT','USER_VIEW','USER_EDIT'],
  isActive: true,
};

export const appPermissions = {
  roleDashboard: 'DASHBOARD',
  roleCrmView: 'CRM_VIEW',
  roleCrmEdit: 'CRM_EDIT',

  roleUserView: 'USER_VIEW',
  roleUserEdit: 'USER_EDIT',

  roleEdit: 'ROLE_EDIT',

  roleTagView: 'TAG_VIEW',
  roleTagEdit: 'TAG_EDIT',

  roleGroupView: 'GROUP_VIEW',
  roleGroupEdit: 'GROUP_EDIT',

  roleMcView: 'MC_VIEW',

  roleEventView: 'EVENT_VIEW',
  roleEventEdit: 'EVENT_EDIT',

  roleReportView: 'REPORT_VIEW',
  roleReportEdit: 'REPORT_EDIT',
};

export const permissionsList = Object.values(appPermissions);
