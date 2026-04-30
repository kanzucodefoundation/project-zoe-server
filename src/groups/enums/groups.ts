export enum GroupCategoryNames {
  MC = 'Missional Community',
  CLUSTER = 'Cluster',
  LOCATION = 'Location',
  ZONE = 'Zone',
  COHORT = 'Cohort',
  NETWORK = 'Network',
  HUDDLE = 'Huddle',
  GARAGE_TEAM = 'Garage Team',
}

/**
 * Classifies what a group category is used for in the system.
 *
 * ## Design intent
 * Groups exist in three real-world domains and one organisational layer:
 *
 *  - FELLOWSHIP   – pastoral units where members belong (MCs, cells).
 *                   Drives attendance tracking, schedules, and the
 *                   my-members / my-schedule endpoints.
 *
 *  - LOCATION     – physical meeting places (campuses, venues).
 *                   Drives check-in and the public locations display.
 *
 *  - SERVING_TEAM – ministry / function teams (media, worship, ushers).
 *                   Drives task assignment and serving schedules.
 *
 *  - STRUCTURE    – organisational containers with no workflow of their
 *                   own (FOBs, Regions, Zones, Departments). They exist
 *                   purely to organise the three real-world types into a
 *                   navigable hierarchy.
 *
 * ## Hierarchy and permissions
 * All four types participate in the same parent/child tree (Group.parentId).
 * A leader of a STRUCTURE group (e.g. a FOB leader) automatically inherits
 * edit permissions over every group in their subtree — this is enforced by
 * GroupPermissionsService.hasPermissionForGroup via ancestor traversal.
 *
 * Report and attendance visibility for higher-level leaders is handled by
 * GroupPermissionsService.getUserGroupIds, which expands a leader's direct
 * groups to all descendants before access checks are applied.
 *
 * ## Endpoint scope boundaries
 * The fellowship attendance endpoints (getMyMembers, getMySchedule,
 * recordReportAttendance) are intentionally scoped to DIRECT fellowship
 * leaders only — i.e. the person assigned as Leader of the MC itself.
 * A FOB or Zone leader uses report-level aggregation to view data across
 * their subtree, but does not submit attendance on behalf of individual MCs.
 */
export enum GroupCategoryPurpose {
  FELLOWSHIP = 'fellowship',
  LOCATION = 'location',
  SERVING_TEAM = 'serving_team',
  STRUCTURE = 'structure',
}
