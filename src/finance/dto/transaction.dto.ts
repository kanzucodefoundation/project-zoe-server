import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsDateString,
  IsArray,
  IsBoolean,
  ValidateNested,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { TransactionCategory } from '../enums/transaction-category.enum';

export class CreateTransactionDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  accountId: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsDateString()
  transactionDate: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  senderPhone?: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsOptional()
  @IsEnum(TransactionCategory)
  category?: TransactionCategory;
}

export class UpdateTransactionDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  id: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  senderPhone?: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsEnum(TransactionCategory)
  category?: TransactionCategory;
}

export class SearchTransactionDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  accountId?: number;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsEnum(TransactionCategory)
  category?: TransactionCategory;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  limit?: number = 100;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  skip?: number = 0;
}

export class ImportTransactionDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  accountId: number;

  @IsOptional()
  @IsString()
  dateColumn?: string;

  @IsOptional()
  @IsString()
  amountColumn?: string;

  @IsOptional()
  @IsString()
  referenceColumn?: string;

  @IsOptional()
  @IsString()
  senderNameColumn?: string;

  @IsOptional()
  @IsString()
  senderPhoneColumn?: string;

  @IsOptional()
  @IsString()
  narrationColumn?: string;
}

/**
 * Options for POST /parse. Extends the column-mapping options of
 * ImportTransactionDto with the two settings the import wizard collects on its
 * first step.
 *
 * Sent as multipart form fields, so every value arrives as a string —
 * `applyServiceTimeRules` needs an explicit string-to-boolean transform rather
 * than `@Type(() => Boolean)`, which would coerce the string 'false' to true.
 */
export class ParseTransactionDto extends ImportTransactionDto {
  @IsOptional()
  @IsEnum(TransactionCategory)
  defaultCategory?: TransactionCategory;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  applyServiceTimeRules?: boolean;
}

/**
 * One row of a parsed file, as previewed in the wizard before anything is
 * written. Doubles as the request shape for POST /import: the client sends
 * back the rows the user chose to keep.
 */
export class ParsedTransactionDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  rowIndex: number;

  @IsNotEmpty()
  @IsDateString()
  transactionDate: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  externalReference?: string | null;

  @IsOptional()
  @IsString()
  senderName?: string | null;

  @IsOptional()
  @IsString()
  senderPhone?: string | null;

  @IsOptional()
  @IsString()
  narration?: string | null;

  @IsOptional()
  @IsEnum(TransactionCategory)
  category?: TransactionCategory;

  isValid: boolean;

  errors?: string[];

  /** Why this row got its category — a rule name, or the default fallback. */
  @IsOptional()
  @IsString()
  matchedRule?: string;
}

export class BulkImportTransactionDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  accountId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParsedTransactionDto)
  transactions: ParsedTransactionDto[];
}

export default CreateTransactionDto;
