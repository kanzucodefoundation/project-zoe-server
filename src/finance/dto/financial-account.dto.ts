import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AccountType } from '../enums/account-type.enum';

export class CreateFinancialAccountDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsNotEmpty()
  @IsEnum(AccountType)
  accountType: AccountType;

  @IsOptional()
  @IsString()
  currency?: string = 'UGX';

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ownerGroupId?: number;
}

/**
 * Creates a Zoe financial account from an existing QuickBooks account, so the
 * two are linked from the moment the account exists rather than being
 * reconciled later in the posting dialog.
 */
export class CreateAccountFromQuickBooksDto {
  @IsNotEmpty()
  @IsString()
  qboAccountId: string;

  @IsNotEmpty()
  @IsEnum(AccountType)
  accountType: AccountType;

  /** Overrides the QuickBooks account name when the church prefers its own. */
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class UpdateFinancialAccountDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  id: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ownerGroupId?: number;
}

export class SearchFinancialAccountDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ownerGroupId?: number;

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

export default CreateFinancialAccountDto;
