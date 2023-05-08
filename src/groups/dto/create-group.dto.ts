import { GroupPrivacy } from "../enums/groupPrivacy";
import { IsNotEmpty, IsOptional } from "class-validator";
import InternalAddress from "../../shared/entity/InternalAddress";

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
  categoryId: number;
  @IsOptional()
  parentId?: number;
  @IsOptional()
  metaData?: any;

  @IsOptional()
  address?: InternalAddress;
}
