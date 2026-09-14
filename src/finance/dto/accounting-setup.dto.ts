import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/**
 * Fields used to create a brand-new QuickBooks Customer for a contact that does
 * not yet exist in the church's QBO company. Mirrors the subset of QBO's
 * Customer entity we care about for giving.
 */
export class CreateQboCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  displayName: string;

  @IsOptional()
  @IsString()
  @MaxLength(25)
  givenName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(25)
  familyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  primaryPhone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  primaryEmail?: string;

}

export class SetupMappingDto {
  /**
   * `link` points the internal record at an existing QBO record (default).
   * `create` provisions a new QBO record first, then links it. Only supported
   * for CONTACT → CUSTOMER; every other reference type is a chart-of-accounts
   * decision that belongs in QuickBooks itself.
   */
  @IsOptional()
  @IsIn(['link', 'create'])
  action?: 'link' | 'create';

  @IsString()
  @IsNotEmpty()
  internalReferenceType: string;

  @IsNotEmpty()
  internalReferenceId: string | number;

  @IsString()
  @IsNotEmpty()
  externalReferenceType: string;

  @ValidateIf((o: SetupMappingDto) => (o.action ?? 'link') === 'link')
  @IsString()
  @IsNotEmpty()
  externalReferenceId?: string;

  @IsOptional()
  @IsString()
  externalReferenceName?: string;

  @ValidateIf((o: SetupMappingDto) => o.action === 'create')
  @ValidateNested()
  @Type(() => CreateQboCustomerDto)
  create?: CreateQboCustomerDto;
}

export class ApplySetupDto {
  // `ValidateNested({ each: true })` alone does not assert an array, so a body
  // with `mappings` missing or an object reached the service and threw while
  // iterating — a 500 where a 400 belongs.
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SetupMappingDto)
  mappings: SetupMappingDto[];
}
