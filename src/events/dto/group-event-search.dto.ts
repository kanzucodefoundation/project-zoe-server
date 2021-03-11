import SearchDto from '../../shared/dto/search.dto';

export default class GroupEventSearchDto extends SearchDto {
    groupId?: number;
    categoryId?:string;
}


