import { PartialType } from '@nestjs/mapped-types';
import { CreateHelpDto } from './create-help.dto';
import { IsNotEmpty, IsNumber } from 'class-validator';
import { URLCategory } from '../enums/URLCategory';

export class UpdateHelpDto extends PartialType(CreateHelpDto) {

    @IsNotEmpty()
    title: string;
    url: string;
    category: URLCategory;
}
