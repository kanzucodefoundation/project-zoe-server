/* eslint-disable semi */
import BaseQuery from "../../../data/BaseQuery";

export default interface GroupQuery extends BaseQuery {
    category: string;
    query?: string;
    limit?: number;
    skip?: number;
}
