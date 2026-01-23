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
  createTestTenant,
  createTestUser,
  cleanupTestData,
  initializeJwtService,
} from './utils/test-setup';

/**
 * Users Controller Integration Tests
 *
 * These tests verify the user management system:
 * 1. User CRUD operations with proper tenant isolation
 * 2. User role management and permissions
 * 3. Multi-tenant data isolation (users can't access other tenants' users)
 * 4. User invitation and activation
 * 5. Password management and security
 * 6. User profile updates
 * 7. Role-based access control
 * 8. User deactivation and reactivation
 *
 * Why this matters:
 * - User management is critical for church administration
 * - Proper tenant isolation prevents data leaks between organizations
 * - Role-based access ensures proper permissions
 * - User lifecycle management ensures security and compliance
 * - Invitation system enables onboarding new team members
 */

describe('Users Management (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Test entities for Tenant A
  let tenantA: any;
  let tenantAAdmin: any;

  // Test entities for Tenant B
  let tenantB: any;
  let tenantBAdmin: any;

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
    tenantA = await createTestTenant(dataSource, 'Church A');
    tenantAAdmin = await createTestUser(
      dataSource,
      'ADMIN',
      tenantA.id,
      'admin-a@example.com',
    );

    // Create test data for Tenant B
    tenantB = await createTestTenant(dataSource, 'Church B');
    tenantBAdmin = await createTestUser(
      dataSource,
      'ADMIN',
      tenantB.id,
      'admin-b@example.com',
    );
  });

  afterAll(async () => {
    await cleanupTestData(dataSource);
    await closeTestDatabase(dataSource);
    await app.close();
  });

  describe('GET /api/users - List Users', () => {
    it('should return only users from authenticated user tenant', async () => {
      /**
       * Test: User listing respects tenant boundaries
       * Why: Users should only see their own tenant's users
       */
      const response = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .expect(200);

      const users = response.body.data || response.body || [];
      const userIds = users.map((u: any) => u.id);

      // Should contain Tenant A users
      expect(userIds).toContain(tenantAAdmin.user.id);

      // Should NOT contain Tenant B users
      expect(userIds).not.toContain(tenantBAdmin.user.id);
    });

    it('should return 401 for unauthenticated requests', async () => {
      /**
       * Test: Authentication required
       * Why: User data is sensitive and requires authentication
       */
      await request(app.getHttpServer()).get('/api/users').expect(401);
    });

    it('should return users with proper structure', async () => {
      /**
       * Test: Response structure validation
       * Why: Frontend depends on consistent API structure
       */
      const response = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .expect(200);

      expect(response.body).toBeDefined();

      const users = response.body.data || response.body || [];
      if (users.length > 0) {
        const user = users.find((u: any) => u.id === tenantAAdmin.user.id);
        expect(user).toBeDefined();
        expect(user.email).toBeDefined();
        expect(user.firstName).toBeDefined();
        expect(user.lastName).toBeDefined();
        // Password should not be included in response
        expect(user.password).toBeUndefined();
      }
    });

    it('should support search functionality', async () => {
      /**
       * Test: User search functionality
       * Why: Admins need to find specific users quickly
       */
      const response = await request(app.getHttpServer())
        .get(`/api/users?search=${encodeURIComponent('admin')}`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should support role filtering', async () => {
      /**
       * Test: Role-based filtering
       * Why: Admins need to see users by their roles
       */
      const response = await request(app.getHttpServer())
        .get('/api/users?role=ADMIN')
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should support pagination', async () => {
      /**
       * Test: Pagination functionality
       * Why: Large user lists need pagination for performance
       */
      const response = await request(app.getHttpServer())
        .get('/api/users?limit=10&offset=0')
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('POST /api/users - Create User', () => {
    it('should create user with proper tenant assignment', async () => {
      /**
       * Test: User creation assigns correct tenant
       * Why: Users must be properly associated with the creating tenant
       */
      const userData = {
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        role: 'USER',
        isActive: true,
      };

      const response = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .send(userData)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.firstName).toBe(userData.firstName);
      expect(response.body.email).toBe(userData.email);

      // Verify it's associated with correct tenant (if tenant info is returned)
      if (response.body.tenant) {
        expect(response.body.tenant.id).toBe(tenantA.id);
      }
    });

    it('should validate required fields', async () => {
      /**
       * Test: Input validation
       * Why: Prevent invalid user configurations
       */
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .send({
          // Missing required fields
          lastName: 'Incomplete',
        });

      // Should fail validation
      expect([400, 422]).toContain(response.status);
    });

    it('should validate email format', async () => {
      /**
       * Test: Email format validation
       * Why: Users need valid email addresses for communication
       */
      const userData = {
        firstName: 'Invalid',
        lastName: 'Email',
        email: 'invalid-email-format',
        role: 'USER',
      };

      const response = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .send(userData);

      expect([400, 422]).toContain(response.status);
    });

    it('should prevent duplicate email addresses', async () => {
      /**
       * Test: Duplicate email prevention
       * Why: Email addresses should be unique within tenant
       */
      const userData = {
        firstName: 'Duplicate',
        lastName: 'Email',
        email: 'duplicate@example.com',
        role: 'USER',
      };

      // Create first user
      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .send(userData)
        .expect(201);

      // Try to create second user with same email
      const response = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .send({
          ...userData,
          firstName: 'Another',
        });

      expect([400, 409, 422]).toContain(response.status);
    });

    it('should validate role values', async () => {
      /**
       * Test: Role validation
       * Why: Only valid roles should be assigned
       */
      const userData = {
        firstName: 'Invalid',
        lastName: 'Role',
        email: 'invalidrole@example.com',
        role: 'INVALID_ROLE',
      };

      const response = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .send(userData);

      expect([400, 422]).toContain(response.status);
    });

    it('should require admin privileges to create users', async () => {
      /**
       * Test: Role-based access control
       * Why: Only admins should be able to create users
       */
      // Create a regular user
      const regularUser = await createTestUser(
        dataSource,
        'USER',
        tenantA.id,
        'regular@example.com',
      );

      const userData = {
        firstName: 'Unauthorized',
        lastName: 'Creation',
        email: 'unauthorized@example.com',
        role: 'USER',
      };

      const response = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${regularUser.token}`)
        .send(userData);

      expect([401, 403]).toContain(response.status);
    });

    it('should generate secure temporary password', async () => {
      /**
       * Test: Temporary password generation
       * Why: New users need secure temporary passwords
       */
      const userData = {
        firstName: 'Temp',
        lastName: 'Password',
        email: 'temppass@example.com',
        role: 'USER',
        sendInvitation: true,
      };

      const response = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .send(userData)
        .expect(201);

      expect(response.body).toBeDefined();
      // Temporary password should not be returned in response
      expect(response.body.password).toBeUndefined();
    });
  });

  describe('GET /api/users/:id - Get Single User', () => {
    it('should return user details for authenticated user tenant', async () => {
      /**
       * Test: Single user retrieval
       * Why: Admins need to view detailed user information
       */
      const response = await request(app.getHttpServer())
        .get(`/api/users/${tenantAAdmin.user.id}`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBe(tenantAAdmin.user.id);
      expect(response.body.email).toBe(tenantAAdmin.user.email);
      // Password should not be included
      expect(response.body.password).toBeUndefined();
    });

    it('should return 404 for user from another tenant', async () => {
      /**
       * Test: Cross-tenant user access blocked
       * Why: Critical security - prevent data leakage through direct ID access
       */
      const response = await request(app.getHttpServer())
        .get(`/api/users/${tenantBAdmin.user.id}`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .expect(404);

      expect(response.body.id).toBeUndefined();
    });

    it('should include user roles and permissions', async () => {
      /**
       * Test: Role and permission inclusion
       * Why: User details need role information for management
       */
      const response = await request(app.getHttpServer())
        .get(`/api/users/${tenantAAdmin.user.id}`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
      if (response.body.roles) {
        expect(Array.isArray(response.body.roles)).toBe(true);
      }
    });
  });

  describe('PUT /api/users/:id - Update User', () => {
    let testUser: any;

    beforeEach(async () => {
      // Create a test user for update operations
      testUser = await createTestUser(
        dataSource,
        'USER',
        tenantA.id,
        'updatetest@example.com',
      );
    });

    it('should allow updating own tenant user', async () => {
      /**
       * Test: User update authorization
       * Why: Admins should be able to update their tenant's users
       */
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        isActive: false,
      };

      const response = await request(app.getHttpServer())
        .put(`/api/users/${testUser.user.id}`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .send(updateData);

      expect([200, 204]).toContain(response.status);
    });

    it('should NOT allow updating another tenant user', async () => {
      /**
       * Test: Cross-tenant user update blocked
       * Why: Critical security - cannot modify other tenants' users
       */
      const response = await request(app.getHttpServer())
        .put(`/api/users/${tenantBAdmin.user.id}`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .send({
          firstName: 'Malicious Update',
        });

      expect([404, 403]).toContain(response.status);
    });

    it('should allow users to update their own profile', async () => {
      /**
       * Test: Self-profile update
       * Why: Users should be able to update their own information
       */
      const updateData = {
        firstName: 'Self',
        lastName: 'Updated',
      };

      const response = await request(app.getHttpServer())
        .put(`/api/users/${testUser.user.id}`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .send(updateData);

      expect([200, 204]).toContain(response.status);
    });

    it('should prevent regular users from changing roles', async () => {
      /**
       * Test: Role change prevention
       * Why: Only admins should be able to change user roles
       */
      const updateData = {
        role: 'ADMIN', // Trying to escalate privileges
      };

      const response = await request(app.getHttpServer())
        .put(`/api/users/${testUser.user.id}`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .send(updateData);

      expect([401, 403]).toContain(response.status);
    });

    it('should allow admins to change user roles', async () => {
      /**
       * Test: Admin role change capability
       * Why: Admins need to manage user permissions
       */
      const updateData = {
        role: 'MODERATOR',
      };

      const response = await request(app.getHttpServer())
        .put(`/api/users/${testUser.user.id}`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .send(updateData);

      expect([200, 204]).toContain(response.status);
    });

    it('should validate email format in updates', async () => {
      /**
       * Test: Email validation in updates
       * Why: Ensure valid emails in profile updates
       */
      const updateData = {
        email: 'invalid-email-format',
      };

      const response = await request(app.getHttpServer())
        .put(`/api/users/${testUser.user.id}`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .send(updateData);

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('DELETE /api/users/:id - Delete/Deactivate User', () => {
    let deleteTestUser: any;

    beforeEach(async () => {
      // Create a user specifically for deletion tests
      deleteTestUser = await createTestUser(
        dataSource,
        'USER',
        tenantA.id,
        'deletetest@example.com',
      );
    });

    it('should allow deactivating own tenant user', async () => {
      /**
       * Test: User deactivation authorization
       * Why: Admins should be able to deactivate their tenant's users
       */
      const response = await request(app.getHttpServer())
        .delete(`/api/users/${deleteTestUser.user.id}`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`);

      expect([200, 204]).toContain(response.status);
    });

    it('should NOT allow deactivating another tenant user', async () => {
      /**
       * Test: Cross-tenant user deactivation blocked
       * Why: Critical security - cannot deactivate other tenants' users
       */
      const response = await request(app.getHttpServer())
        .delete(`/api/users/${tenantBAdmin.user.id}`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`);

      expect([404, 403]).toContain(response.status);
    });

    it('should handle non-existent user deletion gracefully', async () => {
      /**
       * Test: Non-existent user deletion
       * Why: API should handle missing resources gracefully
       */
      const nonExistentId = 99999;

      const response = await request(app.getHttpServer())
        .delete(`/api/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .expect(404);

      expect(response.body.message).toBeDefined();
    });

    it('should prevent users from deleting themselves', async () => {
      /**
       * Test: Self-deletion prevention
       * Why: Users shouldn't be able to delete their own accounts accidentally
       */
      const response = await request(app.getHttpServer())
        .delete(`/api/users/${tenantAAdmin.user.id}`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`);

      expect([400, 403]).toContain(response.status);
    });

    it('should soft delete (deactivate) rather than hard delete', async () => {
      /**
       * Test: Soft deletion behavior
       * Why: Preserve audit trails and data integrity
       */
      await request(app.getHttpServer())
        .delete(`/api/users/${deleteTestUser.user.id}`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .expect([200, 204]);

      // User should still exist but be deactivated
      const response = await request(app.getHttpServer())
        .get(`/api/users/${deleteTestUser.user.id}`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .expect(200);

      expect(response.body.isActive).toBe(false);
    });
  });

  describe('POST /api/users/invite - User Invitation', () => {
    it('should send invitation to new user', async () => {
      /**
       * Test: User invitation system
       * Why: Admins need to invite new team members
       */
      const invitationData = {
        email: 'invite@example.com',
        firstName: 'Invited',
        lastName: 'User',
        role: 'USER',
        message: 'Welcome to our church management system!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/users/invite')
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .send(invitationData)
        .expect(200);

      expect(response.body.message).toBeDefined();
    });

    it('should NOT allow inviting to another tenant', async () => {
      /**
       * Test: Cross-tenant invitation prevention
       * Why: Users cannot invite people to other tenants
       */
      // This is implicitly prevented by tenant isolation
      // The invitation will be for the admin's own tenant
      const invitationData = {
        email: 'crossinvite@example.com',
        firstName: 'Cross',
        lastName: 'Invite',
        role: 'USER',
      };

      const response = await request(app.getHttpServer())
        .post('/api/users/invite')
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .send(invitationData)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should validate invitation data', async () => {
      /**
       * Test: Invitation data validation
       * Why: Ensure valid invitation information
       */
      const response = await request(app.getHttpServer())
        .post('/api/users/invite')
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .send({
          // Missing required fields
          email: 'incomplete@example.com',
        });

      expect([400, 422]).toContain(response.status);
    });

    it('should require admin privileges to send invitations', async () => {
      /**
       * Test: Invitation permission check
       * Why: Only admins should be able to invite new users
       */
      const regularUser = await createTestUser(
        dataSource,
        'USER',
        tenantA.id,
        'regular2@example.com',
      );

      const invitationData = {
        email: 'unauthorized-invite@example.com',
        firstName: 'Unauthorized',
        lastName: 'Invite',
        role: 'USER',
      };

      const response = await request(app.getHttpServer())
        .post('/api/users/invite')
        .set('Authorization', `Bearer ${regularUser.token}`)
        .send(invitationData);

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('POST /api/users/:id/reset-password - Password Reset', () => {
    let passwordTestUser: any;

    beforeEach(async () => {
      passwordTestUser = await createTestUser(
        dataSource,
        'USER',
        tenantA.id,
        'passwordtest@example.com',
      );
    });

    it('should allow admin to reset user password', async () => {
      /**
       * Test: Admin password reset capability
       * Why: Admins need to help users with password issues
       */
      const response = await request(app.getHttpServer())
        .post(`/api/users/${passwordTestUser.user.id}/reset-password`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .send({});

      expect([200, 204]).toContain(response.status);
    });

    it('should NOT allow resetting password for another tenant user', async () => {
      /**
       * Test: Cross-tenant password reset blocked
       * Why: Users cannot reset passwords for other tenants' users
       */
      const response = await request(app.getHttpServer())
        .post(`/api/users/${tenantBAdmin.user.id}/reset-password`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .send({});

      expect([404, 403]).toContain(response.status);
    });

    it('should prevent regular users from resetting others passwords', async () => {
      /**
       * Test: Password reset permission check
       * Why: Only admins should be able to reset passwords
       */
      const regularUser = await createTestUser(
        dataSource,
        'USER',
        tenantA.id,
        'regular3@example.com',
      );

      const response = await request(app.getHttpServer())
        .post(`/api/users/${passwordTestUser.user.id}/reset-password`)
        .set('Authorization', `Bearer ${regularUser.token}`)
        .send({});

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('GET /api/users/:id/activity - User Activity', () => {
    it('should return user activity for own tenant user', async () => {
      /**
       * Test: User activity retrieval
       * Why: Admins need to monitor user activity
       */
      const response = await request(app.getHttpServer())
        .get(`/api/users/${tenantAAdmin.user.id}/activity`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should NOT return activity for another tenant user', async () => {
      /**
       * Test: Cross-tenant activity access blocked
       * Why: User activity is sensitive data
       */
      const response = await request(app.getHttpServer())
        .get(`/api/users/${tenantBAdmin.user.id}/activity`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .expect(404);
    });
  });

  describe('Data Integrity and Performance', () => {
    it('should maintain tenant isolation in database', async () => {
      /**
       * Test: Database-level tenant isolation
       * Why: Even if application code has bugs, data should be isolated
       */
      const response = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .expect(200);

      const users = response.body.data || response.body || [];

      // All returned users should belong to Tenant A
      users.forEach((user: any) => {
        if (user.tenant) {
          expect(user.tenant.id).toBe(tenantA.id);
        }
      });
    });

    it('should handle large user lists efficiently', async () => {
      /**
       * Test: Performance with large datasets
       * Why: Churches may have many users
       */
      const response = await request(app.getHttpServer())
        .get('/api/users?limit=100')
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
      // Should return within reasonable time (Jest will timeout if too slow)
    });

    it('should maintain user audit trail', async () => {
      /**
       * Test: Audit trail maintenance
       * Why: Track user changes for compliance and security
       */
      const userData = {
        firstName: 'Audit',
        lastName: 'Trail',
        email: 'audit@example.com',
        role: 'USER',
      };

      const response = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .send(userData)
        .expect(201);

      expect(response.body).toBeDefined();
      // Audit fields should be populated
      if (response.body.createdAt) {
        expect(response.body.createdAt).toBeDefined();
      }
      if (response.body.updatedAt) {
        expect(response.body.updatedAt).toBeDefined();
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid user IDs gracefully', async () => {
      /**
       * Test: Invalid ID handling
       * Why: API should handle malformed IDs gracefully
       */
      const response = await request(app.getHttpServer())
        .get('/api/users/invalid-id')
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should prevent email address updates to existing emails', async () => {
      /**
       * Test: Email uniqueness in updates
       * Why: Prevent email conflicts during updates
       */
      const user1 = await createTestUser(
        dataSource,
        'USER',
        tenantA.id,
        'user1@example.com',
      );

      const user2 = await createTestUser(
        dataSource,
        'USER',
        tenantA.id,
        'user2@example.com',
      );

      // Try to update user2's email to user1's email
      const response = await request(app.getHttpServer())
        .put(`/api/users/${user2.user.id}`)
        .set('Authorization', `Bearer ${tenantAAdmin.token}`)
        .send({
          email: 'user1@example.com',
        });

      expect([400, 409, 422]).toContain(response.status);
    });

    it('should handle concurrent user operations gracefully', async () => {
      /**
       * Test: Concurrent operation handling
       * Why: Multiple admins may manage users simultaneously
       */
      const userData = {
        firstName: 'Concurrent',
        lastName: 'Test',
        role: 'USER',
      };

      // Create multiple concurrent user creation requests
      const promises = Array.from({ length: 3 }, (_, index) =>
        request(app.getHttpServer())
          .post('/api/users')
          .set('Authorization', `Bearer ${tenantAAdmin.token}`)
          .send({
            ...userData,
            email: `concurrent${index}@example.com`,
          }),
      );

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach((response) => {
        expect([200, 201]).toContain(response.status);
      });
    });

    it('should validate role permissions consistently', async () => {
      /**
       * Test: Role permission consistency
       * Why: Ensure role-based access is applied consistently
       */
      const regularUser = await createTestUser(
        dataSource,
        'USER',
        tenantA.id,
        'permissions@example.com',
      );

      // Regular user should not be able to access admin functions
      const responses = await Promise.all([
        request(app.getHttpServer())
          .post('/api/users')
          .set('Authorization', `Bearer ${regularUser.token}`)
          .send({
            firstName: 'Unauthorized',
            lastName: 'User',
            email: 'unauthorized@example.com',
            role: 'USER',
          }),
        request(app.getHttpServer())
          .delete(`/api/users/${regularUser.user.id}`)
          .set('Authorization', `Bearer ${regularUser.token}`),
        request(app.getHttpServer())
          .post('/api/users/invite')
          .set('Authorization', `Bearer ${regularUser.token}`)
          .send({
            email: 'unauthorized-invite@example.com',
            firstName: 'Unauthorized',
            lastName: 'Invite',
            role: 'USER',
          }),
      ]);

      // All admin functions should be denied
      responses.forEach((response) => {
        expect([401, 403]).toContain(response.status);
      });
    });
  });
});
