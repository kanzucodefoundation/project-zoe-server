import { PhoneCategory } from '../enums/phoneCategory';

export class PhoneDto {
  id: number;

  category: PhoneCategory;

  value: string;

  isPrimary: boolean;

  contactId: number;
}
