import {
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CsvParser } from 'nest-csv-parser';
import { ContactsService } from '../contacts.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Express } from 'express';
import { Repository } from 'typeorm';
import Company from '../entities/company.entity';
import CompanyListDto from '../dto/company-list.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { parseContact } from '../utils/importUtils';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';

const Duplex = require('stream').Duplex; // core NodeJS API
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
@ApiTags('Crm Contacts')
@Controller('api/crm/import')
export class ContactImportController {
  constructor(
    private readonly service: ContactsService,
    @InjectRepository(Company)
    private readonly personRepository: Repository<Company>,
    private readonly csvParser: CsvParser,
  ) {}

  @Get()
  async GetSample(@Res() res): Promise<CompanyListDto[]> {
    return res.sendFile('data.csv', { root: './public' });
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const parsedData = await this.csvParser.parse(
      bufferToStream(file.buffer),
      Entity,
      null,
      null,
      { strict: true, separator: ',' },
    );
    const { list } = parsedData;
    const created = [];
    for (const it of list) {
      const model = parseContact(it);
      if (model) {
        const saved = await this.service.createPerson(model);
        created.push(saved);
      }
    }
    return created.map((it) => it.id);
  }
}
