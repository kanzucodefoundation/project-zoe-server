import { IsNotEmpty } from 'class-validator';
import { CreatePersonDto } from './create-person.dto';

/**
 * RegisterDto - For public user registration
 * Extends CreatePersonDto but makes password required
 */
export class RegisterDto extends CreatePersonDto {
  @IsNotEmpty()
  password: string;
}
