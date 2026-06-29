import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { ContactsService } from '../contacts.service';
import { ContactSearchDto } from '../dto/contact-search.dto';
import Contact from '../entities/contact.entity';
import { ApiTags } from '@nestjs/swagger';
import ContactListDto from '../dto/contact-list.dto';
import { CreateContactWithGroupDto } from '../dto/create-contact-with-group.dto';
import { UpdateContactWithGroupDto } from '../dto/update-contact-with-group.dto';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';
import { TenantContextInterceptor } from '../../interceptors/tenant-context.interceptor';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Crm')
@Controller('api/crm/contacts')
export class ContactsController {
  constructor(private readonly service: ContactsService) {}

  @Get()
  async findAll(
    @Query() req: ContactSearchDto,
    @Req() request: any,
  ): Promise<ContactListDto[]> {
    return this.service.findAll(req, request.user);
  }

  @Post()
  async create(
    @Body() data: CreateContactWithGroupDto,
    @Req() req: any,
  ): Promise<Contact> {
    // Debug logging to see what we're receiving
    console.log(
      'Controller received data:',
      JSON.stringify(
        {
          groups: data.groups,
          allKeys: Object.keys(data),
          dataType: typeof data,
        },
        null,
        2,
      ),
    );

    // Attach user context to the request for logging and authorization
    const requestWithUser = {
      ...req,
      user: req.user,
      tenant: req.tenant,
    };
    return await this.service.create(data, requestWithUser);
  }

  @Put()
  async updateLegacy(@Body() data: Contact): Promise<Contact> {
    return await this.service.update(data);
  }

  @Patch(':id')
  async update(
    @Param('id') id: number,
    @Body() data: UpdateContactWithGroupDto,
    @Req() req: any,
  ): Promise<Contact> {
    // Attach user context to the request for logging and authorization
    const requestWithUser = {
      ...req,
      user: req.user,
      tenant: req.tenant,
    };
    return await this.service.updateWithGroups(id, data, requestWithUser);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Contact> {
    return await this.service.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    await this.service.remove(id);
  }
}
