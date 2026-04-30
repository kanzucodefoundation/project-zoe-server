# Project Zoe Server — Architecture Notes

## Group Hierarchy

### Real-world vs structural groups

Groups exist in three real-world domains and one organisational layer, captured
by `GroupCategoryPurpose` on the `GroupCategory` entity:

| Purpose        | What it represents                          | Examples                          |
|----------------|---------------------------------------------|-----------------------------------|
| `fellowship`   | Pastoral units where members belong         | Missional Community, Cell Group   |
| `location`     | Physical meeting places                     | Campus, Venue                     |
| `serving_team` | Ministry / function teams                   | Media Team, Worship Team          |
| `structure`    | Organisational containers (no own workflow) | FOB, Zone, Region, Department     |

`fellowship` and `location` are intentionally separate — a fellowship is *who
you belong to pastorally*; a location is *where you physically meet*. They
can overlap but have distinct workflows (attendance/schedule vs check-in/display).

`structure` groups exist purely to organise the three real-world types into a
navigable hierarchy. They do not participate directly in any workflow.

### Permissions and data visibility

All four types share the same parent/child tree (`Group.parentId`).

**Edit permissions** cascade downward automatically.
`GroupPermissionsService.hasPermissionForGroup` walks ancestors, so a leader of
a FOB (structure) can edit every group nested under it without being explicitly
assigned to each one.

**Data visibility** (reports, attendance) is expanded via
`GroupPermissionsService.getUserGroupIds` → `GroupTreeService.getGroupAndAllChildren`.
This returns a leader's direct groups plus all descendants, which is then used
as the access-control set for report queries.

### Fellowship attendance endpoint scope

`FellowshipAttendanceService.getMyMembers`, `getMySchedule`, and
`recordReportAttendance` are intentionally scoped to **direct fellowship
leaders only** — the person assigned as `Leader` of the MC itself.

A FOB or Zone leader is not a direct MC leader, so these endpoints return empty
/ no-schedule for them by design. Higher-level leaders access member and
schedule data through the reports layer, which applies the full group-tree
expansion described above.

This boundary exists to keep the submit path unambiguous: attendance is recorded
by the shepherd responsible for a specific MC, not by anyone above them in the
hierarchy.

## ORM / Schema

The project uses TypeORM with `synchronize` controlled by the `DB_SYNCHRONIZE`
environment variable (`true` in development, `false` in production). There is no
migrations directory — production schema changes must be applied manually or via
a migration script.

## Seeding

`ComprehensiveSeedService` seeds default group categories with their `purpose`
values. If a category already exists without a purpose, the seed will stamp the
correct purpose on it — making it safe to re-run after the `purpose` column is
added in production.
