# Mobile App Permission System Update Instructions

## Summary

The permission system is being simplified. Most permission checking is now handled by the backend - if the backend returns data, the user can access it.

## Changes Required

### 1. Reports (No Changes Needed)
- **Submit report**: If backend returns a report template, user can submit it
- **View report submissions**: If backend returns submissions, user can view them
- Continue working exactly as before

### 2. Members (No Changes Needed)  
- **View members**: Backend only returns members the user can view
- Continue working exactly as before

### 3. Dashboard & Unsubmitted Reports (No Changes Needed)
- Backend handles all filtering
- Continue working exactly as before

### 4. Add Member (Updates Required)

**Current flow**: Add member with basic info

**New flow**: Add member with basic info + group assignment

**Changes needed:**
- Add "Group" dropdown when adding a member
- Add "Group Role" dropdown with options: "Member" or "Leader"  
- Group dropdown options should come from `hierarchy.canManageGroups` (see below)

## Backend Changes

### Updated Hierarchy Object

**Current structure:**
```json
{
  "myGroups": [...],
  "canManageGroupIds": [10, 11, 12],
  "canViewGroupIds": [10, 11, 12, 20, 21]  
}
```

**New structure:**
```json
{
  "myGroups": [...],
  "canManageGroups": [
    {"id": 10, "name": "Youth Ministry"},
    {"id": 11, "name": "Youth Small Group A"}, 
    {"id": 12, "name": "Youth Small Group B"}
  ],
  "canViewGroups": [
    {"id": 10, "name": "Youth Ministry"},
    {"id": 11, "name": "Youth Small Group A"},
    {"id": 12, "name": "Youth Small Group B"},
    {"id": 20, "name": "Adult Bible Study"},
    {"id": 21, "name": "Men's Group"}
  ]
}
```

## Implementation

### Add Member Form Updates

1. **Add Group Selection**
   - Dropdown with options from `hierarchy.canManageGroups`
   - Show: group name, store: group ID
   - Required field

2. **Add Group Role Selection** 
   - Dropdown with options: "Member", "Leader"
   - Required field
   - Default to "Member"

3. **Submit both group ID and role** when adding member

## That's It!

The mobile app changes are minimal:
- ✅ Reports work exactly as before
- ✅ Member viewing works exactly as before  
- ✅ Dashboard works exactly as before
- ✅ Only "Add Member" needs group + role selection

The backend handles all the complex permission logic automatically.