import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes } from '@nestjs/swagger';
import { SentryInterceptor } from '../../utils/sentry.interceptor';
import { TenantContextInterceptor } from '../../interceptors/tenant-context.interceptor';
import { TransactionsService } from '../services/transactions.service';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  SearchTransactionDto,
  ImportTransactionDto,
} from '../dto/transaction.dto';
import Transaction from '../entities/transaction.entity';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Finance - Transactions')
@Controller('api/finance/transactions')
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Get()
  async findAll(@Query() query: SearchTransactionDto): Promise<Transaction[]> {
    return this.service.findAll(query);
  }

  @Post()
  async create(
    @Body() data: CreateTransactionDto,
    @Request() req: any,
  ): Promise<Transaction> {
    return this.service.create(data, req.user);
  }

  @Post('import/:accountId')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importFromFile(
    @Param('accountId') accountId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() options: ImportTransactionDto,
    @Request() req: any,
  ): Promise<{ imported: number; errors: string[] }> {
    return this.service.importFromFile(accountId, file, options, req.user);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Transaction> {
    return this.service.findOne(id);
  }

  @Put()
  async update(
    @Body() data: UpdateTransactionDto,
    @Request() req: any,
  ): Promise<Transaction> {
    return this.service.update(data, req.user);
  }
}
