import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Repository,
  Connection,
  ILike,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';
import * as XLSX from 'xlsx';
import Transaction from '../entities/transaction.entity';
import FinancialAccount from '../entities/financial-account.entity';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  SearchTransactionDto,
  ImportTransactionDto,
} from '../dto/transaction.dto';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { AppLogger, ContextLogger } from '../../utils/app-logger.service';
import { normalizePhone } from '../finance.helpers';

@Injectable()
export class TransactionsService {
  private readonly repository: Repository<Transaction>;
  private readonly accountRepository: Repository<FinancialAccount>;
  private readonly logger: ContextLogger;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private tenantContext: TenantContext,
    private appLogger: AppLogger,
  ) {
    this.repository = connection.getRepository(Transaction);
    this.accountRepository = connection.getRepository(FinancialAccount);
    this.logger = this.appLogger.createContextLogger('TransactionsService');
  }

  async create(dto: CreateTransactionDto, user: any): Promise<Transaction> {
    const tenantId = this.tenantContext.requireTenant();

    const account = await this.accountRepository.findOne({
      where: { id: dto.accountId, tenant: { id: tenantId } },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${dto.accountId} not found`);
    }

    this.logger.business('log', 'Creating transaction', {
      operation: 'createTransaction',
      userId: user?.id,
      metadata: { accountId: dto.accountId, amount: dto.amount },
    });

    const transaction = new Transaction();
    transaction.tenant = { id: tenantId } as any;
    transaction.account = account;
    transaction.amount = dto.amount;
    transaction.transactionDate = new Date(dto.transactionDate);
    transaction.externalReference = dto.externalReference;
    transaction.senderName = dto.senderName;
    transaction.senderPhone = dto.senderPhone;
    transaction.senderPhoneNormalized = normalizePhone(dto.senderPhone);
    transaction.narration = dto.narration;
    transaction.category = dto.category;
    transaction.status = TransactionStatus.PENDING;

    return this.repository.save(transaction);
  }

  async importFromFile(
    accountId: number,
    file: Express.Multer.File,
    options: ImportTransactionDto,
    user: any,
  ): Promise<{ imported: number; errors: string[] }> {
    const tenantId = this.tenantContext.requireTenant();

    const account = await this.accountRepository.findOne({
      where: { id: accountId, tenant: { id: tenantId } },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${accountId} not found`);
    }

    this.logger.business('log', 'Importing transactions from file', {
      operation: 'importTransactions',
      userId: user?.id,
      metadata: { accountId, fileName: file.originalname },
    });

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

    const dateColumn = options.dateColumn || 'Date';
    const amountColumn = options.amountColumn || 'Amount';
    const referenceColumn = options.referenceColumn || 'Reference';
    const senderNameColumn = options.senderNameColumn || 'Sender Name';
    const senderPhoneColumn = options.senderPhoneColumn || 'Sender Phone';
    const narrationColumn = options.narrationColumn || 'Narration';

    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const dateValue = row[dateColumn];
        const amountValue = row[amountColumn];

        if (!dateValue || !amountValue) {
          errors.push(`Row ${i + 2}: Missing required date or amount`);
          continue;
        }

        let transactionDate: Date;
        if (typeof dateValue === 'number') {
          transactionDate = this.excelDateToJSDate(dateValue);
        } else {
          transactionDate = new Date(dateValue);
        }

        if (isNaN(transactionDate.getTime())) {
          errors.push(`Row ${i + 2}: Invalid date format`);
          continue;
        }

        const amount = parseFloat(String(amountValue).replace(/[^0-9.-]/g, ''));
        if (isNaN(amount)) {
          errors.push(`Row ${i + 2}: Invalid amount format`);
          continue;
        }

        const senderPhone = row[senderPhoneColumn]
          ? String(row[senderPhoneColumn])
          : null;

        const transaction = new Transaction();
        transaction.tenant = { id: tenantId } as any;
        transaction.account = account;
        transaction.amount = amount;
        transaction.transactionDate = transactionDate;
        transaction.externalReference = row[referenceColumn]
          ? String(row[referenceColumn])
          : null;
        transaction.senderName = row[senderNameColumn]
          ? String(row[senderNameColumn])
          : null;
        transaction.senderPhone = senderPhone;
        transaction.senderPhoneNormalized = normalizePhone(senderPhone);
        transaction.narration = row[narrationColumn]
          ? String(row[narrationColumn])
          : null;
        transaction.status = TransactionStatus.PENDING;
        transaction.rawData = row;

        await this.repository.save(transaction);
        imported++;
      } catch (error) {
        errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    this.logger.business('log', 'Transaction import completed', {
      operation: 'importTransactions',
      userId: user?.id,
      metadata: { accountId, imported, errorCount: errors.length },
    });

    return { imported, errors };
  }

  private excelDateToJSDate(serial: number): Date {
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400;
    return new Date(utcValue * 1000);
  }

  async findAll(dto: SearchTransactionDto): Promise<Transaction[]> {
    const tenantId = this.tenantContext.requireTenant();

    const where: any = { tenant: { id: tenantId } };

    if (dto.accountId) {
      where.account = { id: dto.accountId };
    }

    if (dto.status) {
      where.status = dto.status;
    }

    if (dto.category) {
      where.category = dto.category;
    }

    if (dto.query) {
      where.senderName = ILike(`%${dto.query}%`);
    }

    if (dto.startDate && dto.endDate) {
      where.transactionDate = Between(
        new Date(dto.startDate),
        new Date(dto.endDate),
      );
    } else if (dto.startDate) {
      where.transactionDate = MoreThanOrEqual(new Date(dto.startDate));
    } else if (dto.endDate) {
      where.transactionDate = LessThanOrEqual(new Date(dto.endDate));
    }

    return this.repository.find({
      where,
      relations: ['account'],
      skip: dto.skip || 0,
      take: dto.limit || 100,
      order: { transactionDate: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Transaction> {
    const tenantId = this.tenantContext.requireTenant();

    const transaction = await this.repository.findOne({
      where: { id, tenant: { id: tenantId } },
      relations: ['account', 'matches', 'matches.contact', 'matches.group'],
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction;
  }

  async update(dto: UpdateTransactionDto, user: any): Promise<Transaction> {
    const tenantId = this.tenantContext.requireTenant();

    const transaction = await this.repository.findOne({
      where: { id: dto.id, tenant: { id: tenantId } },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${dto.id} not found`);
    }

    this.logger.business('log', 'Updating transaction', {
      operation: 'updateTransaction',
      userId: user?.id,
      resourceId: dto.id,
      resource: 'transaction',
    });

    if (dto.amount !== undefined) transaction.amount = dto.amount;
    if (dto.transactionDate !== undefined) {
      transaction.transactionDate = new Date(dto.transactionDate);
    }
    if (dto.externalReference !== undefined) {
      transaction.externalReference = dto.externalReference;
    }
    if (dto.senderName !== undefined) transaction.senderName = dto.senderName;
    if (dto.senderPhone !== undefined) {
      transaction.senderPhone = dto.senderPhone;
      transaction.senderPhoneNormalized = normalizePhone(dto.senderPhone);
    }
    if (dto.narration !== undefined) transaction.narration = dto.narration;
    if (dto.status !== undefined) transaction.status = dto.status;
    if (dto.category !== undefined) transaction.category = dto.category;

    return this.repository.save(transaction);
  }

  async getPendingForMatching(accountId: number): Promise<Transaction[]> {
    const tenantId = this.tenantContext.requireTenant();

    return this.repository.find({
      where: {
        tenant: { id: tenantId },
        account: { id: accountId },
        status: TransactionStatus.PENDING,
      },
      relations: ['account'],
      order: { transactionDate: 'ASC' },
    });
  }
}
