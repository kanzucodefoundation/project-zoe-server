
import { ApiProperty } from '@nestjs/swagger';

export class TaskDto {
    @ApiProperty()
    id: number;
    @ApiProperty()
    ministry: string;
    @ApiProperty()
    taskname: string;
    @ApiProperty()
    taskdescription: string;
}
