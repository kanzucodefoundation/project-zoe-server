import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsArray,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MatchType } from '../enums/match-type.enum';
import { MatchStatus } from '../enums/match-status.enum';

export class CreateMatchDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  transactionId: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  contactId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  groupId?: number;

  @IsNotEmpty()
  @IsEnum(MatchType)
  matchType: MatchType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  confidenceScore?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMatchDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  id: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  contactId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  groupId?: number;

  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkApproveMatchesDto {
  @IsNotEmpty()
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  matchIds: number[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SearchMatchDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  transactionId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  contactId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  groupId?: number;

  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @IsOptional()
  @IsEnum(MatchType)
  matchType?: MatchType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minConfidence?: number;

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

export class RunMatchingDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  accountId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minConfidenceThreshold?: number = 60;

  @IsOptional()
  autoApproveAboveThreshold?: number;

  @IsOptional()
  @IsString()
  pluginId?: string;
}

export default CreateMatchDto;

/**
 * A suggested contact for an unreconciled transaction, as rendered in the
 * manual match dialog. Response-only — nothing is validated inbound.
 */
export class MatchSuggestionDto {
  contact: {
    id: number;
    name: string;
    phone?: string;
    /** Campus this giver belongs to, which is what the gift is attributed to. */
    location?: string;
    /** FOB above that campus — the QuickBooks class the gift posts against. */
    fob?: string;
    /**
     * True when the giver is in no Location or FOB and both fell back to the
     * mother group, so the reviewer can see the attribution is a default.
     */
    attributionIsFallback?: boolean;
  };
  confidenceScore: number;
  matchReasons: string[];
}
