import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ArrayMinSize,
} from 'class-validator';

export class CheckInDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  contactIds: number[];

  @IsBoolean()
  @IsOptional()
  isChild?: boolean;

  @IsBoolean()
  @IsOptional()
  isFirstTime?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class QuickGuestDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsBoolean()
  @IsOptional()
  isChild?: boolean;

  @IsBoolean()
  @IsOptional()
  isFirstTime?: boolean;
}

export class RosterSearchDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsNumber()
  @IsOptional()
  limit?: number;
}
