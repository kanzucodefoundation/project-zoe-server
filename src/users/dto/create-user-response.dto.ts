import { User } from "../user.entity";
import { UserListDto } from "./user-list.dto";

export class CreateUserResponseDto {
    token: string;
    mailURL: string;
    user: UserListDto;
}




