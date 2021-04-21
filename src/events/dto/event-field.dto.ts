export default class EventFieldDto {
    id: number;
    name: string;
    label: string;
    details?: string;
    type: any;
    isRequired: boolean;
    categoryId?: number;
}
