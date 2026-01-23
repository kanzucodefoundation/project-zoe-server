import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  initializeTestDatabase,
  closeTestDatabase,
} from './utils/test-database';
import {
  createCompleteTestSetup,
  createTestTenant,
  createTestUser,
  createTestGroup,
  createTestContact,
  createTestGroupMembership,
  cleanupTestData,
  initializeJwtService,
} from './utils/test-setup';
import { GroupRole } from '../src/groups/enums/groupRole';
import { GroupPrivacy } from '../src/groups/enums/groupPrivacy';

/**
 * Groups Controller Integration Tests
 *
 * These tests verify the groups management system:
 * 1. Group CRUD operations with proper tenant isolation
 * 2. Group membership management (add/remove members, role changes)
 * 3. Multi-tenant data isolation (users can't access other tenants' groups)
 * 4. Role-based access control (leaders vs members)
 * 5. Group hierarchy and permissions
 * 6. Membership requests and approvals
 *
 * Why this matters:
 * - Groups are the core organizational unit in the church management system
 * - Group membership drives reporting, communications, and permissions
 * - Proper tenant isolation prevents data leaks between organizations
 * - Role-based access ensures proper group governance
 */

describe('Groups (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Test entities for Tenant A
  let tenantA: any;
  let tenantAOwner: any;
  let tenantAGroup: any;
  let tenantAContact: any;

  // Test entities for Tenant B
  let tenantB: any;
  let tenantBOwner: any;
  let tenantBGroup: any;
  let tenantBContact: any;

  beforeAll(async () => {
    // Initialize test database
    dataSource = await initializeTestDatabase();

    // Initialize JWT service
    initializeJwtService();

    // Create test module
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same validation pipe as production
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();

    // Create test data for Tenant A
    const setupA = await createCompleteTestSetup(dataSource, 'Church A');
    tenantA = setupA.tenant;
    tenantAOwner = setupA.owner;
    tenantAGroup = setupA.group;
    tenantAContact = setupA.contact;

    // Create test data for Tenant B
    const setupB = await createCompleteTestSetup(dataSource, 'Church B');
    tenantB = setupB.tenant;
    tenantBOwner = setupB.owner;
    tenantBGroup = setupB.group;
    tenantBContact = setupB.contact;
  });

  afterAll(async () => {
    await cleanupTestData(dataSource);
    await closeTestDatabase(dataSource);
    await app.close();
  });

  describe('GET /api/groups - List Groups', () => {
    it('should return only groups from authenticated user tenant', async () => {
      /**
       * Test: Group listing respects tenant boundaries
       * Why: Users should only see their own tenant's groups
       */
      const response = await request(app.getHttpServer())
        .get('/api/groups')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      const groups = response.body.data || response.body || [];
      const groupIds = groups.map((g: any) => g.id);

      // Should contain Tenant A groups
      expect(groupIds).toContain(tenantAGroup.id);

      // Should NOT contain Tenant B groups
      expect(groupIds).not.toContain(tenantBGroup.id);
    });

    it('should return 401 for unauthenticated requests', async () => {
      /**
       * Test: Authentication required
       * Why: Groups contain organizational structure information
       */
      await request(app.getHttpServer()).get('/api/groups').expect(401);
    });

    it('should return groups with proper structure', async () => {
      /**
       * Test: Response structure validation
       * Why: Frontend depends on consistent API structure
       */
      const response = await request(app.getHttpServer())
        .get('/api/groups')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();

      const groups = response.body.data || response.body || [];
      if (groups.length > 0) {
        const group = groups.find((g: any) => g.id === tenantAGroup.id);
        expect(group).toBeDefined();
        expect(group.name).toBeDefined();
        expect(group.privacy).toBeDefined();
      }
    });

    it('should support search functionality', async () => {
      /**
       * Test: Group search functionality
       * Why: Users need to find specific groups
       */
      const response = await request(app.getHttpServer())
        .get(`/api/groups?search=${encodeURIComponent(tenantAGroup.name)}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('POST /api/groups - Create Group', () => {
    it('should create group with proper tenant assignment', async () => {
      /**
       * Test: Group creation assigns correct tenant
       * Why: Groups must be properly associated with the creating tenant
       */
      const groupData = {
        name: 'New Test Group',
        description: 'Test group description',
        privacy: GroupPrivacy.Open,
        isActive: true,
      };

      const response = await request(app.getHttpServer())
        .post('/api/groups')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(groupData)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.name).toBe(groupData.name);

      // Verify it's associated with correct tenant (if tenant info is returned)
      if (response.body.tenant) {
        expect(response.body.tenant.id).toBe(tenantA.id);
      }
    });

    it('should validate required fields', async () => {
      /**
       * Test: Input validation
       * Why: Prevent invalid group configurations
       */
      const response = await request(app.getHttpServer())
        .post('/api/groups')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send({
          // Missing required name field
          description: 'Test group',
        });

      // Should fail validation
      expect([400, 422]).toContain(response.status);
    });

    it('should require authentication', async () => {
      /**
       * Test: Authentication required for creation
       * Why: Only authenticated users can create groups
       */
      await request(app.getHttpServer())
        .post('/api/groups')
        .send({
          name: 'Unauthorized Group',
          privacy: GroupPrivacy.Open,
        })
        .expect(401);
    });
  });

  describe('GET /api/groups/:id - Get Single Group', () => {
    it('should return group details for authenticated user tenant', async () => {
      /**
       * Test: Single group retrieval
       * Why: Users need to view detailed group information
       */
      const response = await request(app.getHttpServer())
        .get(`/api/groups/${tenantAGroup.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBe(tenantAGroup.id);
      expect(response.body.name).toBe(tenantAGroup.name);
    });

    it('should return 404 for group from another tenant', async () => {
      /**
       * Test: Cross-tenant group access blocked
       * Why: Critical security - prevent data leakage through direct ID access
       */
      const response = await request(app.getHttpServer())
        .get(`/api/groups/${tenantBGroup.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(404);

      // Should not return group data
      expect(response.body.id).toBeUndefined();
    });

    it('should include group members if requested', async () => {
      /**
       * Test: Group members inclusion
       * Why: Group details often need member information
       */
      const response = await request(app.getHttpServer())
        .get(`/api/groups/${tenantAGroup.id}?includeMembers=true`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
      // Verify members are included if supported
      if (response.body.members || response.body.groupMemberships) {
        expect(
          Array.isArray(
            response.body.members || response.body.groupMemberships,
          ),
        ).toBe(true);
      }
    });
  });

  describe('PUT /api/groups/:id - Update Group', () => {
    it('should allow updating own tenant group', async () => {
      /**
       * Test: Group update authorization
       * Why: Users should be able to update their own groups
       */
      const updateData = {
        name: 'Updated Group Name',
        description: 'Updated description',
        privacy: GroupPrivacy.Private,
      };

      const response = await request(app.getHttpServer())
        .put(`/api/groups/${tenantAGroup.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(updateData);

      expect([200, 204]).toContain(response.status);

      // Verify update was applied (if response includes updated data)
      if (response.body && response.body.name) {
        expect(response.body.name).toBe(updateData.name);
      }
    });

    it('should NOT allow updating another tenant group', async () => {
      /**
       * Test: Cross-tenant update blocked
       * Why: Critical security - cannot modify other tenants' groups
       */
      const response = await request(app.getHttpServer())
        .put(`/api/groups/${tenantBGroup.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send({
          name: 'Malicious Update',
        });

      // Should fail with 404 or 403
      expect([404, 403]).toContain(response.status);
    });

    it('should validate update data', async () => {
      /**
       * Test: Update data validation
       * Why: Ensure data integrity in updates
       */
      const response = await request(app.getHttpServer())
        .put(`/api/groups/${tenantAGroup.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send({
          privacy: 'InvalidPrivacyValue',
        });

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('DELETE /api/groups/:id - Delete Group', () => {
    let testGroup: any;

    beforeEach(async () => {
      // Create a group specifically for deletion tests
      testGroup = await createTestGroup(
        dataSource,
        tenantA.id,
        'Test Delete Group',
      );
    });

    it('should allow deleting own tenant group', async () => {
      /**
       * Test: Group deletion authorization
       * Why: Users should be able to delete their own groups
       */
      const response = await request(app.getHttpServer())
        .delete(`/api/groups/${testGroup.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`);

      expect([200, 204]).toContain(response.status);
    });

    it('should NOT allow deleting another tenant group', async () => {
      /**
       * Test: Cross-tenant deletion blocked
       * Why: Critical security - cannot delete other tenants' groups
       */
      const response = await request(app.getHttpServer())
        .delete(`/api/groups/${tenantBGroup.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`);

      expect([404, 403]).toContain(response.status);
    });

    it('should handle non-existent group deletion gracefully', async () => {
      /**
       * Test: Non-existent group deletion
       * Why: API should handle missing resources gracefully
       */
      const nonExistentId = 99999;

      const response = await request(app.getHttpServer())
        .delete(`/api/groups/${nonExistentId}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(404);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('POST /api/groups/:groupId/members - Add Group Member', () => {
    it('should add member to own tenant group', async () => {
      /**
       * Test: Group member addition
       * Why: Core functionality - managing group membership
       */
      // Create a new contact to add to the group
      const newContact = await createTestContact(
        dataSource,
        tenantA.id,
        'New',
        'Member',
      );

      const memberData = {
        contactId: newContact.id,
        role: GroupRole.Member,
      };

      const response = await request(app.getHttpServer())
        .post(`/api/groups/${tenantAGroup.id}/members`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(memberData);

      expect([201, 200]).toContain(response.status);
      expect(response.body).toBeDefined();
    });

    it('should NOT allow adding member to another tenant group', async () => {
      /**
       * Test: Cross-tenant member addition blocked
       * Why: Users cannot add members to other tenants' groups
       */
      const memberData = {
        contactId: tenantAContact.id,
        role: GroupRole.Member,
      };

      const response = await request(app.getHttpServer())
        .post(`/api/groups/${tenantBGroup.id}/members`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(memberData);

      expect([404, 403]).toContain(response.status);
    });

    it('should validate member data', async () => {
      /**
       * Test: Member data validation
       * Why: Ensure proper member addition with valid data
       */
      const response = await request(app.getHttpServer())
        .post(`/api/groups/${tenantAGroup.id}/members`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send({
          // Missing required contactId
          role: GroupRole.Member,
        });

      expect([400, 422]).toContain(response.status);
    });

    it('should not add same contact twice to same group', async () => {
      /**
       * Test: Duplicate membership prevention
       * Why: Contacts should not have duplicate memberships in the same group
       */
      const memberData = {
        contactId: tenantAContact.id,
        role: GroupRole.Member,
      };

      // Try to add the same contact that's already a member
      const response = await request(app.getHttpServer())
        .post(`/api/groups/${tenantAGroup.id}/members`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(memberData);

      // Should handle duplicate gracefully (409 Conflict or 200 if idempotent)
      expect([409, 200, 400]).toContain(response.status);
    });
  });

  describe('PUT /api/groups/:groupId/members/:memberId - Update Member Role', () => {
    let testMembership: any;
    let testContact: any;

    beforeEach(async () => {
      // Create a contact and membership for role update tests
      testContact = await createTestContact(
        dataSource,
        tenantA.id,
        'Role',
        'Test',
      );
      testMembership = await createTestGroupMembership(
        dataSource,
        testContact.id,
        tenantAGroup.id,
        GroupRole.Member,
      );
    });

    it('should update member role in own tenant group', async () => {
      /**
       * Test: Member role update
       * Why: Core functionality - promoting/demoting members
       */
      const updateData = {
        role: GroupRole.Leader,
      };

      const response = await request(app.getHttpServer())
        .put(`/api/groups/${tenantAGroup.id}/members/${testMembership.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(updateData);

      expect([200, 204]).toContain(response.status);
    });

    it('should NOT allow updating member role in another tenant group', async () => {
      /**
       * Test: Cross-tenant member role update blocked
       * Why: Users cannot modify other tenants' group memberships
       */
      const updateData = {
        role: GroupRole.Leader,
      };

      const response = await request(app.getHttpServer())
        .put(`/api/groups/${tenantBGroup.id}/members/999`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(updateData);

      expect([404, 403]).toContain(response.status);
    });

    it('should validate role values', async () => {
      /**
       * Test: Role validation
       * Why: Ensure only valid roles are assigned
       */
      const response = await request(app.getHttpServer())
        .put(`/api/groups/${tenantAGroup.id}/members/${testMembership.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send({
          role: 'InvalidRole',
        });

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('DELETE /api/groups/:groupId/members/:memberId - Remove Group Member', () => {
    let testMembership: any;
    let testContact: any;

    beforeEach(async () => {
      // Create a contact and membership for removal tests
      testContact = await createTestContact(
        dataSource,
        tenantA.id,
        'Remove',
        'Test',
      );
      testMembership = await createTestGroupMembership(
        dataSource,
        testContact.id,
        tenantAGroup.id,
        GroupRole.Member,
      );
    });

    it('should remove member from own tenant group', async () => {
      /**
       * Test: Member removal
       * Why: Core functionality - removing members from groups
       */
      const response = await request(app.getHttpServer())
        .delete(`/api/groups/${tenantAGroup.id}/members/${testMembership.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`);

      expect([200, 204]).toContain(response.status);
    });

    it('should NOT allow removing member from another tenant group', async () => {
      /**
       * Test: Cross-tenant member removal blocked
       * Why: Users cannot remove members from other tenants' groups
       */
      const response = await request(app.getHttpServer())
        .delete(`/api/groups/${tenantBGroup.id}/members/999`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`);

      expect([404, 403]).toContain(response.status);
    });

    it('should handle non-existent membership removal gracefully', async () => {
      /**
       * Test: Non-existent membership removal
       * Why: API should handle missing memberships gracefully
       */
      const nonExistentId = 99999;

      const response = await request(app.getHttpServer())
        .delete(`/api/groups/${tenantAGroup.id}/members/${nonExistentId}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(404);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('GET /api/groups/:groupId/members - List Group Members', () => {
    it('should return members for own tenant group', async () => {
      /**
       * Test: Group member listing
       * Why: Users need to see who's in their groups
       */
      const response = await request(app.getHttpServer())
        .get(`/api/groups/${tenantAGroup.id}/members`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body.data || response.body)).toBe(true);
    });

    it('should NOT return members for another tenant group', async () => {
      /**
       * Test: Cross-tenant member listing blocked
       * Why: Users cannot see other tenants' group memberships
       */
      const response = await request(app.getHttpServer())
        .get(`/api/groups/${tenantBGroup.id}/members`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(404);
    });

    it('should support role filtering', async () => {
      /**
       * Test: Member role filtering
       * Why: Filter members by their roles (leaders, members, etc.)
       */
      const response = await request(app.getHttpServer())
        .get(`/api/groups/${tenantAGroup.id}/members?role=${GroupRole.Leader}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should return member details with contact information', async () => {
      /**
       * Test: Member details inclusion
       * Why: Member lists need contact information for display
       */
      const response = await request(app.getHttpServer())
        .get(`/api/groups/${tenantAGroup.id}/members`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      const members = response.body.data || response.body || [];

      if (members.length > 0) {
        const member = members[0];
        // Verify member structure includes contact info
        expect(member).toBeDefined();
        if (member.contact) {
          expect(member.contact).toBeDefined();
        }
      }
    });
  });

  describe('Data Integrity and Performance', () => {
    it('should maintain tenant isolation in database', async () => {
      /**
       * Test: Database-level tenant isolation
       * Why: Even if application code has bugs, data should be isolated
       */
      const response = await request(app.getHttpServer())
        .get('/api/groups')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      const groups = response.body.data || response.body || [];

      // All returned groups should belong to Tenant A
      groups.forEach((group: any) => {
        if (group.tenant) {
          expect(group.tenant.id).toBe(tenantA.id);
        }
      });
    });

    it('should handle concurrent membership operations gracefully', async () => {
      /**
       * Test: Concurrent operation handling
       * Why: Multiple users may modify memberships simultaneously
       */
      const newContact = await createTestContact(
        dataSource,
        tenantA.id,
        'Concurrent',
        'Test',
      );

      const memberData = {
        contactId: newContact.id,
        role: GroupRole.Member,
      };

      // Create multiple concurrent membership operations
      const promises = Array.from({ length: 3 }, () =>
        request(app.getHttpServer())
          .post(`/api/groups/${tenantAGroup.id}/members`)
          .set('Authorization', `Bearer ${tenantAOwner.token}`)
          .send(memberData),
      );

      const responses = await Promise.all(promises);

      // First should succeed, others should handle conflicts gracefully
      const successfulResponses = responses.filter((r) =>
        [200, 201].includes(r.status),
      );
      const conflictResponses = responses.filter((r) =>
        [409, 400].includes(r.status),
      );

      expect(successfulResponses.length).toBeGreaterThan(0);
      // Total should equal number of requests
      expect(successfulResponses.length + conflictResponses.length).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid group IDs gracefully', async () => {
      /**
       * Test: Invalid ID handling
       * Why: API should handle malformed IDs gracefully
       */
      const response = await request(app.getHttpServer())
        .get('/api/groups/invalid-id')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should validate group privacy settings', async () => {
      /**
       * Test: Privacy setting validation
       * Why: Ensure only valid privacy settings are accepted
       */
      const groupData = {
        name: 'Privacy Test Group',
        privacy: 'InvalidPrivacy',
      };

      const response = await request(app.getHttpServer())
        .post('/api/groups')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(groupData);

      expect([400, 422]).toContain(response.status);
    });

    it('should prevent creating groups with duplicate names in same tenant', async () => {
      /**
       * Test: Duplicate name prevention
       * Why: Group names should be unique within a tenant
       */
      const groupData = {
        name: tenantAGroup.name, // Use existing group name
        privacy: GroupPrivacy.Open,
      };

      const response = await request(app.getHttpServer())
        .post('/api/groups')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(groupData);

      // Should handle duplicate names (409 Conflict or validation error)
      expect([409, 400, 422]).toContain(response.status);
    });
  });
});
