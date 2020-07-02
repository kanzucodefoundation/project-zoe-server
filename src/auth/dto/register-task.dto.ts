import { ApiProperty } from '@nestjs/swagger';
import { MinistryCategories } from 'src/tasks/ministryCategories';
import { IsEnum } from 'class-validator';

export class RegisterTaskDto {

    @ApiProperty()
    id: number;

    
    @IsEnum(MinistryCategories)
    @ApiProperty()
    ministry: MinistryCategories;

    @ApiProperty()
    taskName: string;

    @ApiProperty()
    taskDescription: string;
}
