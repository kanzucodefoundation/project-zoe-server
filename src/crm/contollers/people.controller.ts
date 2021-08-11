import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import Person from '../entities/person.entity';
import { ContactSearchDto } from '../dto/contact-search.dto';
import { CreatePersonDto } from '../dto/create-person.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import PersonListDto from '../dto/person-list.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import ContactListDto from '../dto/contact-list.dto';
import { PersonEditDto } from '../dto/person-edit.dto';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';
import { PeopleService } from '../people.service';

@UseInterceptors(SentryInterceptor)
@ApiTags('Crm People')
@Controller('api/crm/people')
@UseGuards(JwtAuthGuard)
export class PeopleController {
  constructor(private readonly service: PeopleService) {}

  @Get()
  async findAll(@Query() req: ContactSearchDto): Promise<Person[]> {
    return await this.service.findAll(req);
  }

  @Get('combo')
  async findCombo(@Query() req: ContactSearchDto): Promise<PersonListDto[]> {
    return await this.service.findCombo(req);
  }

  @Post()
  async create(@Body() data: CreatePersonDto): Promise<ContactListDto> {
    return this.service.create(data);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file) {
    console.log(file);
  }

  @Put()
  async update(@Body() { id, ...data }: PersonEditDto): Promise<Person> {
    return await this.service.update({ id, ...data });
  }
}
