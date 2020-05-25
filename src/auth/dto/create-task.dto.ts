import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskDto {
    @ApiProperty()
    id: number;
    @ApiProperty()
    taskname: string;
    @ApiProperty()
    ministry: string;
    @ApiProperty()
    taskdescription: string;
}