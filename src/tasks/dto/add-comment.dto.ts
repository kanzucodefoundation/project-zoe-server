import { IsString } from 'class-validator';

export class AddCommentDto {
  @IsString()
  body: string;
}
