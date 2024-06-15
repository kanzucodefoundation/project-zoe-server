import SearchDto from "../../shared/dto/search.dto";
import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UserSearchDto extends SearchDto {
  @IsOptional()
  phone?: string;
  @IsOptional()
  email?: string;
}
