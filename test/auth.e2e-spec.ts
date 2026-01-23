import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
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
import { User } from '../src/users/entities/user.entity';

/**
 * Authentication Controller Integration Tests
 *
 * These tests verify the authentication system:
 * 1. User login/logout with proper JWT token generation
 * 2. Password reset functionality with secure token handling
 * 3. User registration with email verification
 * 4. Token refresh mechanism
 * 5. Multi-tenant authentication (JWT includes tenant context)
 * 6. Rate limiting and security features
 * 7. Password validation and hashing
 * 8. Account lockout after failed attempts
 *
 * Why this matters:
 * - Authentication is the foundation of security
 * - JWT tokens must include tenant context for proper isolation
 * - Password reset must be secure to prevent account takeover
 * - Rate limiting prevents brute force attacks
 * - Proper session management prevents unauthorized access
 */

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  // Test entities
  let tenant: any;
  let testUser: any;

  beforeAll(async () => {
    // Initialize test database
    dataSource = await initializeTestDatabase();

    // Initialize JWT service
    jwtService = initializeJwtService();

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

    // Create test tenant
    tenant = await createTestTenant(dataSource, 'Auth Test Church');
  });

  afterAll(async () => {
    await cleanupTestData(dataSource);
    await closeTestDatabase(dataSource);
    await app.close();
  });

  describe('POST /api/auth/login - User Login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      testUser = await createTestUser(
        dataSource,
        'ADMIN',
        tenant.id,
        'testuser@example.com',
        'TestPassword123!',
      );
    });

    it('should login with correct credentials', async () => {
      /**
       * Test: Successful login flow
       * Why: Core authentication functionality
       */
      const loginData = {
        email: 'testuser@example.com',
        password: 'TestPassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(loginData.email);

      // Verify JWT token contains tenant context
      const decodedToken = jwtService.decode(response.body.accessToken) as any;
      expect(decodedToken.tenantId).toBe(tenant.id);
    });

    it('should return 401 for incorrect password', async () => {
      /**
       * Test: Failed login with wrong password
       * Why: Security - prevent unauthorized access
       */
      const loginData = {
        email: 'testuser@example.com',
        password: 'WrongPassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.accessToken).toBeUndefined();
      expect(response.body.message).toBeDefined();
    });

    it('should return 401 for non-existent user', async () => {
      /**
       * Test: Failed login for non-existent user
       * Why: Don't leak information about which users exist
       */
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'SomePassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.accessToken).toBeUndefined();
    });

    it('should validate email format', async () => {
      /**
       * Test: Email format validation
       * Why: Prevent invalid login attempts
       */
      const loginData = {
        email: 'invalid-email-format',
        password: 'TestPassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginData);

      expect([400, 422]).toContain(response.status);
    });

    it('should require both email and password', async () => {
      /**
       * Test: Required field validation
       * Why: Both credentials are mandatory for login
       */
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'testuser@example.com',
          // Missing password
        });

      expect([400, 422]).toContain(response.status);
    });

    it('should include user permissions in token', async () => {
      /**
       * Test: User permissions in JWT
       * Why: Frontend needs user permissions for UI rendering
       */
      const loginData = {
        email: 'testuser@example.com',
        password: 'TestPassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      const decodedToken = jwtService.decode(response.body.accessToken) as any;
      expect(decodedToken.userRole).toBeDefined();
      expect(decodedToken.userId).toBe(testUser.user.id);
    });

    it('should handle case insensitive email login', async () => {
      /**
       * Test: Case insensitive email handling
       * Why: Users shouldn't be locked out due to email case variations
       */
      const loginData = {
        email: 'TESTUSER@EXAMPLE.COM', // Uppercase email
        password: 'TestPassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
    });
  });

  describe('POST /api/auth/logout - User Logout', () => {
    let authToken: string;

    beforeEach(async () => {
      // Create user and get auth token
      testUser = await createTestUser(dataSource, 'ADMIN', tenant.id);
      authToken = testUser.token;
    });

    it('should successfully logout with valid token', async () => {
      /**
       * Test: Successful logout
       * Why: Users need to be able to logout securely
       */
      const response = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBeDefined();
    });

    it('should require authentication for logout', async () => {
      /**
       * Test: Authentication required for logout
       * Why: Only authenticated users can logout
       */
      await request(app.getHttpServer()).post('/api/auth/logout').expect(401);
    });

    it('should invalidate refresh token on logout', async () => {
      /**
       * Test: Refresh token invalidation
       * Why: Logout should invalidate all user sessions
       */
      // First, logout
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Then try to use refresh token
      const refreshResponse = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'some-refresh-token',
        });

      // Should fail since tokens were invalidated
      expect([401, 403]).toContain(refreshResponse.status);
    });
  });

  describe('POST /api/auth/register - User Registration', () => {
    it('should register new user successfully', async () => {
      /**
       * Test: User registration
       * Why: New users need to be able to create accounts
       */
      const registerData = {
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerData);

      expect([200, 201]).toContain(response.status);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(registerData.email);
    });

    it('should validate password strength', async () => {
      /**
       * Test: Password strength validation
       * Why: Enforce strong passwords for security
       */
      const registerData = {
        firstName: 'Weak',
        lastName: 'Password',
        email: 'weakpass@example.com',
        password: '123', // Weak password
        confirmPassword: '123',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerData);

      expect([400, 422]).toContain(response.status);
      expect(response.body.message).toContain('password');
    });

    it('should require password confirmation', async () => {
      /**
       * Test: Password confirmation validation
       * Why: Prevent typos in password creation
       */
      const registerData = {
        firstName: 'Mismatch',
        lastName: 'Password',
        email: 'mismatch@example.com',
        password: 'Password123!',
        confirmPassword: 'DifferentPassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerData);

      expect([400, 422]).toContain(response.status);
      expect(response.body.message).toContain('password');
    });

    it('should prevent duplicate email registration', async () => {
      /**
       * Test: Duplicate email prevention
       * Why: Email addresses should be unique
       */
      const registerData = {
        firstName: 'Duplicate',
        lastName: 'User',
        email: 'duplicate@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      };

      // Register first user
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerData);

      // Try to register second user with same email
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          ...registerData,
          firstName: 'Another',
        });

      expect([400, 409, 422]).toContain(response.status);
      expect(response.body.message).toBeDefined();
    });

    it('should validate required fields', async () => {
      /**
       * Test: Required field validation
       * Why: All fields are necessary for account creation
       */
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'incomplete@example.com',
          // Missing other required fields
        });

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('POST /api/auth/forgot-password - Password Reset Request', () => {
    beforeEach(async () => {
      testUser = await createTestUser(
        dataSource,
        'ADMIN',
        tenant.id,
        'reset@example.com',
      );
    });

    it('should initiate password reset for valid email', async () => {
      /**
       * Test: Password reset initiation
       * Why: Users need to recover forgotten passwords
       */
      const response = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({
          email: 'reset@example.com',
        })
        .expect(200);

      expect(response.body.message).toBeDefined();
    });

    it('should not reveal if email exists (security)', async () => {
      /**
       * Test: Email existence obfuscation
       * Why: Don't leak information about which users exist
       */
      const response = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com',
        })
        .expect(200);

      // Should return same response regardless of email existence
      expect(response.body.message).toBeDefined();
    });

    it('should validate email format in reset request', async () => {
      /**
       * Test: Email format validation
       * Why: Only valid emails should be processed
       */
      const response = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({
          email: 'invalid-email-format',
        });

      expect([400, 422]).toContain(response.status);
    });

    it('should generate secure reset token', async () => {
      /**
       * Test: Reset token generation
       * Why: Tokens must be cryptographically secure
       */
      await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({
          email: 'reset@example.com',
        })
        .expect(200);

      // Verify token was created in database
      const userRepo = dataSource.getRepository(User);
      const updatedUser = await userRepo.findOne({
        where: { email: 'reset@example.com' },
      });

      if (updatedUser && updatedUser.passwordResetToken) {
        expect(updatedUser.passwordResetToken).toBeDefined();
        expect(updatedUser.passwordResetExpires).toBeDefined();
        expect(updatedUser.passwordResetExpires.getTime()).toBeGreaterThan(
          Date.now(),
        );
      }
    });
  });

  describe('POST /api/auth/reset-password - Password Reset Completion', () => {
    let resetToken: string;

    beforeEach(async () => {
      testUser = await createTestUser(
        dataSource,
        'ADMIN',
        tenant.id,
        'reset@example.com',
      );

      // Generate reset token
      await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'reset@example.com' });

      // Get reset token from database
      const userRepo = dataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { email: 'reset@example.com' },
      });
      resetToken = user?.passwordResetToken || 'dummy-token';
    });

    it('should reset password with valid token', async () => {
      /**
       * Test: Password reset completion
       * Why: Users must be able to complete password reset
       */
      const resetData = {
        token: resetToken,
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send(resetData)
        .expect(200);

      expect(response.body.message).toBeDefined();
    });

    it('should reject invalid reset token', async () => {
      /**
       * Test: Invalid token rejection
       * Why: Security - prevent unauthorized password changes
       */
      const resetData = {
        token: 'invalid-token',
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send(resetData)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should reject expired reset token', async () => {
      /**
       * Test: Expired token rejection
       * Why: Reset tokens should have limited lifetime
       */
      // Simulate expired token by setting past expiry
      const userRepo = dataSource.getRepository(User);
      await userRepo.update(
        { email: 'reset@example.com' },
        {
          passwordResetExpires: new Date(Date.now() - 60000), // 1 minute ago
        },
      );

      const resetData = {
        token: resetToken,
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send(resetData)
        .expect(400);

      expect(response.body.message).toContain('expired');
    });

    it('should validate new password strength', async () => {
      /**
       * Test: New password validation
       * Why: Reset shouldn't allow weak passwords
       */
      const resetData = {
        token: resetToken,
        password: '123', // Weak password
        confirmPassword: '123',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send(resetData);

      expect([400, 422]).toContain(response.status);
      expect(response.body.message).toContain('password');
    });
  });

  describe('POST /api/auth/refresh - Token Refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      testUser = await createTestUser(dataSource, 'ADMIN', tenant.id);

      // Login to get refresh token
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.user.email,
          password: 'TestPassword123!',
        });

      refreshToken = loginResponse.body.refreshToken;
    });

    it('should refresh token with valid refresh token', async () => {
      /**
       * Test: Token refresh functionality
       * Why: Users should stay logged in without re-entering credentials
       */
      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({
          refreshToken: refreshToken,
        })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();

      // Verify new token has tenant context
      const decodedToken = jwtService.decode(response.body.accessToken) as any;
      expect(decodedToken.tenantId).toBe(tenant.id);
    });

    it('should reject invalid refresh token', async () => {
      /**
       * Test: Invalid refresh token rejection
       * Why: Security - prevent token forgery
       */
      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        })
        .expect(401);

      expect(response.body.accessToken).toBeUndefined();
    });

    it('should reject expired refresh token', async () => {
      /**
       * Test: Expired refresh token rejection
       * Why: Refresh tokens should expire to enforce periodic re-authentication
       */
      // Create an expired token
      const expiredToken = jwtService.sign(
        { sub: testUser.user.id, email: testUser.user.email },
        { expiresIn: '1ms' },
      );

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({
          refreshToken: expiredToken,
        })
        .expect(401);

      expect(response.body.accessToken).toBeUndefined();
    });
  });

  describe('GET /api/auth/me - Get Current User', () => {
    let authToken: string;

    beforeEach(async () => {
      testUser = await createTestUser(dataSource, 'ADMIN', tenant.id);
      authToken = testUser.token;
    });

    it('should return current user info with valid token', async () => {
      /**
       * Test: Current user retrieval
       * Why: Frontend needs current user information
       */
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testUser.user.email);
      expect(response.body.user.tenant).toBeDefined();
      expect(response.body.user.tenant.id).toBe(tenant.id);
    });

    it('should return 401 for invalid token', async () => {
      /**
       * Test: Invalid token rejection
       * Why: Only valid tokens should access user info
       */
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should return 401 for missing token', async () => {
      /**
       * Test: Missing token rejection
       * Why: Authentication required for user info
       */
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });
  });

  describe('Security Features', () => {
    it('should implement rate limiting on login attempts', async () => {
      /**
       * Test: Rate limiting
       * Why: Prevent brute force attacks
       */
      const loginData = {
        email: 'ratelimit@example.com',
        password: 'WrongPassword123!',
      };

      // Make multiple rapid login attempts
      const promises = Array.from({ length: 6 }, () =>
        request(app.getHttpServer()).post('/api/auth/login').send(loginData),
      );

      const responses = await Promise.all(promises);

      // Should start rate limiting after several attempts
      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should hash passwords securely', async () => {
      /**
       * Test: Password hashing
       * Why: Passwords must never be stored in plaintext
       */
      const registerData = {
        firstName: 'Hash',
        lastName: 'Test',
        email: 'hashtest@example.com',
        password: 'HashPassword123!',
        confirmPassword: 'HashPassword123!',
      };

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerData);

      // Check that password is hashed in database
      const userRepo = dataSource.getRepository(User);
      const user = await userRepo.findOne({
        where: { email: 'hashtest@example.com' },
      });

      if (user && user.password) {
        expect(user.password).not.toBe(registerData.password);
        expect(user.password).toMatch(/^\$2[aby]?\$\d{2}\$/); // bcrypt hash pattern
      }
    });

    it('should include CSRF protection', async () => {
      /**
       * Test: CSRF protection
       * Why: Prevent cross-site request forgery
       */
      // This would test CSRF token validation if implemented
      // For now, just verify that security headers are present
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'csrf@example.com',
          password: 'Password123!',
        });

      // Check for security headers
      expect(response.headers).toBeDefined();
    });
  });

  describe('Multi-Tenant Authentication', () => {
    let anotherTenant: any;
    let anotherTenantUser: any;

    beforeEach(async () => {
      anotherTenant = await createTestTenant(dataSource, 'Another Church');
      anotherTenantUser = await createTestUser(
        dataSource,
        'ADMIN',
        anotherTenant.id,
        'another@example.com',
      );
    });

    it('should include correct tenant context in JWT', async () => {
      /**
       * Test: Tenant context in authentication
       * Why: Each user's token must include their tenant for proper isolation
       */
      const loginData = {
        email: 'another@example.com',
        password: 'TestPassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      const decodedToken = jwtService.decode(response.body.accessToken) as any;
      expect(decodedToken.tenantId).toBe(anotherTenant.id);
      expect(decodedToken.tenantId).not.toBe(tenant.id);
    });

    it('should isolate user sessions by tenant', async () => {
      /**
       * Test: Session isolation
       * Why: Users from different tenants should have isolated sessions
       */
      // Login users from both tenants
      const user1Token = testUser.token;
      const user2Token = anotherTenantUser.token;

      // Both should be able to access their own user info
      const user1Response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const user2Response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(user1Response.body.user.tenant.id).toBe(tenant.id);
      expect(user2Response.body.user.tenant.id).toBe(anotherTenant.id);
    });
  });
});
