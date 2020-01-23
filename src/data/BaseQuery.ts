export default interface IBaseQuery {
    query?: string;
    limit?: number;
    skip?: number;
};;;;;;;;;;;



export interface IContactQuery extends IBaseQuery{
    phone?: string;
    email?: string;
}
