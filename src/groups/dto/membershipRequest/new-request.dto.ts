import { IsNotEmpty, IsNumber } from "class-validator";


export default class NewRequestDto {

    contactId: number;
    email: string;
    phone: string;
    churchLocation: number;
    residencePlaceId: string;
    residenceDescription: string;

}



