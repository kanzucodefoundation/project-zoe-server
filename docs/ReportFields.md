
## Overview

  The Dynamic Group Selector is a configurable field type that automatically loads and displays groups (locations, fellowships, ministries, etc.) based on backend configuration. It replaces hardcoded dropdown options with a
  flexible, database-driven approach for multi-tenant church platforms.

  Field Configuration

  Basic Structure

  {
    "type": "select",
    "name": "locationName",
    "label": "Location",
    "required": true,
    "options": [
      {
        "type": "dynamic_group_selector",
        "scope": "user",
        "group_category": "location"
      }
    ]
  }

  Configuration Parameters

  | Parameter      | Type   | Values                                        | Description
    |
  |----------------|--------|-----------------------------------------------|-------------------------------------
  --|
  | type           | string | "dynamic_group_selector"                      | Identifies this as a dynamic
  selector |
  | scope          | string | "user" | "tenant"                             | Data scope for group retrieval
    |
  | group_category | string | "location" | "fellowship" | "ministry" | etc. | Type of groups to load
    |

  Scope Definitions

  - user: Returns groups the authenticated user has access to/belongs to
  - tenant: Returns all groups within the organization/tenant

  Backend Integration

  API Endpoints

  User Scope:
  GET /groups/my-groups?category={group_category}

  Tenant Scope:
  GET /groups/categories/{group_category}

  Expected Response Format

  [
    {
      "id": 1,
      "name": "Kampala Location"
    },
    {
      "id": 2,
      "name": "Entebbe Location"
    }
  ]

  Form Data Handling

  Field Name Mapping Strategy

  The system uses intelligent field name mapping based on the field name to determine how to store the selected
  value:

  Name-based Fields

  Pattern: Field name contains "name"
  // Examples: "locationName", "fellowshipName", "ministryName"
  formData[fieldName] = selection['name'];  // Stores: "Kampala Location"

  ID-based Fields

  Pattern: Field name contains "id"
  // Examples: "locationId", "fellowshipId", "ministryId"
  formData[fieldName] = selection['id'];    // Stores: 1

  Default Behavior

  Pattern: Field name doesn't contain "name" or "id"
  // Examples: "location", "fellowship", "ministry"
  formData[fieldName] = selection['name'];  // Stores: "Kampala Location" (defaults to name)

  Form Submission Example

  Given a field named "locationName" with selection {id: 1, name: "Kampala Location"}:

  {
    "locationName": "Kampala Location",
    "reportDate": "2024-01-03",
    "attendanceCount": "45"
  }

  Given a field named "locationId" with the same selection:

  {
    "locationId": 1,
    "reportDate": "2024-01-03",
    "attendanceCount": "45"
  }

  Frontend Implementation

  Auto-Selection Behavior

  When only one option is available:
  - Automatically selects the single option
  - Disables user interaction (read-only)
  - Provides visual feedback with subtle green background
  - Removes dropdown arrow for clean appearance

  Visual States

  | State            | Appearance                     | Interaction                 |
  |------------------|--------------------------------|-----------------------------|
  | Multiple Options | Standard dropdown with arrow   | User can select             |
  | Single Option    | Green background, no arrow     | Auto-selected, disabled     |
  | No Options       | Red error state                | Disabled with error message |
  | Loading          | Spinner with "Loading..." text | Disabled during load        |

  Error Handling

  // No options available
  Container(
    decoration: BoxDecoration(
      color: Colors.red.shade50,
      border: Border.all(color: Colors.red.shade300),
    ),
    child: Text('No location available')
  )

  Implementation Examples

  Location Selector

  {
    "type": "select",
    "name": "serviceLocationName",
    "label": "Service Location",
    "required": true,
    "options": [
      {
        "type": "dynamic_group_selector",
        "scope": "user",
        "group_category": "location"
      }
    ]
  }

  Fellowship Selector

  {
    "type": "select",
    "name": "fellowshipId",
    "label": "Missional Community",
    "required": true,
    "options": [
      {
        "type": "dynamic_group_selector",
        "scope": "user",
        "group_category": "fellowship"
      }
    ]
  }

  Ministry Selector (Tenant-wide)

  {
    "type": "select",
    "name": "ministryName",
    "label": "Ministry Department",
    "required": false,
    "options": [
      {
        "type": "dynamic_group_selector",
        "scope": "tenant",
        "group_category": "ministry"
      }
    ]
  }

  Benefits

  For Users

  - Reduced friction - Auto-selection eliminates unnecessary clicks
  - Context awareness - Shows only relevant groups
  - Clear feedback - Visual indicators for auto-selected fields

  For Administrators

  - No hardcoding - Groups managed in database, not code
  - Multi-tenant support - Different groups per organization
  - Flexible categorization - Support for any group type

  For Developers

  - Single implementation - Same code handles all group types
  - Backend flexibility - Easy to add new group categories
  - Consistent behavior - Uniform UX across all forms

  Technical Notes

  Performance Optimization

  - Future caching prevents infinite loops during widget rebuilds
  - Single API call per field per form load
  - Conditional rendering based on data availability

  Form Validation

  - Auto-selected fields automatically pass required validation
  - Empty options show appropriate error messages
  - Standard Flutter form validation integration

---

## Dynamic Fellowship Schedule Selector (`dynamic_fellowship_schedule`)

Populates a field with the meeting schedule for the fellowship group (MC) that
the current user directly leads. Used in the MC Attendance Report to capture
which meeting day the report covers.

### Field Configuration

  {
    "name": "fellowshipSchedule",
    "label": "MC Meeting Day",
    "type": "select",
    "required": true,
    "options": [{ "type": "dynamic_fellowship_schedule" }]
  }

### Backend endpoint

  GET /fellowships/my-schedule

### Response shape

When a schedule exists:

  {
    "exists": true,
    "day": 4,           // 0 = Sunday … 6 = Saturday
    "label": "Thursdays",
    "fellowshipGroupId": 42
  }

When no schedule is configured:

  {
    "exists": false,
    "weekdays": [
      { "value": 0, "label": "Sunday" },
      ...
      { "value": 6, "label": "Saturday" }
    ]
  }

### Prerequisites for non-empty response

1. The logged-in user's contact must be an **active Leader** of a group whose
   category has `purpose = fellowship` (a direct MC leader — FOB/Zone leaders
   always receive `{ exists: false }`).
2. That MC group must have an **active `FellowshipSchedule` row**.
   Create one via `POST /fellowships/schedules`:

     {
       "fellowshipGroupId": 42,
       "meetingDay": 4,    // 0–6
       "startTime": "19:00",
       "frequency": "weekly"
     }

### Form submission

The field value submitted is the `day` integer (e.g. `4`). On the backend,
`reports.service.ts` reads this value to identify the fellowship instance when
recording attendance via `fellowshipAttendanceService.recordReportAttendance`.

---

## Dynamic Member Selector (`dynamic_member_selector`)

Populates a multi-select field with the active members of the MC(s) the current
user directly leads. Used in the MC Attendance Report to mark which members were
present at the meeting.

### Field Configuration

  {
    "name": "fellowshipMembers",
    "label": "MC Members Present",
    "type": "select",
    "required": true,
    "options": [{ "type": "dynamic_member_selector" }]
  }

### Backend endpoint

  GET /fellowships/my-members

### Response shape

  [
    { "id": 101, "firstName": "Alice", "lastName": "Nakato", "avatar": null },
    { "id": 102, "firstName": "Bob",   "lastName": "Onen",   "avatar": null }
  ]

### Prerequisites for non-empty response

1. The logged-in user's contact must be an **active Leader** of a fellowship
   group (same scope rule as `dynamic_fellowship_schedule`).
2. That MC group must have **active `GroupMembership` rows** (contacts assigned
   as members with `isActive = true`).

### Form submission

The field value submitted is an **array of contact IDs** for members who
attended (e.g. `[101, 102]`). The backend records individual
`FellowshipAttendance` rows for each ID.

---

## How the two fields work together on submission

When a report containing both a `dynamic_fellowship_schedule` field and a
`dynamic_member_selector` field is submitted, `reports.service.ts` automatically:

1. Finds the schedule field by its sentinel option type.
2. Finds the member field by its sentinel option type.
3. Calls `fellowshipAttendanceService.recordReportAttendance(contactId, userId, meetingDay, attendedContactIds)`.

This writes individual `FellowshipAttendance` rows for the MC meeting, so
attendance is tracked at the per-member level without the MC leader needing to
use the separate check-in flow.
