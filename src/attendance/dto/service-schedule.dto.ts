import {
  IsString,
  IsNumber,
  IsArray,
  IsEnum,
  IsOptional,
  IsBoolean,
  ArrayMinSize,
  Min,
  Max,
} from 'class-validator';

export class CreateServiceScheduleDto {
  @IsString()
  name: string;

  @IsNumber()
  locationGroupId: number;

  @IsEnum(['Sunday', 'Midweek', 'Special'])
  serviceType: 'Sunday' | 'Midweek' | 'Special';

  @IsString()
  startTime: string; // HH:MM format

  @IsEnum(['weekly', 'biweekly', 'monthly'])
  frequency: 'weekly' | 'biweekly' | 'monthly';

  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek: number[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsOptional()
  metaData?: {
    expectedAttendance?: number;
    hasChildrensProgram?: boolean;
    livestreamEnabled?: boolean;
  };
}

export class UpdateServiceScheduleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  locationGroupId?: number;

  @IsEnum(['Sunday', 'Midweek', 'Special'])
  @IsOptional()
  serviceType?: 'Sunday' | 'Midweek' | 'Special';

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsEnum(['weekly', 'biweekly', 'monthly'])
  @IsOptional()
  frequency?: 'weekly' | 'biweekly' | 'monthly';

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  daysOfWeek?: number[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsOptional()
  metaData?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
