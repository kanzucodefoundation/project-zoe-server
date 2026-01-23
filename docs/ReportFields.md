
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

 