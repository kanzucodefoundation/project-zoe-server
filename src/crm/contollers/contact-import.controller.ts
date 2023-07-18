import {
  Controller,
  BadRequestException,
  Get,
  Post,
  Logger,
  Res,
  UploadedFile,
  UseGuards,
  Inject,
  UseInterceptors,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CsvParser } from "nest-csv-parser";
import { ContactsService } from "../contacts.service";
import { Express } from "express";
import { Repository, Connection } from "typeorm";
import Company from "../entities/company.entity";
import CompanyListDto from "../dto/company-list.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { parseContact } from "../utils/importUtils";
import { SentryInterceptor } from "src/utils/sentry.interceptor";
import { GroupsMembershipService } from "src/groups/services/group-membership.service";
import { GroupRole } from "src/groups/enums/groupRole";
import { AddressCategory } from "../enums/addressCategory";
import { GroupsService } from "src/groups/services/groups.service";
import { GroupPrivacy } from "src/groups/enums/groupPrivacy";
import { GroupCategoryNames } from "src/groups/enums/groups";
import { UsersService } from "src/users/users.service";
import { generateRandomPassword } from "src/utils/stringHelpers";

const Duplex = require("stream").Duplex; // core NodeJS API
function bufferToStream(buffer) {
  let stream = new Duplex();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

class Entity {
  name: string;
  phone: string;
  email: string;
}

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags("Crm Contacts")
@Controller("api/crm/import")
export class ContactImportController {
  private readonly companyRepository: Repository<Company>;

  constructor(
    @Inject("CONNECTION") connection: Connection,
    private readonly service: ContactsService,
    private readonly csvParser: CsvParser,
    private readonly groupMembershipService: GroupsMembershipService,
    private readonly groupsService: GroupsService,
    private readonly usersService: UsersService,
  ) {
    this.companyRepository = connection.getRepository(Company);
  }

  @Get()
  async GetSample(@Res() res): Promise<CompanyListDto[]> {
    return res.sendFile("data.csv", { root: "./public" });
  }

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const parsedData = await this.csvParser.parse(
      bufferToStream(file.buffer),
      Entity,
      null,
      null,
      { strict: true, separator: "," },
    );
    const { list } = parsedData;
    const created = [];
    const notCreated = [];
    for (const [index, uploadedContact] of list.entries()) {
      try {
        const contactModel = parseContact(uploadedContact);
        if (contactModel) {
          contactModel["residence"] = {
            category: AddressCategory.Home,
            isPrimary: true,
            country: uploadedContact.country,
            district: uploadedContact.district,
            freeForm: uploadedContact.address,
          };

          const groupData = await this.groupsService.findOne(
            uploadedContact.groupid,
            false,
          );
          if (!groupData) {
            throw new BadRequestException({
              message: `Specified Group with ID ${uploadedContact.groupid} does not exist. Please specify a valid group ID.`,
            });
          }

          const newPerson = await this.service.createPerson(contactModel);
          const newPersonsGroup = {
            groupId: uploadedContact.groupid,
            members: [newPerson.id],
            role: GroupRole.Member,
          };
          await this.groupMembershipService.create(newPersonsGroup);
          created.push(newPerson);
        }
      } catch (err) {
        notCreated.push(uploadedContact);
        const userErrorMessage = `Contact ${uploadedContact.name} at position ${
          index + 1
        } out of ${list.length - 1} contacts not created. Error message: ${
          err.message
        }`;
        Logger.error(userErrorMessage);
        throw new BadRequestException({
          message: `${userErrorMessage}. Every contact from this one onwards has not been created. Fix this error, remove the contacts before this one and re-upload.`,
        });
      }
    }
    return created.map((it) => it.id);
  }

  @Post("groupLeaders")
  @UseInterceptors(FileInterceptor("file"))
  async uploadGroupLeaders(@UploadedFile() file: Express.Multer.File) {
    const parsedData = await this.csvParser.parse(
      bufferToStream(file.buffer),
      Entity,
      null,
      null,
      { strict: true, separator: "," },
    );
    const { list } = parsedData;
    const created = [];
    const notCreated = [];
    for (const [index, uploadedContact] of list.entries()) {
      try {
        const contactModel = parseContact(uploadedContact);
        if (contactModel) {
          contactModel["residence"] = {
            category: AddressCategory.Home,
            isPrimary: true,
            country: uploadedContact.country,
            district: uploadedContact.district,
            freeForm: uploadedContact.address,
          };

          const newGroup = {
            parentId: uploadedContact.groupParentId,
            privacy: GroupPrivacy.Public,
            details: null,
            name: uploadedContact.groupName,
            categoryName: GroupCategoryNames.MC,
          };

          const groupData = await this.groupsService.create(newGroup, {}, true);

          if (!groupData) {
            throw new BadRequestException({
              message: `Specified Group with name ${uploadedContact.groupName} was not created.`,
            });
          }

          const newPerson = await this.service.createPerson(contactModel);
          const newPersonsGroup = {
            groupId: groupData.id,
            members: [newPerson.id],
            role: GroupRole.Leader,
          };
          await this.groupMembershipService.create(newPersonsGroup);
          created.push(newPerson);
          const newUserObj = {
            contactId: newPerson.id,
            username: uploadedContact.email,
            password: generateRandomPassword(8),
            roles: [],
            isActive: true,
          };

          const newUser = await this.usersService.createUser(newUserObj);
        }
      } catch (err) {
        notCreated.push(uploadedContact);
        const userErrorMessage = `Contact ${uploadedContact.name} at position ${
          index + 1
        } out of ${list.length - 1} contacts not created. Error message: ${
          err.message
        }`;
        Logger.error(userErrorMessage);
        throw new BadRequestException({
          message: `${userErrorMessage}. Every contact from this one onwards has not been created. Fix this error, remove the contacts before this one and re-upload.`,
        });
      }
    }
    return created.map((it) => it.id);
  }
}
