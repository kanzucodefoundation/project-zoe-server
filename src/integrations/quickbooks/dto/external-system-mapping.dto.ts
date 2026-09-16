import {
  IsObject,
  IsOptional,
  IsString,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

/**
 * Request bodies for the external-system mapping endpoints.
 *
 * These are classes, not interfaces, deliberately. TypeScript erases an
 * interface at compile time, so `@Body() dto: SomeInterface` gives the global
 * `ValidationPipe` no metadata to work with — every field becomes optional and
 * unvalidated at runtime, and a malformed body travels all the way to
 * `repo.save()`, where it surfaces as a 500 from PostgreSQL rather than a 400
 * naming the offending field.
 *
 * The `MaxLength` values mirror the column widths on `ExternalSystemMapping`,
 * so an over-long value is rejected at the edge instead of by the database.
 */
export class CreateMappingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  system: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  internalReferenceType: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  internalReferenceId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  externalReferenceType: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  externalReferenceId: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalReferenceName?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateMappingDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  externalReferenceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalReferenceName?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * Internal lookup shapes. These are never bound to a request body — they are
 * only ever built in server code — so an interface is the right tool here and
 * the reasoning above does not apply.
 */
export interface LookupByInternalDto {
  system: string;
  internalReferenceType: string;
  internalReferenceId: string | number;
  externalReferenceType?: string;
}

export interface LookupByExternalDto {
  system: string;
  externalReferenceType: string;
  externalReferenceId: string;
}
