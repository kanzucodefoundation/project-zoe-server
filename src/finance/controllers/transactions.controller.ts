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
  ParseTransactionDto,
  ParsedTransactionDto,
  BulkImportTransactionDto,
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

  /**
   * Step 2 of the import wizard: parse an uploaded file into preview rows.
   * Writes nothing — the reviewed rows come back to POST /import.
   *
   * Declared before the ':id' routes below so 'parse' is never swallowed as an id.
   */
  @Post('parse')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async parseFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() options: ParseTransactionDto,
    @Request() req: any,
  ): Promise<ParsedTransactionDto[]> {
    return this.service.parseFile(file, options, req.user);
  }

  /** Step 3 of the import wizard: commit the rows the user kept. */
  @Post('import')
  async importParsed(
    @Body() data: BulkImportTransactionDto,
    @Request() req: any,
  ): Promise<{ imported: number; errors: string[] }> {
    return this.service.importParsed(data, req.user);
  }

  /** One-shot import: parse and save a file in a single request, no preview. */
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
