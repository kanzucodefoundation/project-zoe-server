import SearchDto from "src/shared/dto/search.dto";

export class UserRoleDto {
    id: number;
    roleName: string;
    capabilities: string[];
    isActive: Boolean;

}

export class UpdateUserRoleDto {
    
}

export class UserRoleSearch extends SearchDto {
    limit: 100;
    skip: 0;
}