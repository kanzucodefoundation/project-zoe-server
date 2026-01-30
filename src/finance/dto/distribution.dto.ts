import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsDateString,
  IsArray,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BatchStatus } from '../enums/batch-status.enum';
import { TransactionCategory } from '../enums/transaction-category.enum';

export class CreateBatchDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsDateString()
  periodStart: string;

  @IsNotEmpty()
  @IsDateString()
  periodEnd: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  matchIds?: number[];
}

export class UpdateBatchDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  id: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(BatchStatus)
  status?: BatchStatus;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class SearchBatchDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsEnum(BatchStatus)
  status?: BatchStatus;

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
  limit?: number = 100;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  skip?: number = 0;
}

export class CalculateDistributionsDto {
  @IsNotEmpty()
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  matchIds: number[];

  @IsOptional()
  @IsString()
  pluginId?: string;
}

export class SearchDistributionDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  batchId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  matchId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetGroupId?: number;

  @IsOptional()
  @IsEnum(TransactionCategory)
  category?: TransactionCategory;

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

export default CreateBatchDto;
