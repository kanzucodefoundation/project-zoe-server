# Complete Unit Test Fix Guide

## ✅ **Already Fixed Files**:
- `src/auth/auth.service.spec.ts`
- `src/users/users.service.spec.ts` 
- `src/reports/reports.service.spec.ts`
- `src/users/roles.controller.spec.ts`
- `src/crm/contacts.service.spec.ts`
- `src/chat/chat.service.spec.ts`
- `src/groups/services/group-membership.service.spec.ts`
- `src/crm/addresses.service.spec.ts`
- `src/users/roles.service.spec.ts`
- `src/crm/phones.service.spec.ts`
- `src/chat/chat.controller.spec.ts`
- `src/help/help.controller.spec.ts`
- `src/help/help.service.spec.ts`
- `src/events/event-activities.service.spec.ts`
- `src/groups/controllers/group-membership.controller.spec.ts` (import fix)

## 🔧 **Remaining Files to Fix**:

### A. Services that need CONNECTION provider:
```typescript
// Template for services with CONNECTION dependency:
const module: TestingModule = await Test.createTestingModule({
  providers: [
    ServiceName,
    {
      provide: 'CONNECTION',
      useValue: {
        getRepository: jest.fn().mockReturnValue({
          find: jest.fn(),
          findOne: jest.fn(),
          save: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        }),
      },
    },
  ],
}).compile();
```

**Apply this to:**
1. `src/events/events.service.spec.ts` - Add CONNECTION + GoogleService mock
2. `src/tenants/tenants.service.spec.ts` - Add DataSource + DbService mocks
3. `src/crm/group-finder/group-finder.service.spec.ts` - Add CONNECTION mock (remove TypeOrmModule imports)

### B. Controller tests with TenantContextInterceptor:

The issue is that these controllers use TenantContextInterceptor which needs UsersService:

**For these files:**
- `src/crm/contollers/contacts.controller.spec.ts`
- `src/reports/reports.controller.spec.ts`
- `src/auth/auth.controller.spec.ts`

**Solution:**
```typescript
// Mock all service dependencies
const module: TestingModule = await Test.createTestingModule({
  controllers: [ControllerName],
  providers: [
    {
      provide: ServiceName,
      useValue: mockService,
    },
    {
      provide: UsersService, // For TenantContextInterceptor
      useValue: {
        findOne: jest.fn(),
        findByName: jest.fn(),
      },
    },
    {
      provide: Reflector, // For interceptor
      useValue: {
        get: jest.fn(),
      },
    },
  ],
}).compile();
```

### C. Controller tests with method signature issues:

**src/groups/controllers/group.controller.spec.ts**
- Methods expect Request parameter, mock it:
```typescript
const mockRequest = { user: { id: 1 }, headers: {} };
const result = await controller.findAll(req, mockRequest);
```

### D. Events controller tests:

**src/events/controllers/member-event-activities.controller.spec.ts**
**src/events/controllers/event-activities.controller.spec.ts**

Mock the service instead of providing it with CONNECTION:
```typescript
providers: [
  {
    provide: EventActivitiesService,
    useValue: mockService,
  },
],
```

### E. AuthController specific fix:

**src/auth/auth.controller.spec.ts** - The login test fails because req.body is undefined:
```typescript
it('should log user in', async () => {
  const mockRequest = {
    user: { id: 1, email: 'test@example.com' },
    body: { churchName: 'Test Church' }
  };
  
  const result = await controller.login(mockRequest);
  expect(result).toBeDefined();
});
```

## 📋 **Quick Fix Commands**:

### 1. Fix missing file:
```bash
# If group-missing-reports.service doesn't exist, comment out or remove the spec file
```

### 2. Fix services with CONNECTION:
For each service spec file that fails with CONNECTION error:
- Add `{ provide: 'CONNECTION', useValue: mockConnection }`
- Use the template above

### 3. Fix controller interceptor issues:
For controller specs with TenantContextInterceptor errors:
- Add UsersService and Reflector mocks to providers
- Remove actual service providers, use mocks instead

## 🎯 **Priority Order**:

1. **High Priority** - Fix these first:
   - `src/events/events.service.spec.ts`
   - `src/tenants/tenants.service.spec.ts`
   - `src/crm/group-finder/group-finder.service.spec.ts`

2. **Medium Priority** - Controller fixes:
   - `src/crm/contollers/contacts.controller.spec.ts`
   - `src/reports/reports.controller.spec.ts`
   - `src/auth/auth.controller.spec.ts`

3. **Low Priority** - Method signature fixes:
   - `src/groups/controllers/group.controller.spec.ts`
   - Event controller specs

## ✨ **Key Patterns**:

1. **Connection Mock**: `{ provide: 'CONNECTION', useValue: mockConnection }`
2. **DataSource Mock**: `{ provide: DataSource, useValue: mockDataSource }`
3. **Service Mock**: `{ provide: ServiceName, useValue: mockService }`
4. **Interceptor Support**: Add UsersService and Reflector mocks
5. **Request Mocking**: Provide mock request objects for methods that expect them

This should fix the majority of the failing unit tests!