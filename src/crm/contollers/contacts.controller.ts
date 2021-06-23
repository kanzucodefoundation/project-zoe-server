import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ContactsService } from '../contacts.service';
import { ContactSearchDto } from '../dto/contact-search.dto';
import Contact from '../entities/contact.entity';
import { ApiTags } from '@nestjs/swagger';
import ContactListDto from '../dto/contact-list.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags('Crm')
@Controller('api/crm/contacts')
export class ContactsController {
  constructor(private readonly service: ContactsService) {}

  @Get()
  async findAll(@Query() req: ContactSearchDto): Promise<ContactListDto[]> {
    return this.service.findAll(req);
  }

  @Post()
  async create(@Body() data: Contact): Promise<Contact> {
    return await this.service.create(data);
  }

  @Put()
  async update(@Body() data: Contact): Promise<Contact> {
    return await this.service.update(data);
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
