import { Global, Module, MiddlewareConsumer } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contollers/contacts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CsvModule } from 'nest-csv-parser';
import { PeopleController } from './contollers/people.controller';
import { CompaniesController } from './contollers/companies.controller';
import { EmailsController } from './contollers/emails.controller';
import { PhonesController } from './contollers/phones.controller';
import { IdentificationsController } from './contollers/identifications.controller';
import { OccasionsController } from './contollers/occasions.controller';
import { AddressesController } from './contollers/addresses.controller';
import { RelationshipsController } from './contollers/relationships.controller';
import { RequestsController } from './contollers/requests.controller';
import { RegisterController } from './contollers/register.controller';
import { ContactActivityService } from './contact-activity.service';
import { ContactActivityController } from './contact-activity.controller';
import { GoogleService } from 'src/vendor/google.service';
import { PrismaService } from '../shared/prisma.service';
import { ContactImportController } from './contollers/contact-import.controller';
import { GroupFinderService } from './group-finder/group-finder.service';
import { appEntities } from '../config';
import { PhonesService } from './phones.service';
import { AddressesService } from './addresses.service';
import { TenantHeaderMiddleware } from 'src/middleware/tenant-header.middleware';
import { GroupsMembershipService } from 'src/groups/services/group-membership.service';
import { GroupsService } from 'src/groups/services/groups.service';
import { GroupPermissionsService } from 'src/groups/services/group-permissions.service';
import { GroupTreeService } from 'src/groups/services/group-tree.service';
import { TenantContextInterceptor } from '../interceptors/tenant-context.interceptor';
import { AppLogger } from 'src/utils/app-logger.service';
import { VendorModule } from 'src/vendor/vendor.module';
import { ServiceRecordingService } from 'src/service-recording/service-recording.service';

@Global()
@Module({
  imports: [
    CsvModule,
    HttpModule,
    TypeOrmModule.forFeature(appEntities),
    VendorModule,
  ],
  providers: [
    ContactsService,
    GoogleService,
    PrismaService,
    GroupsMembershipService,
    GroupsService,
    GroupPermissionsService,
    GroupTreeService,
    GroupFinderService,
    PhonesService,
    AddressesService,
    TenantContextInterceptor,
    AppLogger,
    ContactActivityService,
    ServiceRecordingService,
  ],
  controllers: [
    ContactsController,
    PeopleController,
    CompaniesController,
    EmailsController,
    PhonesController,
    IdentificationsController,
    OccasionsController,
    AddressesController,
    RelationshipsController,
    RequestsController,
    RegisterController,
    ContactImportController,
    ContactActivityController,
  ],
  exports: [ContactsService, GroupFinderService, ContactActivityService],
})
export class CrmModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantHeaderMiddleware).forRoutes('api/register');
  }
}
