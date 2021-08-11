import { Global, HttpModule, Module } from '@nestjs/common';
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
import { GoogleService } from 'src/vendor/google.service';
import { PrismaService } from '../shared/prisma.service';
import { ContactImportController } from './contollers/contact-import.controller';
import { GroupFinderService } from './group-finder/group-finder.service';
import { appEntities } from '../config';
import { PhonesService } from './phones.service';
import { AddressesService } from './addresses.service';
import { EmailService } from './emails.service';
import { PeopleService } from './people.service';

@Global()
@Module({
  imports: [CsvModule, HttpModule, TypeOrmModule.forFeature(appEntities)],
  providers: [
    ContactsService,
    GoogleService,
    PrismaService,
    GroupFinderService,
    PhonesService,
    AddressesService,
    EmailService,
    PeopleService,
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
  ],
  exports: [ContactsService, GroupFinderService],
})
export class CrmModule {}
