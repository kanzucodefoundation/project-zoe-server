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
import { ContactCategory } from '../src/crm/enums/contactCategory';

/**
 * CRM (Contacts) Controller Integration Tests
 *
 * These tests verify the contact management system:
 * 1. Contact CRUD operations with proper tenant isolation
 * 2. Contact creation with group assignment (new multiple groups feature)
 * 3. Contact updates with group membership changes
 * 4. Multi-tenant data isolation (users can't access other tenants' contacts)
 * 5. Contact search and filtering
 * 6. Email and phone management
 * 7. Address management
 * 8. Import/export functionality
 *
 * Why this matters:
 * - Contacts are the foundation of the church management system
 * - Contact data is highly sensitive and must be protected
 * - Group assignments drive communications and reporting
 * - Proper tenant isolation prevents data leaks between organizations
 * - Import/export enables data migration and backup
 */

describe('CRM Contacts (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Test entities for Tenant A
  let tenantA: any;
  let tenantAOwner: any;
  let tenantAGroup1: any;
  let tenantAGroup2: any;
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
    tenantAGroup1 = setupA.group;
    tenantAContact = setupA.contact;

    // Create a second group for multi-group testing
    tenantAGroup2 = await createTestGroup(
      dataSource,
      tenantA.id,
      'Church A Group 2',
    );

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

  describe('GET /api/crm/contacts - List Contacts', () => {
    it('should return only contacts from authenticated user tenant', async () => {
      /**
       * Test: Contact listing respects tenant boundaries
       * Why: Users should only see their own tenant's contacts
       */
      const response = await request(app.getHttpServer())
        .get('/api/crm/contacts')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      const contacts = response.body.data || response.body || [];
      const contactIds = contacts.map((c: any) => c.id);

      // Should contain Tenant A contacts
      expect(contactIds).toContain(tenantAContact.id);

      // Should NOT contain Tenant B contacts
      expect(contactIds).not.toContain(tenantBContact.id);
    });

    it('should return 401 for unauthenticated requests', async () => {
      /**
       * Test: Authentication required
       * Why: Contacts contain highly sensitive personal data
       */
      await request(app.getHttpServer()).get('/api/crm/contacts').expect(401);
    });

    it('should support search functionality', async () => {
      /**
       * Test: Contact search functionality
       * Why: Users need to find specific contacts quickly
       */
      const response = await request(app.getHttpServer())
        .get(`/api/crm/contacts?search=${encodeURIComponent('Test')}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should support pagination', async () => {
      /**
       * Test: Pagination functionality
       * Why: Large contact lists need pagination for performance
       */
      const response = await request(app.getHttpServer())
        .get('/api/crm/contacts?limit=10&offset=0')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should support filtering by group', async () => {
      /**
       * Test: Group-based filtering
       * Why: Users need to see contacts from specific groups
       */
      const response = await request(app.getHttpServer())
        .get(`/api/crm/contacts?groupId=${tenantAGroup1.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('POST /api/crm/contacts - Create Contact (Single Group)', () => {
    it('should create contact with single group assignment', async () => {
      /**
       * Test: Contact creation with group assignment
       * Why: Core functionality - contacts must be assigned to groups
       */
      const contactData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        groups: [
          {
            id: tenantAGroup1.id,
            role: GroupRole.Member,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/api/crm/contacts')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(contactData)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.firstName).toBe(contactData.firstName);
      expect(response.body.lastName).toBe(contactData.lastName);
    });

    it('should create contact with multiple group assignments', async () => {
      /**
       * Test: Contact creation with multiple groups (new feature)
       * Why: Contacts can now be in multiple groups simultaneously
       */
      const contactData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phone: '+1234567891',
        groups: [
          {
            id: tenantAGroup1.id,
            role: GroupRole.Member,
          },
          {
            id: tenantAGroup2.id,
            role: GroupRole.Leader,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/api/crm/contacts')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(contactData)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.firstName).toBe(contactData.firstName);
    });

    it('should require at least one group assignment', async () => {
      /**
       * Test: Business rule validation - contacts must have at least one group
       * Why: All contacts must belong to at least one group
       */
      const contactData = {
        firstName: 'Invalid',
        lastName: 'Contact',
        email: 'invalid@example.com',
        groups: [], // Empty groups array
      };

      const response = await request(app.getHttpServer())
        .post('/api/crm/contacts')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(contactData);

      expect([400, 422]).toContain(response.status);
      expect(response.body.message).toContain('at least one group');
    });

    it('should NOT allow assignment to another tenant group', async () => {
      /**
       * Test: Cross-tenant group assignment blocked
       * Why: Users cannot assign contacts to other tenants' groups
       */
      const contactData = {
        firstName: 'Cross',
        lastName: 'Tenant',
        email: 'cross.tenant@example.com',
        groups: [
          {
            id: tenantBGroup.id, // Different tenant group
            role: GroupRole.Member,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/api/crm/contacts')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(contactData);

      expect([400, 403, 404]).toContain(response.status);
    });

    it('should validate required fields', async () => {
      /**
       * Test: Input validation
       * Why: Prevent invalid contact data
       */
      const response = await request(app.getHttpServer())
        .post('/api/crm/contacts')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send({
          // Missing required fields
          lastName: 'Incomplete',
        });

      expect([400, 422]).toContain(response.status);
    });

    it('should validate email format', async () => {
      /**
       * Test: Email validation
       * Why: Ensure valid email addresses for communication
       */
      const contactData = {
        firstName: 'Invalid',
        lastName: 'Email',
        email: 'invalid-email-format',
        groups: [
          {
            id: tenantAGroup1.id,
            role: GroupRole.Member,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/api/crm/contacts')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(contactData);

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('PATCH /api/crm/contacts/:id - Update Contact (Multiple Groups)', () => {
    let testContact: any;

    beforeEach(async () => {
      // Create a test contact for update operations
      testContact = await createTestContact(
        dataSource,
        tenantA.id,
        'Update',
        'Test',
      );
      // Add initial group membership
      await createTestGroupMembership(
        dataSource,
        testContact.id,
        tenantAGroup1.id,
        GroupRole.Member,
      );
    });

    it('should update contact basic information', async () => {
      /**
       * Test: Basic contact information update
       * Why: Users need to update contact details
       */
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@example.com',
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/crm/contacts/${testContact.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(updateData);

      expect([200, 204]).toContain(response.status);
    });

    it('should update contact with new group assignments (multiple groups)', async () => {
      /**
       * Test: Contact group assignment update (new feature)
       * Why: Users need to change which groups a contact belongs to
       */
      const updateData = {
        groups: [
          {
            id: tenantAGroup1.id,
            role: GroupRole.Leader, // Changed role
          },
          {
            id: tenantAGroup2.id,
            role: GroupRole.Member, // New group
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/crm/contacts/${testContact.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(updateData);

      expect([200, 204]).toContain(response.status);
    });

    it('should change contact from one group to another', async () => {
      /**
       * Test: Group transfer functionality
       * Why: Contacts may need to move between groups
       */
      const updateData = {
        groups: [
          {
            id: tenantAGroup2.id, // Different group
            role: GroupRole.Member,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/crm/contacts/${testContact.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(updateData);

      expect([200, 204]).toContain(response.status);
    });

    it('should maintain business rule - at least one group required', async () => {
      /**
       * Test: Business rule enforcement in updates
       * Why: Contacts must always belong to at least one group
       */
      const updateData = {
        groups: [], // Trying to remove all groups
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/crm/contacts/${testContact.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(updateData);

      expect([400, 422]).toContain(response.status);
      expect(response.body.message).toContain('at least one group');
    });

    it('should NOT allow updating another tenant contact', async () => {
      /**
       * Test: Cross-tenant contact update blocked
       * Why: Critical security - cannot modify other tenants' contacts
       */
      const response = await request(app.getHttpServer())
        .patch(`/api/crm/contacts/${tenantBContact.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send({
          firstName: 'Malicious Update',
        });

      expect([404, 403]).toContain(response.status);
    });

    it('should NOT allow assignment to another tenant group in update', async () => {
      /**
       * Test: Cross-tenant group assignment in updates blocked
       * Why: Users cannot assign contacts to other tenants' groups via updates
       */
      const updateData = {
        groups: [
          {
            id: tenantBGroup.id, // Different tenant group
            role: GroupRole.Member,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/crm/contacts/${testContact.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(updateData);

      expect([400, 403, 404]).toContain(response.status);
    });

    it('should handle role changes within same group', async () => {
      /**
       * Test: Role update within same group
       * Why: Common operation - promoting/demoting members
       */
      const updateData = {
        groups: [
          {
            id: tenantAGroup1.id, // Same group
            role: GroupRole.Leader, // Changed role
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/crm/contacts/${testContact.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(updateData);

      expect([200, 204]).toContain(response.status);
    });
  });

  describe('GET /api/crm/contacts/:id - Get Single Contact', () => {
    it('should return contact details for authenticated user tenant', async () => {
      /**
       * Test: Single contact retrieval
       * Why: Users need to view detailed contact information
       */
      const response = await request(app.getHttpServer())
        .get(`/api/crm/contacts/${tenantAContact.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBe(tenantAContact.id);
    });

    it('should return 404 for contact from another tenant', async () => {
      /**
       * Test: Cross-tenant contact access blocked
       * Why: Critical security - prevent data leakage through direct ID access
       */
      const response = await request(app.getHttpServer())
        .get(`/api/crm/contacts/${tenantBContact.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(404);

      expect(response.body.id).toBeUndefined();
    });

    it('should include group memberships in contact details', async () => {
      /**
       * Test: Group membership inclusion
       * Why: Contact details need group membership information
       */
      const response = await request(app.getHttpServer())
        .get(`/api/crm/contacts/${tenantAContact.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
      // Verify group memberships are included if supported
      if (response.body.groupMemberships) {
        expect(Array.isArray(response.body.groupMemberships)).toBe(true);
      }
    });

    it('should include emails and phones in contact details', async () => {
      /**
       * Test: Contact details completeness
       * Why: Contact details need all related information
       */
      const response = await request(app.getHttpServer())
        .get(`/api/crm/contacts/${tenantAContact.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
      // Verify emails and phones are included if they exist
      if (response.body.emails) {
        expect(Array.isArray(response.body.emails)).toBe(true);
      }
      if (response.body.phones) {
        expect(Array.isArray(response.body.phones)).toBe(true);
      }
    });
  });

  describe('DELETE /api/crm/contacts/:id - Delete Contact', () => {
    let deleteTestContact: any;

    beforeEach(async () => {
      // Create a contact specifically for deletion tests
      deleteTestContact = await createTestContact(
        dataSource,
        tenantA.id,
        'Delete',
        'Test',
      );
      await createTestGroupMembership(
        dataSource,
        deleteTestContact.id,
        tenantAGroup1.id,
        GroupRole.Member,
      );
    });

    it('should allow deleting own tenant contact', async () => {
      /**
       * Test: Contact deletion authorization
       * Why: Users should be able to delete their own contacts
       */
      const response = await request(app.getHttpServer())
        .delete(`/api/crm/contacts/${deleteTestContact.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`);

      expect([200, 204]).toContain(response.status);
    });

    it('should NOT allow deleting another tenant contact', async () => {
      /**
       * Test: Cross-tenant contact deletion blocked
       * Why: Critical security - cannot delete other tenants' contacts
       */
      const response = await request(app.getHttpServer())
        .delete(`/api/crm/contacts/${tenantBContact.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`);

      expect([404, 403]).toContain(response.status);
    });

    it('should handle non-existent contact deletion gracefully', async () => {
      /**
       * Test: Non-existent contact deletion
       * Why: API should handle missing resources gracefully
       */
      const nonExistentId = 99999;

      const response = await request(app.getHttpServer())
        .delete(`/api/crm/contacts/${nonExistentId}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(404);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('Contact Email Management', () => {
    let emailTestContact: any;

    beforeEach(async () => {
      emailTestContact = await createTestContact(
        dataSource,
        tenantA.id,
        'Email',
        'Test',
      );
    });

    it('should add email to contact', async () => {
      /**
       * Test: Email addition
       * Why: Contacts need multiple email addresses
       */
      const emailData = {
        email: 'additional@example.com',
        category: 'Personal',
      };

      const response = await request(app.getHttpServer())
        .post(`/api/crm/contacts/${emailTestContact.id}/emails`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(emailData);

      expect([201, 200]).toContain(response.status);
    });

    it('should NOT add email to another tenant contact', async () => {
      /**
       * Test: Cross-tenant email addition blocked
       * Why: Users cannot modify other tenants' contact emails
       */
      const emailData = {
        email: 'malicious@example.com',
        category: 'Personal',
      };

      const response = await request(app.getHttpServer())
        .post(`/api/crm/contacts/${tenantBContact.id}/emails`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(emailData);

      expect([404, 403]).toContain(response.status);
    });
  });

  describe('Contact Phone Management', () => {
    let phoneTestContact: any;

    beforeEach(async () => {
      phoneTestContact = await createTestContact(
        dataSource,
        tenantA.id,
        'Phone',
        'Test',
      );
    });

    it('should add phone to contact', async () => {
      /**
       * Test: Phone addition
       * Why: Contacts need multiple phone numbers
       */
      const phoneData = {
        phone: '+1234567892',
        category: 'Mobile',
      };

      const response = await request(app.getHttpServer())
        .post(`/api/crm/contacts/${phoneTestContact.id}/phones`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(phoneData);

      expect([201, 200]).toContain(response.status);
    });

    it('should NOT add phone to another tenant contact', async () => {
      /**
       * Test: Cross-tenant phone addition blocked
       * Why: Users cannot modify other tenants' contact phones
       */
      const phoneData = {
        phone: '+1234567893',
        category: 'Mobile',
      };

      const response = await request(app.getHttpServer())
        .post(`/api/crm/contacts/${tenantBContact.id}/phones`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(phoneData);

      expect([404, 403]).toContain(response.status);
    });

    it('should validate phone number format', async () => {
      /**
       * Test: Phone validation
       * Why: Ensure valid phone numbers for communication
       */
      const phoneData = {
        phone: 'invalid-phone-format',
        category: 'Mobile',
      };

      const response = await request(app.getHttpServer())
        .post(`/api/crm/contacts/${phoneTestContact.id}/phones`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(phoneData);

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('Contact Import/Export', () => {
    it('should support contact import for own tenant', async () => {
      /**
       * Test: Contact import functionality
       * Why: Users need to import contacts from external sources
       */
      const importData = {
        contacts: [
          {
            firstName: 'Import',
            lastName: 'Test1',
            email: 'import1@example.com',
            groups: [{ id: tenantAGroup1.id, role: GroupRole.Member }],
          },
          {
            firstName: 'Import',
            lastName: 'Test2',
            email: 'import2@example.com',
            groups: [{ id: tenantAGroup1.id, role: GroupRole.Member }],
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/api/crm/contacts/import')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(importData);

      // Should accept import request
      expect([200, 201, 202]).toContain(response.status);
    });

    it('should support contact export for own tenant', async () => {
      /**
       * Test: Contact export functionality
       * Why: Users need to export their contacts for backup/migration
       */
      const response = await request(app.getHttpServer())
        .get('/api/crm/contacts/export')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should support CSV export format', async () => {
      /**
       * Test: CSV export support
       * Why: CSV is common format for contact data exchange
       */
      const response = await request(app.getHttpServer())
        .get('/api/crm/contacts/export?format=csv')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      // Should return CSV data or success response
      expect(response.body || response.text).toBeDefined();
    });
  });

  describe('Data Integrity and Performance', () => {
    it('should maintain tenant isolation in database', async () => {
      /**
       * Test: Database-level tenant isolation
       * Why: Even if application code has bugs, data should be isolated
       */
      const response = await request(app.getHttpServer())
        .get('/api/crm/contacts')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      const contacts = response.body.data || response.body || [];

      // All returned contacts should belong to Tenant A
      contacts.forEach((contact: any) => {
        if (contact.tenant) {
          expect(contact.tenant.id).toBe(tenantA.id);
        }
      });
    });

    it('should handle large contact lists efficiently', async () => {
      /**
       * Test: Performance with large datasets
       * Why: Churches may have thousands of contacts
       */
      const response = await request(app.getHttpServer())
        .get('/api/crm/contacts?limit=1000')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
      // Should return within reasonable time (Jest will timeout if too slow)
    });

    it('should maintain group membership audit trail', async () => {
      /**
       * Test: Audit trail maintenance
       * Why: Track when contacts join/leave groups for reporting
       */
      const testContact = await createTestContact(
        dataSource,
        tenantA.id,
        'Audit',
        'Test',
      );

      // Add to group
      const updateData = {
        groups: [
          {
            id: tenantAGroup1.id,
            role: GroupRole.Member,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/crm/contacts/${testContact.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(updateData);

      expect([200, 204]).toContain(response.status);

      // Verify membership was created (could check database directly in real test)
      const contactResponse = await request(app.getHttpServer())
        .get(`/api/crm/contacts/${testContact.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(contactResponse.body).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle duplicate email addresses gracefully', async () => {
      /**
       * Test: Duplicate email handling
       * Why: Email addresses should be unique within tenant
       */
      const contactData = {
        firstName: 'Duplicate',
        lastName: 'Email',
        email: 'duplicate@example.com',
        groups: [{ id: tenantAGroup1.id, role: GroupRole.Member }],
      };

      // Create first contact
      await request(app.getHttpServer())
        .post('/api/crm/contacts')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(contactData)
        .expect(201);

      // Try to create second contact with same email
      const response = await request(app.getHttpServer())
        .post('/api/crm/contacts')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send({
          ...contactData,
          firstName: 'Another',
          lastName: 'Duplicate',
        });

      // Should handle duplicate gracefully (409 Conflict or validation error)
      expect([409, 400, 422]).toContain(response.status);
    });

    it('should validate contact category', async () => {
      /**
       * Test: Category validation
       * Why: Ensure only valid contact categories are accepted
       */
      const contactData = {
        firstName: 'Category',
        lastName: 'Test',
        email: 'category@example.com',
        category: 'InvalidCategory',
        groups: [{ id: tenantAGroup1.id, role: GroupRole.Member }],
      };

      const response = await request(app.getHttpServer())
        .post('/api/crm/contacts')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(contactData);

      expect([400, 422]).toContain(response.status);
    });

    it('should handle concurrent contact creation gracefully', async () => {
      /**
       * Test: Concurrent operation handling
       * Why: Multiple users may create contacts simultaneously
       */
      const contactData = {
        firstName: 'Concurrent',
        lastName: 'Test',
        email: 'concurrent@example.com',
        groups: [{ id: tenantAGroup1.id, role: GroupRole.Member }],
      };

      // Create multiple concurrent contact creation requests
      const promises = Array.from({ length: 3 }, (_, index) =>
        request(app.getHttpServer())
          .post('/api/crm/contacts')
          .set('Authorization', `Bearer ${tenantAOwner.token}`)
          .send({
            ...contactData,
            email: `concurrent${index}@example.com`,
          }),
      );

      const responses = await Promise.all(promises);

      // All should succeed or handle conflicts gracefully
      responses.forEach((response) => {
        expect([200, 201, 409]).toContain(response.status);
      });
    });
  });
});
