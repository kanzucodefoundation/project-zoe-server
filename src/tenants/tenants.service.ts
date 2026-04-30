import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { DbService } from 'src/shared/db.service';
import { Tenant } from './entities/tenant.entity';
import { TenantDto } from './dto/tenant.dto';
import { SeedService } from 'src/seed/seed.service';
import { lowerCaseRemoveSpaces } from 'src/utils/stringHelpers';
import { Connection } from 'typeorm';
import { JwtHelperService } from 'src/auth/jwt-helpers.service';
import { ContactsService } from 'src/crm/contacts.service';
import { GoogleService } from 'src/vendor/google.service';
import { PrismaService } from 'src/shared/prisma.service';
import { GroupFinderService } from 'src/crm/group-finder/group-finder.service';
import { AddressesService } from 'src/crm/addresses.service';
import { GroupCategoriesService } from 'src/groups/services/group-categories.service';
import { GroupPermissionsService } from 'src/groups/services/group-permissions.service';
import { GroupsMembershipService } from 'src/groups/services/group-membership.service';
import { GroupTreeService } from 'src/groups/services/group-tree.service';
import { AppLogger } from 'src/utils/app-logger.service';

/**
 * TenantsService - Manages tenant creation for row-level multi-tenancy
 *
 * Updated to work with row-level tenancy - no longer creates separate schemas
 */
@Injectable()
export class TenantsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly dbService: DbService,
  ) {}

  async create(
    tenantData: TenantDto,
    dbService: DbService,
    seedService: SeedService,
    googleService: GoogleService,
    jwtHelperService: JwtHelperService,
    prisma: PrismaService,
    groupFinderService: GroupFinderService,
    addressesService: AddressesService,
    groupsPermissionsService: GroupPermissionsService,
  ): Promise<Tenant> {
    const tenantName = lowerCaseRemoveSpaces(tenantData.name);

    // Create tenant in database
    const tenantDetails = await dbService.createTenant({ name: tenantName });

    Logger.log(`Tenant created: ${tenantName} (ID: ${tenantDetails.id})`);

    // Create a temporary request-like object with tenant context for seeding
    const mockRequest = {
      tenantId: tenantDetails.id,
      tenantName: tenantDetails.name,
      headers: {
        tenant: tenantDetails.name,
      },
    };

    // Create a mock TenantContext for tenant creation (no HTTP request context)
    const mockTenantContext = {
      tenantId: tenantDetails.id,
      tenantName: tenantDetails.name,
      hasTenant: () => true,
      requireTenant: () => tenantDetails.id,
      setTenantId: () => {},
    } as any;

    // Initialize services with tenant context
    const groupCategoriesService = new GroupCategoriesService(
      this.connection,
      mockTenantContext,
    );
    const groupMembershipService = new GroupsMembershipService(this.connection);
    const groupTreeService = new GroupTreeService(this.connection, null); // Pass null for cache manager in this context

    const contactService: ContactsService = new ContactsService(
      this.connection,
      googleService,
      prisma,
      groupFinderService,
      addressesService,
      groupTreeService,
      new AppLogger(),
      groupMembershipService,
      mockTenantContext,
    );

    // Seed initial data for the new tenant
    // Note: Services need to be updated to use TenantContext or accept tenantId
    await seedService.createAll(
      this.connection,
      contactService,
      jwtHelperService,
      groupsPermissionsService,
      groupCategoriesService,
      googleService,
      groupMembershipService,
    );

    Logger.log(`Tenant setup completed: ${tenantName}`);

    return tenantDetails;
  }

  /**
   * Find tenant by ID
   */
  async findOne(id: number): Promise<Tenant | null> {
    return await this.dbService.getTenantById(id);
  }

  /**
   * Find tenant by name
   */
  async findByName(name: string): Promise<Tenant | null> {
    return await this.dbService.getTenantByName(name);
  }
}
