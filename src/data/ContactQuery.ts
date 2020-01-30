import BaseQuery from "./BaseQuery";
export interface ContactQuery extends BaseQuery {
    phone?: string;
    email?: string;
}
