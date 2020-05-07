import CreateGroupDto from './create-group.dto';
import { IsNumber, Min } from 'class-validator';

export default class UpdateGroupDto extends CreateGroupDto {
    @IsNumber({allowNaN: false})
    @Min(1)
    id: number;
}
