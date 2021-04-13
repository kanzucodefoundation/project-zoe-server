import SearchDto from '../../shared/dto/search.dto';

export default class GroupEventSearchDto extends SearchDto {
    parentId?: number;
    groupId?: number;
    categoryId?:number;
    periodStart?: Date;
    periodEnd?: Date;
}


