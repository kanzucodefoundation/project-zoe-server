import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionCategory } from '../enums/transaction-category.enum';

export class RuleConditionDto {
  @IsNotEmpty()
  @IsString()
  field: string;

  @IsNotEmpty()
  @IsString()
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'regex';

  @IsNotEmpty()
  @IsString()
  value: string;
}

export class CreateCategoryRuleDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEnum(TransactionCategory)
  category: TransactionCategory;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleConditionDto)
  conditions: RuleConditionDto[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priority?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  accountId?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateCategoryRuleDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  id: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(TransactionCategory)
  category?: TransactionCategory;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleConditionDto)
  conditions?: RuleConditionDto[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}

export class SearchCategoryRuleDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsEnum(TransactionCategory)
  category?: TransactionCategory;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  accountId?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

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

export default CreateCategoryRuleDto;
