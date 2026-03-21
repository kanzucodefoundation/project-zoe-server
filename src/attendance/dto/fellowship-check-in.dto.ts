import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ArrayMinSize,
} from 'class-validator';

export class FellowshipCheckInDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  contactIds: number[];

  @IsBoolean()
  @IsOptional()
  isMember?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class QuickFellowshipVisitorDto {
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
  isMember?: boolean;
}
