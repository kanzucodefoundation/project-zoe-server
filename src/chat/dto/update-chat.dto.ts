import { PartialType } from '@nestjs/mapped-types';
import mailChatDto from './sendMail.dto';

export class UpdateChatDto extends PartialType(mailChatDto) {}
