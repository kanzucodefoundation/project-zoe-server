import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskDto {
    @ApiProperty()
    id: number;
    @ApiProperty()
    ministry: string;
    @ApiProperty()
    taskname: string;
    @ApiProperty()
    taskdescription: string;
    @ApiProperty()
    status: boolean;
}