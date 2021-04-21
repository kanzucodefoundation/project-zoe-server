import { IsNotEmpty } from "class-validator";

export class EventFieldCreateDto {
    @IsNotEmpty()
    name: string;
    @IsNotEmpty()
    label: string;
    details?: string;
    type: any;
    isRequired: boolean;
    categoryId: number;
}
