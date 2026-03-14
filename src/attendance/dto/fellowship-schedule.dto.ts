import {
  IsNumber,
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class CreateFellowshipScheduleDto {
  @IsNumber()
  fellowshipGroupId: number;

  @IsNumber()
  @Min(0)
  @Max(6)
  meetingDay: number;

  @IsString()
  startTime: string;

  @IsEnum(['weekly', 'biweekly', 'monthly'])
  frequency: 'weekly' | 'biweekly' | 'monthly';
}

export class UpdateFellowshipScheduleDto {
  @IsNumber()
  @Min(0)
  @Max(6)
  @IsOptional()
  meetingDay?: number;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsEnum(['weekly', 'biweekly', 'monthly'])
  @IsOptional()
  frequency?: 'weekly' | 'biweekly' | 'monthly';

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
