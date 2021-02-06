import { HttpModule, Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contollers/contacts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { crmEntities } from './crm.helpers';
import { PeopleController } from './contollers/people.controller';
import { CompaniesController } from './contollers/companies.controller';
import { EmailsController } from './contollers/emails.controller';
import { PhonesController } from './contollers/phones.controller';
import { IdentificationsController } from './contollers/identifications.controller';
import { OccasionsController } from './contollers/occasions.controller';
import { AddressesController } from './contollers/addresses.controller';
import { RelationshipsController } from './contollers/relationships.controller';
import { RequestsController } from './contollers/requests.controller';
import { groupEntities } from '../groups/groups.helpers';
import { usersEntities } from '../users/users.helpers';
import {RegisterController} from "./contollers/register.controller";
import { GoogleService } from 'src/vendor/google.service';

@Module({
  imports: [HttpModule,TypeOrmModule.forFeature([...crmEntities, ...groupEntities,...usersEntities])],
  providers: [ContactsService,GoogleService],
  controllers: [
    ContactsController, PeopleController, CompaniesController,
    EmailsController,
    PhonesController,
    IdentificationsController,
    OccasionsController,
    AddressesController,
    RelationshipsController,
    RequestsController,RegisterController
  ],
  exports: [ContactsService],
})
export class CrmModule {
}
