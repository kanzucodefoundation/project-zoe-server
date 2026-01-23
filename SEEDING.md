# 🌱 Database Seeding Guide

This guide explains how to seed your NestJS backend with realistic data that exactly matches the MirageJS mock server structure.

## Quick Start

```bash
# Seed database with all test data
npm run seed:comprehensive

# Clear existing data and re-seed
npm run seed:reset

# Clear data only
npm run seed:clear
```

## What Gets Seeded

### ✅ **Test User Accounts** (7 accounts)
All accounts use password: `password123`

| Email | Role | Access Level | Groups Managed |
|-------|------|-------------|----------------|
| `fellowship@worshipharvest.org` | MC Shepherd | Fellowship Level | Phase MC (100) |
| `zone@worshipharvest.org` | Zone Leader | Zone Level | North Zone + 5 fellowships |
| `location@worshipharvest.org` | Location Pastor | Location Level | Kampala + 4 zones + 20 fellowships |
| `fob@worshipharvest.org` | FOB Leader | Regional Level | East Africa + 3 locations |
| `network@worshipharvest.org` | Network Leader | Network Level | Africa Network + 2 FOBs |
| `movement@worshipharvest.org` | Movement Leader | Global Level | All groups globally |
| `admin@worshipharvest.org` | System Admin | Full Access | Full system access |

### ✅ **Group Hierarchy** (6-level structure)
```
Movement: Worship Harvest Global (1)
├─ Network: Africa Network (2)
│  └─ FOB: East Africa (4)
│     ├─ Location: Kampala, Uganda (10)
│     │  ├─ Zone: North Zone Kampala (20) - 5 fellowships
│     │  ├─ Zone: South Zone Kampala (21) - 5 fellowships  
│     │  ├─ Zone: Central Zone Kampala (22) - 5 fellowships
│     │  └─ Zone: East Zone Kampala (23) - 5 fellowships
│     ├─ Location: Kigali, Rwanda (11)
│     │  ├─ Zone: Kimihurura Zone (24) - 4 fellowships
│     │  └─ Zone: Nyarutarama Zone (25) - 4 fellowships
│     └─ Location: Nairobi, Kenya (12)
│        ├─ Zone: Kilimani Zone (26) - 4 fellowships
│        ├─ Zone: Westlands Zone (27) - 4 fellowships
│        └─ Zone: Eastlands Zone (28) - 4 fellowships
└─ Network: Europe Network (3)
   └─ FOB: Western Europe (5)
      └─ Location: Berlin, Germany (13)
         ├─ Zone: Prenzlauer Berg Zone (29) - 3 fellowships
         └─ Zone: Mitte Zone (30) - 3 fellowships
```

**Total: 68 groups** (1 movement + 2 networks + 2 FOBs + 4 locations + 13 zones + 46 fellowships)

### ✅ **Realistic Contacts** (50+ members)
- **Uganda (Kampala)**: 35+ contacts across 20 fellowships
- **Rwanda (Kigali)**: 8+ contacts across 8 fellowships  
- **Kenya (Nairobi)**: 12+ contacts across 12 fellowships
- **Germany (Berlin)**: 6+ contacts across 6 fellowships

Each contact includes:
- Full name, demographics, contact info
- Realistic African/European names
- Phone numbers with country codes
- Email addresses and work places
- Age groups, civil status, etc.
- Group memberships with roles

### ✅ **Report Types** (4 report definitions)
1. **MC Attendance Report** (Weekly, 12 fields)
   - Date, group info, attendance, hosts, streaming
   - Attendee names, visitors, feedback, testimonies
2. **Sunday Service Report** (Weekly, 8 fields)
   - Service details, total attendance, demographics
   - Visitors, offering, sermon topic
3. **Baptism Report** (Event-based, 6 fields)
   - Baptism details, location, minister, notes
4. **Salvation Report** (Event-based, 5 fields)
   - Salvation context, names, follow-up plans

### ✅ **Historical Data** (500+ submissions)
- **MC Reports**: 8 weeks of history (80% submission rate)
- **Service Reports**: 8 weeks of history (90% submission rate)
- **Baptism Reports**: Sporadic events (2 submissions)
- **Salvation Reports**: Sporadic events (2 submissions)

**Realistic patterns:**
- Some fellowships are overdue (for testing UI)
- Different submission rates by location
- Attendance varies realistically (70-95%)
- Historical gaps show realistic behavior

## File Structure

```
src/seed/
├── comprehensive-seed.service.ts    # Main seeding service
├── data/
│   ├── test-users.ts               # 7 test accounts
│   ├── seed-groups.ts              # 6-level hierarchy
│   ├── seed-contacts.ts            # 50+ contacts
│   ├── seed-reports.ts             # 4 report types
│   └── seed-submissions.ts         # Historical data generators
└── commands/
    └── seed-comprehensive.ts       # CLI command
```

## Usage Examples

### Development Setup
```bash
# Fresh start - clear and seed
npm run seed:reset

# Start your server
npm run start:dev

# Test with Phase MC leader
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "churchName": "worship harvest",
    "username": "fellowship@worshipharvest.org", 
    "password": "password123"
  }'
```

### Testing Different User Levels

**Fellowship Level** (Emmanuel Okello):
```bash
# Only sees Phase MC (8 members)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/groups/me
```

**Zone Level** (Zone Leader):
```bash  
# Sees North Zone + 5 fellowships (~32 members)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/reports/submissions/team
```

**Location Level** (Location Pastor):
```bash
# Sees all Kampala (4 zones + 20 fellowships + ~135 members)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/dashboard/summary
```

**Global Level** (Movement Leader):
```bash
# Sees entire global hierarchy
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/search?q=emmanuel&type=contacts
```

## Database Integration

The seeding system:
- ✅ **Respects existing data** (won't duplicate)
- ✅ **Handles dependencies** (creates in proper order)
- ✅ **Supports multi-tenancy** (creates default tenant)
- ✅ **Sets up permissions** (role-based access control)
- ✅ **Creates relationships** (group memberships, user roles)
- ✅ **Validates data** (proper foreign keys, constraints)

## Troubleshooting

### Clear and Restart
```bash
npm run seed:clear
npm run seed:comprehensive
```

### Check Seeded Data
```bash
# Count contacts
SELECT COUNT(*) FROM contact;

# Count groups by type  
SELECT gc.name, COUNT(g.id) FROM "group" g 
JOIN group_category gc ON g."categoryId" = gc.id 
GROUP BY gc.name;

# Check user accounts
SELECT username, "fullName", roles FROM "user" 
JOIN user_roles ur ON "user".id = ur."userId"
JOIN roles r ON ur."rolesId" = r.id;
```

### Performance
The comprehensive seeding creates **500+ database records** and typically takes **30-60 seconds** depending on your system.

## Mobile App Integration

After seeding, your NestJS backend provides **100% API compatibility** with the MirageJS mock server:

1. **Same test accounts** with identical credentials
2. **Same group hierarchy** with exact IDs and relationships  
3. **Same realistic data** distribution and demographics
4. **Same report structure** with identical field definitions
5. **Same historical patterns** with realistic submission gaps

Perfect for seamless mobile development and testing! 🚀