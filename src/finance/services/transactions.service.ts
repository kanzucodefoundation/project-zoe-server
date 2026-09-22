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
  In,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';
import { Readable } from 'stream';
import { Workbook, Worksheet } from 'exceljs';
import Transaction from '../entities/transaction.entity';
import FinancialAccount from '../entities/financial-account.entity';
import {
  AccountingPosting,
  AccountingPostingStatus,
} from '../../integrations/quickbooks/entities/accounting-posting.entity';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  BulkUpdateGivingItemDto,
  SearchTransactionDto,
  ImportTransactionDto,
  ParseTransactionDto,
  ParsedTransactionDto,
  BulkImportTransactionDto,
} from '../dto/transaction.dto';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { MatchStatus } from '../enums/match-status.enum';
import {
  DEFAULT_TRANSACTION_CATEGORY,
  TransactionCategory,
  resolveTransactionCategory,
} from '../enums/transaction-category.enum';
import {
  cleanSenderName,
  detectCategory,
  detectGivingItem,
  extractPersonName,
  extractPhone,
  extractTitheNumber,
  GivingItemCandidate,
} from '../statement-parsing';
import { GivingCategoriesService } from './giving-categories.service';
import { CategoryRoutingService } from './category-routing.service';
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
  private readonly postingRepository: Repository<AccountingPosting>;
  private readonly logger: ContextLogger;

  constructor(
    @Inject('CONNECTION') connection: Connection,
    private tenantContext: TenantContext,
    private appLogger: AppLogger,
    private categoryRulesService: CategoryRulesService,
    private givingCategoriesService: GivingCategoriesService,
    private categoryRoutingService: CategoryRoutingService,
  ) {
    this.repository = connection.getRepository(Transaction);
    this.accountRepository = connection.getRepository(FinancialAccount);
    this.postingRepository = connection.getRepository(AccountingPosting);
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

    // Same item resolution as the wizard import: a message naming an item books
    // against it, otherwise the item mapped to the category it resolved to.
    // Loaded once for the whole file rather than per row.
    const givingOptions = await this.givingCategoriesService
      .list()
      .catch(() => []);
    const itemCandidates: GivingItemCandidate[] = givingOptions
      .filter((option) => option.qboItemId && option.qboItemName)
      .map((option) => ({
        id: option.qboItemId as string,
        name: option.qboItemName as string,
      }));
    const itemByCategory = new Map(
      givingOptions
        .filter((option) => option.qboItemId && option.category)
        .map((option) => [
          option.category as TransactionCategory,
          {
            id: option.qboItemId as string,
            name: option.qboItemName as string,
          },
        ]),
    );

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
        // The wizard import reads the category out of the message; this path
        // never did, so every uploaded row arrived uncategorised.
        transaction.category =
          detectCategory(transaction.narration) ?? DEFAULT_TRANSACTION_CATEGORY;

        const namedItem = detectGivingItem(
          transaction.narration,
          itemCandidates,
        );
        const item = namedItem ?? itemByCategory.get(transaction.category);
        transaction.externalItemId = item?.id ?? null;
        transaction.externalItemName = item?.name ?? null;

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
    // Order matters. Mobile-money exports carry both "From" (a FRI identifier
    // like FRI:256763676927/MSISDN) and "From name" (the actual person), so
    // the more specific alias has to be tried first or every sender name comes
    // through as a URI. "To name" is the church receiving the money, never the
    // giver, and is deliberately absent from this list.
    senderNameColumn: [
      'fromname',
      'sendername',
      'accountname',
      'customername',
      'name',
      'sender',
      'payer',
      'from',
    ],
    // Last resort is "From": these statements put no bare phone column in the
    // file at all, but the FRI value carries the MSISDN, which the matcher
    // needs. `extractPhone` digs the number back out.
    senderPhoneColumn: [
      'senderphone',
      'phonenumber',
      'mobilenumber',
      'phone',
      'msisdn',
      'mobile',
      'from',
    ],
    referenceColumn: [
      'referencenumber',
      'transactionreference',
      'transactionid',
      'receiptnumber',
      'accountnumber',
      'reference',
      'receipt',
      'ref',
      'id',
    ],
    // MoMo exports label the free-text box inconsistently; "reason" and
    // "to message" are what MTN and Airtel statements actually use, and that
    // field is where givers put the category, tithe number and their name.
    narrationColumn: [
      'narration',
      'reason',
      'tomessage',
      'message',
      'description',
      'details',
      'notes',
      'note',
      'particulars',
      'remarks',
      'remark',
      'purpose',
      'comment',
      'transactiondetails',
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
        // Substring matching is only safe for distinctive aliases. Allowing a
        // two- or three-letter one would let 'id' claim "Paid In".
        if (alias.length < 4) {
          continue;
        }
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

    const narration = asText(columns.narrationColumn);

    // MoMo statements often carry no sender-name column at all, and when they
    // do it arrives shouting with the phone number glued on. Fall back to the
    // name the giver typed into the message.
    const senderName =
      cleanSenderName(asText(columns.senderNameColumn)) ??
      extractPersonName(narration);

    return {
      rowIndex,
      transactionDate: transactionDate ? transactionDate.toISOString() : '',
      amount: isNaN(amount) ? 0 : amount,
      externalReference: asText(columns.referenceColumn),
      senderName,
      senderPhone: extractPhone(asText(columns.senderPhoneColumn)),
      narration,
      titheNumber: extractTitheNumber(narration),
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

    // The giving items come from QuickBooks, so a message naming "Offertory -
    // YXP" can be booked against that exact item rather than being flattened
    // into the four-value category. Loaded once for the whole file.
    const givingOptions = await this.givingCategoriesService
      .list()
      .catch(() => []);
    const itemCandidates: GivingItemCandidate[] = givingOptions
      .filter((option) => option.qboItemId && option.qboItemName)
      .map((option) => ({
        id: option.qboItemId as string,
        name: option.qboItemName as string,
      }));
    const itemByCategory = new Map(
      givingOptions
        .filter((option) => option.qboItemId && option.category)
        .map((option) => [
          option.category as TransactionCategory,
          {
            id: option.qboItemId as string,
            name: option.qboItemName as string,
          },
        ]),
    );
    const categoryByItemId = new Map(
      givingOptions
        .filter((option) => option.qboItemId && option.category)
        .map((option) => [
          option.qboItemId as string,
          option.category as TransactionCategory,
        ]),
    );

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

        this.applyCategory(
          item,
          matched,
          options,
          itemCandidates,
          categoryByItemId,
          itemByCategory,
        );
      }
    } else {
      for (const item of parsed) {
        this.applyCategory(
          item,
          null,
          options,
          itemCandidates,
          categoryByItemId,
          itemByCategory,
        );
      }
    }

    return parsed;
  }

  /**
   * Settles one preview row's category and records why.
   *
   * Order of preference: an explicit category rule, then the giving category
   * named in the statement message, then the wizard's default. Nothing matching
   * means tithe — MoMo lines routinely carry no message, and unspecified giving
   * is treated as tithe.
   */
  private applyCategory(
    item: ParsedTransactionDto,
    matched: { category: TransactionCategory; rule: string } | null,
    options: ParseTransactionDto,
    itemCandidates: GivingItemCandidate[],
    categoryByItemId: Map<string, TransactionCategory>,
    itemByCategory: Map<TransactionCategory, { id: string; name: string }>,
  ): void {
    // The QuickBooks item is the precise answer; settle it first.
    const detectedItem = detectGivingItem(item.narration, itemCandidates);
    if (detectedItem) {
      item.externalItemId = detectedItem.id;
      item.externalItemName = detectedItem.name;
    } else {
      item.externalItemId = options.defaultItemId ?? null;
      item.externalItemName = options.defaultItemId
        ? options.defaultItemName ?? null
        : null;
    }

    if (matched) {
      item.category = matched.category;
      item.matchedRule = matched.rule;
      this.applyItemForCategory(item, itemByCategory, options);
      return;
    }

    if (detectedItem) {
      item.category =
        categoryByItemId.get(detectedItem.id) ??
        detectCategory(item.narration) ??
        options.defaultCategory ??
        DEFAULT_TRANSACTION_CATEGORY;
      item.matchedRule = `Matched "${detectedItem.name}" in the statement message`;
      return;
    }

    const detected = detectCategory(item.narration);
    if (detected) {
      item.category = detected;
      item.matchedRule = 'Detected from statement message';
      if (!detectedItem)
        this.applyItemForCategory(item, itemByCategory, options);
      return;
    }

    item.category = options.defaultCategory ?? DEFAULT_TRANSACTION_CATEGORY;
    item.matchedRule = 'Default category';
    if (!detectedItem) this.applyItemForCategory(item, itemByCategory, options);
  }

  /**
   * The item for the category the message resolved to, so "Special Offering"
   * books against the offering item rather than the wizard's default.
   */
  private applyItemForCategory(
    item: ParsedTransactionDto,
    itemByCategory: Map<TransactionCategory, { id: string; name: string }>,
    options: ParseTransactionDto,
  ): void {
    const forCategory = item.category
      ? itemByCategory.get(item.category)
      : undefined;
    if (forCategory) {
      item.externalItemId = forCategory.id;
      item.externalItemName = forCategory.name;
      return;
    }
    item.externalItemId = options.defaultItemId ?? null;
    item.externalItemName = options.defaultItemId
      ? options.defaultItemName ?? null
      : null;
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
        transaction.category = item.category ?? DEFAULT_TRANSACTION_CATEGORY;
        transaction.externalItemId = item.externalItemId ?? null;
        transaction.externalItemName = item.externalItemName ?? null;
        transaction.status = TransactionStatus.PENDING;

        // Keep what the importer read out of the message. The tithe number is
        // what the matcher uses to identify the giver, so losing it here would
        // make reconciliation fall back to fuzzy name matching.
        const titheNumber =
          item.titheNumber ?? extractTitheNumber(item.narration);
        if (titheNumber) {
          transaction.rawData = {
            ...(transaction.rawData ?? {}),
            titheNumber,
          };
        }

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

  /**
   * The successful QuickBooks posting for each of these transactions, if any.
   *
   * Only POSTED rows count: a FAILED attempt must still be retryable, so it
   * deliberately does not mark the transaction as done.
   */
  private async loadPostings(
    transactionIds: number[],
  ): Promise<Map<number, AccountingPosting>> {
    if (transactionIds.length === 0) return new Map();

    const tenantId = this.tenantContext.requireTenant();
    const postings = await this.postingRepository.find({
      where: {
        tenantId,
        transactionId: In(transactionIds),
        status: AccountingPostingStatus.POSTED,
      },
    });

    return new Map(postings.map((p) => [p.transactionId, p]));
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
    //
    // It also needs to know what has already reached QuickBooks, so a posted
    // receipt is shown as posted rather than offered for posting again. Fetched
    // in one query for the whole page rather than one per row.
    const postingsByTransaction = await this.loadPostings(
      transactions.map((t) => t.id),
    );
    const currencyRouted = this.currencyRoutedCategories(transactions);

    return transactions.map((transaction) => ({
      ...transaction,
      reconciliationMatch: this.toActiveMatch(transaction),
      accountingPosting: postingsByTransaction.get(transaction.id) ?? null,
      // False for offertory: it books to a standing customer, so there is no
      // giver to identify and the screen offers it for posting straight away.
      requiresMatch: !currencyRouted.has(
        resolveTransactionCategory(transaction.category),
      ),
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

    // Both describe what the gift was booked as, so both freeze once posted.
    if (dto.category !== undefined || dto.externalItemId !== undefined) {
      await this.assertNotPosted([transaction.id]);
    }

    if (dto.category !== undefined) {
      transaction.category = dto.category;
      // The posting plugin prefers the stored item, so leaving the previous one
      // would book the new category against the old item's QuickBooks id.
      if (dto.externalItemId === undefined) {
        const forCategory =
          await this.givingCategoriesService.resolveItemForCategory(
            dto.category,
          );
        transaction.externalItemId = forCategory.externalItemId;
        transaction.externalItemName = forCategory.externalItemName;
      }
    }

    if (dto.externalItemId !== undefined) {
      const resolved = await this.givingCategoriesService.resolveGivingItem(
        dto.externalItemId,
      );
      // The item wins over `dto.category`: it is what QuickBooks books against.
      transaction.externalItemId = resolved.externalItemId;
      transaction.externalItemName = resolved.externalItemName;
      transaction.category = resolved.category;
    }

    const saved = await this.repository.save(transaction);
    // Re-categorising to or from a collected category changes whether the row
    // still needs a giver, so the screen is told straight away.
    return {
      ...saved,
      requiresMatch: !this.categoryRoutingService.isCurrencyRouted(
        resolveTransactionCategory(saved.category),
      ),
    } as Transaction;
  }

  /** Re-categorises several transactions, with one QuickBooks item lookup. */
  async bulkUpdateGivingItem(
    dto: BulkUpdateGivingItemDto,
    user: any,
  ): Promise<{ updated: number; transactionIds: number[] }> {
    const tenantId = this.tenantContext.requireTenant();
    const ids = [...new Set(dto.transactionIds)];

    const transactions = await this.repository.find({
      where: { id: In(ids), tenant: { id: tenantId } },
    });

    if (transactions.length !== ids.length) {
      const found = new Set(transactions.map((t) => t.id));
      const missing = ids.filter((id) => !found.has(id));
      throw new NotFoundException(
        `These transactions were not found: ${missing.join(', ')}`,
      );
    }

    await this.assertNotPosted(ids);

    const resolved = await this.givingCategoriesService.resolveGivingItem(
      dto.externalItemId ?? null,
    );

    transactions.forEach((transaction) => {
      transaction.externalItemId = resolved.externalItemId;
      transaction.externalItemName = resolved.externalItemName;
      transaction.category = resolved.category;
    });

    await this.repository.save(transactions);

    this.logger.business('log', 'Bulk updated giving item', {
      operation: 'bulkUpdateGivingItem',
      userId: user?.id,
      resource: 'transaction',
      metadata: {
        count: transactions.length,
        externalItemId: resolved.externalItemId,
        externalItemName: resolved.externalItemName,
        category: resolved.category,
      },
    });

    return { updated: transactions.length, transactionIds: ids };
  }

  /** Categories in this page that post to a standing customer. */
  private currencyRoutedCategories(transactions: Transaction[]): Set<string> {
    return new Set(
      transactions
        .map((t) => resolveTransactionCategory(t.category))
        .filter((category) =>
          this.categoryRoutingService.isCurrencyRouted(category),
        ),
    );
  }

  /** Refuses to re-categorise a gift already posted; correct it in QuickBooks. */
  private async assertNotPosted(transactionIds: number[]): Promise<void> {
    const postings = await this.loadPostings(transactionIds);
    if (postings.size === 0) return;

    const posted = [...postings.keys()].sort((a, b) => a - b);
    throw new BadRequestException(
      `Already posted to QuickBooks, so the giving category can no longer be changed here: transaction${
        posted.length > 1 ? 's' : ''
      } ${posted.join(', ')}. Correct it in QuickBooks instead.`,
    );
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
