import {IsNotEmpty, IsNumber} from 'class-validator';

export class UpdateUserDto {
    @IsNotEmpty()
    @IsNumber()
    id: number;

    @IsNotEmpty()
    roles: string[];

    password?: string;
}
