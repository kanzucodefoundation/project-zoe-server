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
import { Readable } from 'stream';
import { Workbook, Worksheet } from 'exceljs';
import Transaction from '../entities/transaction.entity';
import FinancialAccount from '../entities/financial-account.entity';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  SearchTransactionDto,
  ImportTransactionDto,
  ParseTransactionDto,
  ParsedTransactionDto,
  BulkImportTransactionDto,
} from '../dto/transaction.dto';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { MatchStatus } from '../enums/match-status.enum';
import { TransactionCategory } from '../enums/transaction-category.enum';
import { CategoryRulesService } from './category-rules.service';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { AppLogger, ContextLogger } from '../../utils/app-logger.service';
import { normalizePhone } from '../finance.helpers';
import { parseStatementDate } from '../finance-time';
import { getPersonFullName } from '../../crm/crm.helpers';

@Injectable()
export class TransactionsService {
  private readonly repository: Repository<Transaction>;
  private readonly accountRepository: Repository<FinancialAccount>;
  private readonly logger: ContextLogger;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private tenantContext: TenantContext,
    private appLogger: AppLogger,
    private categoryRulesService: CategoryRulesService,
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

    const { headers, rows } = await this.readRows(file);
    const {
      dateColumn,
      amountColumn,
      referenceColumn,
      senderNameColumn,
      senderPhoneColumn,
      narrationColumn,
    } = this.resolveColumns(headers, options);

    let imported = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const rowNum = row.__rowNumber;

      try {
        const dateValue = row[dateColumn];
        const amountValue = row[amountColumn];

        if (!dateValue || !amountValue) {
          errors.push(`Row ${rowNum}: Missing required date or amount`);
          continue;
        }

        // Same wall-clock reading as the wizard import, so both paths store
        // the same instant for the same statement row.
        const transactionDate = parseStatementDate(dateValue);
        if (!transactionDate) {
          errors.push(`Row ${rowNum}: Invalid date format`);
          continue;
        }

        const amount = parseFloat(String(amountValue).replace(/[^0-9.-]/g, ''));
        if (isNaN(amount)) {
          errors.push(`Row ${rowNum}: Invalid amount format`);
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
        errors.push(`Row ${rowNum}: ${error.message}`);
      }
    }

    this.logger.business('log', 'Transaction import completed', {
      operation: 'importTransactions',
      userId: user?.id,
      metadata: { accountId, imported, errorCount: errors.length },
    });

    return { imported, errors };
  }

  /**
   * Reads an uploaded spreadsheet into plain row objects keyed by header name.
   *
   * ExcelJS keeps CSV and XLSX behind two different readers: `xlsx.load` takes
   * a buffer, `csv.read` takes a stream. Picking the reader by extension is why
   * a .csv upload used to die with "please upload a valid .xlsx file".
   */
  private async readRows(
    file: Express.Multer.File,
  ): Promise<{ headers: string[]; rows: any[] }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file was uploaded.');
    }

    const name = (file.originalname || '').toLowerCase();

    // Legacy binary .xls is a different format entirely and ExcelJS cannot read
    // it in either mode. Say so, rather than fail with a confusing parse error.
    if (name.endsWith('.xls')) {
      throw new BadRequestException(
        'Legacy .xls files are not supported. Please re-save the file as .xlsx or .csv.',
      );
    }

    const workbook = new Workbook();
    let worksheet: Worksheet | undefined;

    if (name.endsWith('.csv')) {
      try {
        // Identity `map` keeps every cell as raw text. ExcelJS otherwise
        // coerces CSV values, which turns the mobile-money number 0771234567
        // into 771234567 — and that leading zero is load-bearing, since
        // senderPhoneNormalized is what reconciliation matches contacts on.
        // Dates and amounts are parsed from text further down anyway.
        worksheet = await workbook.csv.read(Readable.from(file.buffer), {
          map: (value: string) => value,
        } as any);
      } catch {
        throw new BadRequestException(
          'The uploaded file could not be read as CSV. Please check it is a valid comma-separated file.',
        );
      }
    } else {
      try {
        await workbook.xlsx.load(file.buffer);
      } catch {
        throw new BadRequestException(
          'The uploaded file could not be read. Please upload a valid .xlsx or .csv file.',
        );
      }
      worksheet = workbook.worksheets[0];
    }

    if (!worksheet) {
      throw new BadRequestException('The uploaded file contains no data.');
    }

    const headers: string[] = [];
    worksheet
      .getRow(1)
      .eachCell({ includeEmpty: true }, (cell) =>
        headers.push(String(cell.value ?? '').trim()),
      );

    if (headers.filter(Boolean).length === 0) {
      throw new BadRequestException(
        'The first row of the file must contain column headers.',
      );
    }

    const rows: any[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const obj: any = { __rowNumber: rowNumber };
      headers.forEach((header, i) => {
        obj[header] = row.getCell(i + 1).value;
      });
      rows.push(obj);
    });

    return { headers, rows };
  }

  /**
   * Column aliases per documented statement format. Project Zoe accepts
   * mobile-money, bank and cash-collection exports, which label the same data
   * differently ("Date" vs "Transaction Date", "Sender Name" vs "Account
   * Name"), so the importer detects columns instead of demanding one layout.
   * See https://docs.projectzoe.org/finance/tutorial.
   */
  private static readonly COLUMN_ALIASES: Record<string, string[]> = {
    dateColumn: [
      'date',
      'transactiondate',
      'txndate',
      'valuedate',
      'postingdate',
      'completiontime',
    ],
    amountColumn: ['amount', 'credit', 'amountreceived', 'value', 'paidin'],
    senderNameColumn: [
      'sendername',
      'name',
      'accountname',
      'sender',
      'from',
      'customername',
      'payer',
    ],
    senderPhoneColumn: [
      'senderphone',
      'phone',
      'phonenumber',
      'msisdn',
      'mobile',
      'mobilenumber',
    ],
    referenceColumn: [
      'reference',
      'ref',
      'referencenumber',
      'transactionid',
      'transactionreference',
      'receipt',
      'receiptnumber',
      'accountnumber',
    ],
    narrationColumn: [
      'narration',
      'description',
      'details',
      'notes',
      'particulars',
      'remarks',
    ],
  };

  private static normalizeHeader(header: string): string {
    return header.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Works out which header holds each field. An explicit override from the
   * request always wins; otherwise the header is matched against the alias
   * list for that field, exactly first and then by substring so that
   * "Amount (UGX)" still resolves to the amount column.
   */
  private resolveColumns(
    headers: string[],
    overrides: ImportTransactionDto,
  ): Required<
    Pick<
      ImportTransactionDto,
      | 'dateColumn'
      | 'amountColumn'
      | 'referenceColumn'
      | 'senderNameColumn'
      | 'senderPhoneColumn'
      | 'narrationColumn'
    >
  > {
    const present = headers.filter(Boolean);
    const normalized = present.map((header) => ({
      header,
      key: TransactionsService.normalizeHeader(header),
    }));

    const detect = (field: string, fallback: string): string => {
      const override = (overrides as any)[field];
      if (override) {
        return override;
      }

      const aliases = TransactionsService.COLUMN_ALIASES[field] ?? [];

      for (const alias of aliases) {
        const exact = normalized.find((entry) => entry.key === alias);
        if (exact) {
          return exact.header;
        }
      }

      for (const alias of aliases) {
        const partial = normalized.find((entry) => entry.key.includes(alias));
        if (partial) {
          return partial.header;
        }
      }

      // Nothing matched: keep the documented default so the caller still gets
      // a usable "Missing date"/"Missing amount" error against a named column.
      return fallback;
    };

    return {
      dateColumn: detect('dateColumn', 'Date'),
      amountColumn: detect('amountColumn', 'Amount'),
      referenceColumn: detect('referenceColumn', 'Reference'),
      senderNameColumn: detect('senderNameColumn', 'Sender Name'),
      senderPhoneColumn: detect('senderPhoneColumn', 'Sender Phone'),
      narrationColumn: detect('narrationColumn', 'Narration'),
    };
  }

  /**
   * Turns one file row into the preview shape the import wizard renders.
   * Invalid rows come back with `isValid: false` and their reasons attached
   * rather than being dropped, so the user can see what was rejected.
   */
  private toParsedTransaction(
    row: any,
    columns: ReturnType<TransactionsService['resolveColumns']>,
  ): ParsedTransactionDto {
    const rowIndex: number = row.__rowNumber;
    const errors: string[] = [];

    const dateValue = row[columns.dateColumn];
    const amountValue = row[columns.amountColumn];

    let transactionDate: Date | null = null;
    if (!dateValue) {
      errors.push('Missing date');
    } else {
      // Statement times are wall-clock readings in the finance timezone, not
      // in whatever zone the server happens to run. See finance-time.ts.
      transactionDate = parseStatementDate(dateValue);
      if (!transactionDate) {
        errors.push('Invalid date format');
      }
    }

    let amount = NaN;
    if (
      amountValue === null ||
      amountValue === undefined ||
      amountValue === ''
    ) {
      errors.push('Missing amount');
    } else {
      amount = parseFloat(String(amountValue).replace(/[^0-9.-]/g, ''));
      if (isNaN(amount)) {
        errors.push('Invalid amount format');
      }
    }

    const asText = (column: string) => {
      const value = row[column];
      return value === null || value === undefined || value === ''
        ? null
        : String(value);
    };

    return {
      rowIndex,
      transactionDate: transactionDate ? transactionDate.toISOString() : '',
      amount: isNaN(amount) ? 0 : amount,
      externalReference: asText(columns.referenceColumn),
      senderName: asText(columns.senderNameColumn),
      senderPhone: asText(columns.senderPhoneColumn),
      narration: asText(columns.narrationColumn),
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Parses an uploaded file into preview rows WITHOUT writing anything. The
   * wizard shows the result, then posts the rows the user keeps to
   * `importParsed`.
   */
  async parseFile(
    file: Express.Multer.File,
    options: ParseTransactionDto,
    user: any,
  ): Promise<ParsedTransactionDto[]> {
    const tenantId = this.tenantContext.requireTenant();

    const account = await this.accountRepository.findOne({
      where: { id: options.accountId, tenant: { id: tenantId } },
    });

    if (!account) {
      throw new NotFoundException(
        `Account with ID ${options.accountId} not found`,
      );
    }

    const { headers, rows } = await this.readRows(file);
    const columns = this.resolveColumns(headers, options);

    this.logger.business('log', 'Parsing transaction file for preview', {
      operation: 'parseTransactions',
      userId: user?.id,
      metadata: {
        accountId: options.accountId,
        fileName: file.originalname,
        rowCount: rows.length,
        columns,
      },
    });

    const parsed = rows.map((row) => this.toParsedTransaction(row, columns));

    // `applyServiceTimeRules` gates the category-rules engine. Load the rules
    // once for the whole import — calling matchTransaction per row issued one
    // DB query per row, which is expensive for large statements.
    if (options.applyServiceTimeRules) {
      const rules = await this.categoryRulesService.loadRulesForAccount(
        options.accountId,
      );

      for (const item of parsed) {
        let matched: { category: TransactionCategory; rule: string } | null =
          null;

        if (item.isValid) {
          const candidate = new Transaction();
          candidate.amount = item.amount;
          candidate.transactionDate = new Date(item.transactionDate);
          candidate.externalReference = item.externalReference;
          candidate.senderName = item.senderName;
          candidate.senderPhone = item.senderPhone;
          candidate.narration = item.narration;

          matched = this.categoryRulesService.evaluateWithRules(
            candidate,
            rules,
            options.accountId,
          );
        }

        item.category = matched?.category ?? options.defaultCategory;
        item.matchedRule = matched ? matched.rule : 'Default category';
      }
    } else {
      for (const item of parsed) {
        item.category = options.defaultCategory;
        item.matchedRule = 'Default category';
      }
    }

    return parsed;
  }

  /**
   * Commits rows the user reviewed in the wizard. Rows that fail validation
   * are rejected here too — the preview is a convenience, not the authority
   * on what is safe to write.
   */
  async importParsed(
    dto: BulkImportTransactionDto,
    user: any,
  ): Promise<{ imported: number; errors: string[] }> {
    const tenantId = this.tenantContext.requireTenant();

    const account = await this.accountRepository.findOne({
      where: { id: dto.accountId, tenant: { id: tenantId } },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${dto.accountId} not found`);
    }

    this.logger.business('log', 'Importing reviewed transactions', {
      operation: 'importParsedTransactions',
      userId: user?.id,
      metadata: { accountId: dto.accountId, rowCount: dto.transactions.length },
    });

    let imported = 0;
    const errors: string[] = [];

    for (const item of dto.transactions) {
      const label = `Row ${item.rowIndex}`;

      const transactionDate = new Date(item.transactionDate);
      if (isNaN(transactionDate.getTime())) {
        errors.push(`${label}: Invalid date format`);
        continue;
      }

      if (typeof item.amount !== 'number' || isNaN(item.amount)) {
        errors.push(`${label}: Invalid amount format`);
        continue;
      }

      try {
        const transaction = new Transaction();
        transaction.tenant = { id: tenantId } as any;
        transaction.account = account;
        transaction.amount = item.amount;
        transaction.transactionDate = transactionDate;
        transaction.externalReference = item.externalReference ?? null;
        transaction.senderName = item.senderName ?? null;
        transaction.senderPhone = item.senderPhone ?? null;
        transaction.senderPhoneNormalized = normalizePhone(item.senderPhone);
        transaction.narration = item.narration ?? null;
        transaction.category = item.category;
        transaction.status = TransactionStatus.PENDING;

        await this.repository.save(transaction);
        imported++;
      } catch (error) {
        errors.push(`${label}: ${error.message}`);
      }
    }

    this.logger.business('log', 'Reviewed transaction import completed', {
      operation: 'importParsedTransactions',
      userId: user?.id,
      metadata: {
        accountId: dto.accountId,
        imported,
        errorCount: errors.length,
      },
    });

    return { imported, errors };
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

    const transactions = await this.repository.find({
      where,
      relations: [
        'account',
        'matches',
        'matches.contact',
        'matches.contact.person',
      ],
      skip: dto.skip || 0,
      take: dto.limit || 100,
      order: { transactionDate: 'DESC' },
    });

    // The reconciliation screen needs to see the transaction's live match: to
    // show who it was matched to, and to offer Approve/Reject while that match
    // is still pending. Without this it only ever saw `account`, so a matched
    // transaction looked untouched and could never be approved.
    return transactions.map((transaction) => ({
      ...transaction,
      reconciliationMatch: this.toActiveMatch(transaction),
    })) as Transaction[];
  }

  /**
   * The match that currently governs a transaction: the most recent one that
   * has not been rejected. A rejected match is water under the bridge — it
   * leaves the transaction free to be matched again.
   */
  private toActiveMatch(transaction: Transaction): any {
    const active = (transaction.matches || [])
      .filter((match) => match.status !== MatchStatus.REJECTED)
      .sort((a, b) => b.id - a.id)[0];

    if (!active) {
      return null;
    }

    return {
      id: active.id,
      status: active.status,
      matchType: active.matchType,
      confidenceScore: active.confidenceScore,
      contact: active.contact
        ? {
            id: active.contact.id,
            name:
              getPersonFullName(active.contact.person) ||
              `Contact ${active.contact.id}`,
          }
        : undefined,
    };
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
