export const jwtConstants = {
  secret: process.env.JWT_KEY || "dWhaRFJETW5BTG01Znl1eA==",
};

export const roleAdmin = {
  role: "RoleAdmin",
  description: "Role required for managing All other Roles",
  permissions: [
    "ROLE_EDIT",
    "USER_VIEW",
    "USER_EDIT",
    "GROUP_EDIT",
    "GROUP_VIEW",
    "EVENT_EDIT",
    "EVENT_VIEW",
    "REPORT_VIEW_SUBMISSIONS",
    "DASHBOARD",
    "CRM_VIEW",
    "CRM_EDIT",
    "TAG_VIEW",
    "TAG_EDIT",
    "REPORT_VIEW",
    "REPORT_EDIT",
    "MC_VIEW",
  ],
  isActive: true,
};

export const appPermissions = {
  roleDashboard: "DASHBOARD",
  roleCrmView: "CRM_VIEW",
  roleCrmEdit: "CRM_EDIT",

  roleUserView: "USER_VIEW",
  roleUserEdit: "USER_EDIT",

  roleEdit: "ROLE_EDIT",

  roleTagView: "TAG_VIEW",
  roleTagEdit: "TAG_EDIT",

  roleGroupView: "GROUP_VIEW",
  roleGroupEdit: "GROUP_EDIT",

  roleEventView: "EVENT_VIEW",
  roleEventEdit: "EVENT_EDIT",

  roleReportView: "REPORT_VIEW",
  roleReportViewSubmissions: "REPORT_VIEW_SUBMISSIONS",
  roleReportEdit: "REPORT_EDIT",
};

export const permissionsList = Object.values(appPermissions);
