import {GroupPrivacy} from "../enums/groupPrivacy";
import {IsNotEmpty} from "class-validator";

export default class CreateGroupDto {

    id?: number;
    @IsNotEmpty()
    privacy: GroupPrivacy;
    @IsNotEmpty()
    name: string;
    @IsNotEmpty()
    details: string;
    @IsNotEmpty()
    categoryId: string;
    parentId?: number;
    metaData?: string;
}


