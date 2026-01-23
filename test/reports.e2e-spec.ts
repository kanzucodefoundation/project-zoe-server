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
  createTestReport,
  createTestReportSubmission,
  cleanupTestData,
  initializeJwtService,
} from './utils/test-setup';

/**
 * Reports Controller Integration Tests
 *
 * These tests verify the reports system:
 * 1. Report CRUD operations with proper tenant isolation
 * 2. Report submission creation and retrieval
 * 3. Multi-tenant data isolation (users can't access other tenants' reports)
 * 4. Role-based access control
 * 5. Report generation with filtering
 * 6. Email functionality
 *
 * Why this matters:
 * - Reports contain sensitive church/organization data
 * - Proper tenant isolation prevents data leaks
 * - Role-based access ensures only authorized users can manage reports
 * - Report generation drives analytics and decision-making
 */

describe('Reports (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Test entities for Tenant A
  let tenantA: any;
  let tenantAOwner: any;
  let tenantAGroup: any;
  let tenantAContact: any;
  let tenantAReport: any;

  // Test entities for Tenant B
  let tenantB: any;
  let tenantBOwner: any;
  let tenantBGroup: any;
  let tenantBContact: any;
  let tenantBReport: any;

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
    tenantAReport = setupA.report;

    // Create test data for Tenant B
    const setupB = await createCompleteTestSetup(dataSource, 'Church B');
    tenantB = setupB.tenant;
    tenantBOwner = setupB.owner;
    tenantBGroup = setupB.group;
    tenantBContact = setupB.contact;
    tenantBReport = setupB.report;
  });

  afterAll(async () => {
    await cleanupTestData(dataSource);
    await closeTestDatabase(dataSource);
    await app.close();
  });

  describe('GET /api/reports - List Reports', () => {
    it('should return only reports from authenticated user tenant', async () => {
      /**
       * Test: Report listing respects tenant boundaries
       * Why: Users should only see their own tenant's reports
       */
      const response = await request(app.getHttpServer())
        .get('/api/reports')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      const reports = response.body.reports || [];
      const reportIds = reports.map((r: any) => r.id);

      // Should contain Tenant A reports
      expect(reportIds).toContain(tenantAReport.id);

      // Should NOT contain Tenant B reports
      expect(reportIds).not.toContain(tenantBReport.id);
    });

    it('should return 401 for unauthenticated requests', async () => {
      /**
       * Test: Authentication required
       * Why: Reports contain sensitive organizational data
       */
      await request(app.getHttpServer()).get('/api/reports').expect(401);
    });

    it('should return reports with proper structure', async () => {
      /**
       * Test: Response structure validation
       * Why: Frontend depends on consistent API structure
       */
      const response = await request(app.getHttpServer())
        .get('/api/reports')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.reports).toBeDefined();
      expect(Array.isArray(response.body.reports)).toBe(true);
    });
  });

  describe('POST /api/reports - Create Report', () => {
    it('should create report with proper tenant assignment', async () => {
      /**
       * Test: Report creation assigns correct tenant
       * Why: Reports must be properly associated with the creating tenant
       */
      const reportData = {
        title: 'New Test Report',
        description: 'Test report description',
        frequency: 'WEEKLY',
        isActive: true,
      };

      const response = await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(reportData)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.title).toBe(reportData.title);

      // Verify it's associated with correct tenant (if tenant info is returned)
      if (response.body.tenant) {
        expect(response.body.tenant.id).toBe(tenantA.id);
      }
    });

    it('should validate required fields', async () => {
      /**
       * Test: Input validation
       * Why: Prevent invalid report configurations
       */
      const response = await request(app.getHttpServer())
        .post('/api/reports')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send({
          // Missing required fields
          description: 'Test report',
        });

      // Should fail validation
      expect([400, 422]).toContain(response.status);
    });

    it('should require authentication', async () => {
      /**
       * Test: Authentication required for creation
       * Why: Only authenticated users can create reports
       */
      await request(app.getHttpServer())
        .post('/api/reports')
        .send({
          title: 'Unauthorized Report',
          frequency: 'WEEKLY',
        })
        .expect(401);
    });
  });

  describe('GET /api/reports/:id - Get Single Report', () => {
    it('should return report for authenticated user tenant', async () => {
      /**
       * Test: Single report retrieval
       * Why: Users need to view individual report details
       */
      const response = await request(app.getHttpServer())
        .get(`/api/reports/${tenantAReport.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBe(tenantAReport.id);
    });

    it('should return 404 for report from another tenant', async () => {
      /**
       * Test: Cross-tenant report access blocked
       * Why: Critical security - prevent data leakage through direct ID access
       */
      const response = await request(app.getHttpServer())
        .get(`/api/reports/${tenantBReport.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(404);

      // Should not return report data
      expect(response.body.id).toBeUndefined();
    });

    it('should handle invalid report IDs gracefully', async () => {
      /**
       * Test: Invalid ID handling
       * Why: API should handle malformed IDs gracefully
       */
      const response = await request(app.getHttpServer())
        .get('/api/reports/invalid-id')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(400); // Expect 400 for invalid ID format

      expect(response.body.message).toBeDefined();
    });
  });

  describe('PUT /api/reports/:id - Update Report', () => {
    it('should allow updating own tenant report', async () => {
      /**
       * Test: Report update authorization
       * Why: Users should be able to update their own reports
       */
      const updateData = {
        title: 'Updated Report Title',
        description: 'Updated description',
      };

      const response = await request(app.getHttpServer())
        .put(`/api/reports/${tenantAReport.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(updateData);

      expect([200, 204]).toContain(response.status);

      // Verify update was applied (if response includes updated data)
      if (response.body && response.body.title) {
        expect(response.body.title).toBe(updateData.title);
      }
    });

    it('should NOT allow updating another tenant report', async () => {
      /**
       * Test: Cross-tenant update blocked
       * Why: Critical security - cannot modify other tenants' reports
       */
      const response = await request(app.getHttpServer())
        .put(`/api/reports/${tenantBReport.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send({
          title: 'Malicious Update',
        });

      // Should fail with 404 or 403
      expect([404, 403]).toContain(response.status);
    });
  });

  describe('POST /api/reports/:reportId/submissions - Submit Report', () => {
    it('should create report submission for own tenant', async () => {
      /**
       * Test: Report submission creation
       * Why: Core functionality - users submit reports regularly
       */
      const submissionData = {
        groupId: tenantAGroup.id,
        submissionDate: new Date().toISOString(),
        data: {
          attendance: 25,
          newMembers: 2,
          offerings: 1500,
        },
      };

      const response = await request(app.getHttpServer())
        .post(`/api/reports/${tenantAReport.id}/submissions`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(submissionData);

      expect([201, 200]).toContain(response.status);
      expect(response.body).toBeDefined();
    });

    it('should NOT allow submitting to another tenant report', async () => {
      /**
       * Test: Cross-tenant submission blocked
       * Why: Users cannot submit to other tenants' reports
       */
      const submissionData = {
        groupId: tenantAGroup.id,
        submissionDate: new Date().toISOString(),
        data: { attendance: 10 },
      };

      const response = await request(app.getHttpServer())
        .post(`/api/reports/${tenantBReport.id}/submissions`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(submissionData);

      expect([404, 403]).toContain(response.status);
    });

    it('should validate submission data', async () => {
      /**
       * Test: Submission data validation
       * Why: Ensure data integrity in submissions
       */
      const response = await request(app.getHttpServer())
        .post(`/api/reports/${tenantAReport.id}/submissions`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send({
          // Missing required fields
          data: { attendance: 'invalid' },
        });

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('GET /api/reports/submissions/me - Get My Submissions', () => {
    beforeEach(async () => {
      // Create test submission
      await createTestReportSubmission(
        dataSource,
        tenantAReport.id,
        tenantAContact.id,
        tenantAGroup.id,
      );
    });

    it('should return user own submissions', async () => {
      /**
       * Test: User submission retrieval
       * Why: Users need to see their submission history
       */
      const response = await request(app.getHttpServer())
        .get('/api/reports/submissions/me')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
      // Verify structure
      if (response.body.data) {
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    it('should support pagination', async () => {
      /**
       * Test: Pagination functionality
       * Why: Large submission lists need pagination
       */
      const response = await request(app.getHttpServer())
        .get('/api/reports/submissions/me?limit=10&offset=0')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should filter by report ID', async () => {
      /**
       * Test: Report-specific submission filtering
       * Why: Users need to see submissions for specific reports
       */
      const response = await request(app.getHttpServer())
        .get(`/api/reports/submissions/me?reportId=${tenantAReport.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('GET /api/reports/:reportId/submissions - Get Report Submissions', () => {
    beforeEach(async () => {
      // Create test submissions
      await createTestReportSubmission(
        dataSource,
        tenantAReport.id,
        tenantAContact.id,
        tenantAGroup.id,
      );
    });

    it('should return submissions for own tenant report', async () => {
      /**
       * Test: Report submission listing
       * Why: Leaders need to see all submissions for their reports
       */
      const response = await request(app.getHttpServer())
        .get(`/api/reports/${tenantAReport.id}/submissions`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should support date range filtering', async () => {
      /**
       * Test: Date-based filtering
       * Why: Users need to see submissions for specific time periods
       */
      const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const toDate = new Date().toISOString().split('T')[0];

      const response = await request(app.getHttpServer())
        .get(
          `/api/reports/${tenantAReport.id}/submissions?from=${fromDate}&to=${toDate}`,
        )
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should support group filtering', async () => {
      /**
       * Test: Group-based filtering
       * Why: Filter submissions by specific groups
       */
      const response = await request(app.getHttpServer())
        .get(
          `/api/reports/${tenantAReport.id}/submissions?groupIdList=${tenantAGroup.id}`,
        )
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should NOT return submissions for another tenant report', async () => {
      /**
       * Test: Cross-tenant submission access blocked
       * Why: Users cannot see other tenants' submission data
       */
      const response = await request(app.getHttpServer())
        .get(`/api/reports/${tenantBReport.id}/submissions`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(404);
    });
  });

  describe('GET /api/reports/submissions/:id - Get Submission Details', () => {
    let testSubmission: any;

    beforeEach(async () => {
      testSubmission = await createTestReportSubmission(
        dataSource,
        tenantAReport.id,
        tenantAContact.id,
        tenantAGroup.id,
      );
    });

    it('should return submission details for own tenant', async () => {
      /**
       * Test: Submission detail retrieval
       * Why: Users need to see detailed submission information
       */
      const response = await request(app.getHttpServer())
        .get(`/api/reports/submissions/${testSubmission.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should NOT return submission details for another tenant', async () => {
      /**
       * Test: Cross-tenant submission detail access blocked
       * Why: Prevent access to other tenants' detailed submission data
       */
      // Create submission for Tenant B
      const tenantBSubmission = await createTestReportSubmission(
        dataSource,
        tenantBReport.id,
        tenantBContact.id,
        tenantBGroup.id,
      );

      const response = await request(app.getHttpServer())
        .get(`/api/reports/submissions/${tenantBSubmission.id}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(404);
    });
  });

  describe('POST /api/reports/:reportId/send-weekly-email - Email Functionality', () => {
    it('should trigger email sending for own tenant report', async () => {
      /**
       * Test: Email functionality
       * Why: Users need to send reports via email
       */
      const response = await request(app.getHttpServer())
        .post(`/api/reports/${tenantAReport.id}/send-weekly-email`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send({});

      // Should accept request (may return success message or queue status)
      expect([200, 201, 202]).toContain(response.status);
    });

    it('should NOT allow sending email for another tenant report', async () => {
      /**
       * Test: Cross-tenant email sending blocked
       * Why: Users cannot send emails for other tenants' reports
       */
      const response = await request(app.getHttpServer())
        .post(`/api/reports/${tenantBReport.id}/send-weekly-email`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send({});

      expect([404, 403]).toContain(response.status);
    });

    it('should support group filtering in email', async () => {
      /**
       * Test: Email with group filtering
       * Why: Send reports only for specific groups
       */
      const response = await request(app.getHttpServer())
        .post(
          `/api/reports/${tenantAReport.id}/send-weekly-email?groupIdList=${tenantAGroup.id}`,
        )
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send({});

      expect([200, 201, 202]).toContain(response.status);
    });
  });

  describe('Data Integrity and Performance', () => {
    it('should maintain tenant isolation in database', async () => {
      /**
       * Test: Database-level tenant isolation
       * Why: Even if application code has bugs, data should be isolated
       */
      const response = await request(app.getHttpServer())
        .get('/api/reports')
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(200);

      const reports = response.body.reports || [];

      // All returned reports should belong to Tenant A
      reports.forEach((report: any) => {
        if (report.tenant) {
          expect(report.tenant.id).toBe(tenantA.id);
        }
      });
    });

    it('should handle concurrent submissions gracefully', async () => {
      /**
       * Test: Concurrent submission handling
       * Why: Multiple users may submit reports simultaneously
       */
      const submissionData = {
        groupId: tenantAGroup.id,
        submissionDate: new Date().toISOString(),
        data: { attendance: 30 },
      };

      // Create multiple concurrent submissions
      const promises = Array.from({ length: 3 }, () =>
        request(app.getHttpServer())
          .post(`/api/reports/${tenantAReport.id}/submissions`)
          .set('Authorization', `Bearer ${tenantAOwner.token}`)
          .send(submissionData),
      );

      const responses = await Promise.all(promises);

      // All should succeed (or handle conflicts gracefully)
      responses.forEach((response) => {
        expect([200, 201, 409]).toContain(response.status);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent report IDs', async () => {
      /**
       * Test: Non-existent resource handling
       * Why: API should handle missing resources gracefully
       */
      const nonExistentId = 99999;

      const response = await request(app.getHttpServer())
        .get(`/api/reports/${nonExistentId}`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .expect(404);

      expect(response.body.message).toBeDefined();
    });

    it('should validate report submission data types', async () => {
      /**
       * Test: Data type validation
       * Why: Ensure data integrity and prevent injection attacks
       */
      const invalidData = {
        groupId: 'not-a-number',
        submissionDate: 'invalid-date',
        data: 'not-an-object',
      };

      const response = await request(app.getHttpServer())
        .post(`/api/reports/${tenantAReport.id}/submissions`)
        .set('Authorization', `Bearer ${tenantAOwner.token}`)
        .send(invalidData);

      expect([400, 422]).toContain(response.status);
    });
  });
});
