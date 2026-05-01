export const jwtConstants = {
  secret: process.env.JWT_KEY || 'dWhaRFJETW5BTG01Znl1eA==',
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

  roleSmallGroupView: 'MC_VIEW',

  roleEventView: 'EVENT_VIEW',
  roleEventEdit: 'EVENT_EDIT',

  roleReportView: 'REPORT_VIEW',
  roleReportViewSubmissions: 'REPORT_VIEW_SUBMISSIONS',

  manageHelp: 'MANAGE_HELP',

  roleFinanceView: 'FINANCE_VIEW',
  roleFinanceEdit: 'FINANCE_EDIT',

  roleTaskView: 'TASK_VIEW',
  roleTaskEdit: 'TASK_EDIT',

  roleAttendanceView: 'ATTENDANCE_VIEW',
  roleAttendanceEdit: 'ATTENDANCE_EDIT',
};

export const permissionsList = Object.values(appPermissions);

export const roleAdmin = {
  role: 'RoleAdmin',
  description: 'Role required for managing All other Roles',
  permissions: permissionsList,
  isActive: true,
};
