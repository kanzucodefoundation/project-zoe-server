import {
  Controller,
  BadRequestException,
  Get,
  Post,
  Logger,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  Inject,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { parse as parseCsv } from 'csv-parse/sync';
import { ContactsService } from '../contacts.service';
import { Express } from 'express';
import { Repository, Connection } from 'typeorm';
import Company from '../entities/company.entity';
import CompanyListDto from '../dto/company-list.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { parseContact } from '../utils/importUtils';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';
import { GroupsMembershipService } from 'src/groups/services/group-membership.service';
import { GroupRole } from 'src/groups/enums/groupRole';
import { AddressCategory } from '../enums/addressCategory';
import { GroupsService } from 'src/groups/services/groups.service';
import { GroupPrivacy } from 'src/groups/enums/groupPrivacy';
import { GroupCategoryNames } from 'src/groups/enums/groups';
import { UsersService } from 'src/users/users.service';
import { generateRandomPassword } from 'src/utils/stringHelpers';
import { TenantContextInterceptor } from 'src/interceptors/tenant-context.interceptor';
import { ServiceRecordingService } from 'src/service-recording/service-recording.service';

class Entity {
  name: string;
  phone: string;
  email: string;
}

// parseContact()/getValueByKeys() already resolves firstName/lastName/email/phone/
// dateOfBirth/gender headers case- and whitespace-insensitively. country, district,
// and groupId are read directly off the raw row (see uploadFile/uploadGroupLeaders
// below) and bypass that resolution, so we normalize headers here to keep those
// direct reads working with human-readable CSV columns (e.g. "Country", "District").
const CONTACT_HEADER_ALIASES: Record<string, string> = {
  firstname: 'firstName',
  lastname: 'lastName',
  email: 'email',
  phone: 'phone',
  dateofbirth: 'dateOfBirth',
  gender: 'gender',
  district: 'district',
  country: 'country',
  address: 'address',
  groupid: 'groupId',
};

const CANONICAL_CONTACT_KEYS = new Set(Object.values(CONTACT_HEADER_ALIASES));

export class DuplicateContactHeaderError extends Error {
  constructor(public readonly field: string) {
    super(`Duplicate column for "${field}" found in CSV headers.`);
  }
}

// Wraps normalizeContactHeader with per-parse duplicate detection: if two
// input headers resolve to the same canonical field (e.g. "Email" and
// "email", or "Group ID" and "groupId"), csv-parse would otherwise silently
// keep only the last column's values. Reject the file instead. Unrecognized
// headers are passed through unchanged and are never treated as duplicates.
export function mapContactHeaders(headers: string[]): string[] {
  const seenCanonical = new Set<string>();
  return headers.map((header) => {
    const mapped = normalizeContactHeader(header);
    if (CANONICAL_CONTACT_KEYS.has(mapped)) {
      if (seenCanonical.has(mapped)) {
        throw new DuplicateContactHeaderError(mapped);
      }
      seenCanonical.add(mapped);
    }
    return mapped;
  });
}

function normalizeContactHeader(header: string): string {
  const key = header
    .replace(/^\uFEFF/, '')
    .replace(/[\s_-]/g, '')
    .toLowerCase();
  return CONTACT_HEADER_ALIASES[key] ?? header;
}

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags('Crm Contacts')
@Controller('api/crm/import')
export class ContactImportController {
  private readonly companyRepository: Repository<Company>;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private readonly service: ContactsService,
    private readonly groupMembershipService: GroupsMembershipService,
    private readonly groupsService: GroupsService,
    private readonly usersService: UsersService,
    private readonly serviceRecordingService: ServiceRecordingService,
  ) {
    this.companyRepository = connection.getRepository(Company);
  }

  @Get()
  async GetSample(@Res() res): Promise<CompanyListDto[]> {
    return res.sendFile('data.csv', { root: './public' });
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException({ message: 'No file was uploaded.' });
    }

    const locationGroup =
      await this.serviceRecordingService.getUploaderLocationGroup(
        req.user.id,
        req.tenantId,
      );

    let list: any[];
    try {
      list = parseCsv(file.buffer, {
        columns: mapContactHeaders,
        skip_empty_lines: true,
        delimiter: ',',
        relax_column_count: false,
      }) as any[];
    } catch (parseErr) {
      if (parseErr instanceof DuplicateContactHeaderError) {
        throw new BadRequestException({ message: parseErr.message });
      }
      throw new BadRequestException({
        message:
          'The CSV file could not be parsed. Please ensure every row has a value for each column and that the file uses comma-separated format.',
      });
    }
    const created = [];
    const notCreated = [];
    const errors: string[] = [];
    for (const [index, uploadedContact] of list.entries()) {
      try {
        const contactModel = parseContact(uploadedContact);
        if (contactModel) {
          const contactName =
            uploadedContact.firstName || uploadedContact.name || 'Unknown';

          const effectiveGroupId = uploadedContact.groupId || locationGroup?.id;
          if (!effectiveGroupId) {
            const userErrorMessage = `Contact ${contactName} at position ${
              index + 1
            } out of ${
              list.length
            } contacts not created. Error message: Group ID is required and could not be inferred from your profile.`;
            Logger.error(userErrorMessage);
            errors.push(userErrorMessage);
            notCreated.push(uploadedContact);
            continue;
          }

          contactModel['residence'] = {
            category: AddressCategory.Home,
            isPrimary: true,
            country: uploadedContact.country,
            district: uploadedContact.district,
            freeForm: uploadedContact.address,
          };

          const groupData = await this.groupsService.findOne(
            effectiveGroupId,
            false,
            req.user,
          );
          if (!groupData) {
            throw new BadRequestException({
              message: `Specified Group with ID ${effectiveGroupId} does not exist. Please specify a valid group ID.`,
            });
          }

          // Email-less contacts (e.g. children) fall back to (firstName, lastName, groupId)
          // dedup — weaker than email since name collisions within a group are possible.
          // Once child-to-parent linking lands, the parent becomes the authoritative anchor.
          // See: https://github.com/kanzucodefoundation/project-zoe-server/issues/208
          let person = contactModel.email
            ? await this.service.findByEmail(contactModel.email)
            : await this.service.findByNameAndGroup(
                contactModel.firstName,
                contactModel.lastName,
                effectiveGroupId,
              );
          if (!person) {
            person = await this.service.createPerson(contactModel);
          }
          await this.groupMembershipService.create({
            groupId: effectiveGroupId,
            members: [person.id],
            role: GroupRole.Member,
          });
          created.push(person);
        }
      } catch (err) {
        notCreated.push(uploadedContact);
        const userErrorMessage = `Contact ${
          uploadedContact.firstName || uploadedContact.name || 'Unknown'
        } at position ${index + 1} out of ${
          list.length
        } contacts not created. Error message: ${err.message}`;
        Logger.error(userErrorMessage);
        errors.push(userErrorMessage);
      }
    }
    return {
      success: created.length > 0 || errors.length === 0,
      totalRows: list.length,
      successfulRows: created.length,
      errors,
    };
  }

  @Post('groupLeaders')
  @UseInterceptors(FileInterceptor('file'))
  async uploadGroupLeaders(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException({ message: 'No file was uploaded.' });
    }

    let list: any[];
    try {
      list = parseCsv(file.buffer, {
        columns: mapContactHeaders,
        skip_empty_lines: true,
        delimiter: ',',
        relax_column_count: false,
      }) as any[];
    } catch (parseErr) {
      if (parseErr instanceof DuplicateContactHeaderError) {
        throw new BadRequestException({ message: parseErr.message });
      }
      throw new BadRequestException({
        message:
          'The CSV file could not be parsed. Please ensure every row has a value for each column and that the file uses comma-separated format.',
      });
    }

    const created = [];
    const notCreated = [];
    for (const [index, uploadedContact] of list.entries()) {
      try {
        const contactModel = parseContact(uploadedContact);
        if (contactModel) {
          contactModel['residence'] = {
            category: AddressCategory.Home,
            isPrimary: true,
            country: uploadedContact.country,
            district: uploadedContact.district,
            freeForm: uploadedContact.address,
          };

          let groupData;
          if (uploadedContact.groupId) {
            groupData = await this.groupsService.findOne(
              uploadedContact.groupId,
              false,
              req.user,
            );
            if (!groupData) {
              throw new BadRequestException({
                message: `Specified Group with ID ${uploadedContact.groupId} does not exist. Please specify a valid group ID.`,
              });
            }
          } else {
            const newGroup = {
              parentId: uploadedContact.groupParentId,
              privacy: GroupPrivacy.Public,
              details: null,
              name: uploadedContact.groupName,
              categoryName: GroupCategoryNames.MC,
            };
            groupData = await this.groupsService.create(newGroup, {}, true);
          }

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
