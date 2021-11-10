import { URLCategory } from '../enums/URLCategory';

export default class HelpDto {
    id: number;

    category: URLCategory;

    title: string;

    url?: string;

    createdOn: Date;

    modifiedOn: Date; 

}
