import {GroupPrivacy} from "../enums/groupPrivacy";
import { IsNotEmpty, IsOptional } from 'class-validator';
import { Column } from 'typeorm';

export default class CreateGroupDto {
    @IsOptional()
    id?: number;
    @IsNotEmpty()
    privacy: GroupPrivacy;
    @IsNotEmpty()
    name: string;
    @IsNotEmpty()
    details: string;
    @IsNotEmpty()
    categoryId: string;
    @IsOptional()
    parentId?: number;
    @IsOptional()
    metaData?: string;

    @IsOptional()
    freeForm?: string;

    @IsOptional()
    latLon?: string;

    @IsOptional()
    placeId?: string;
}


