import {Schema} from "mongoose";

export const configureId = (schema: Schema) => {
    schema.virtual('id').get(function () {
        return this._id.toHexString();
    });
    schema.set('toJSON', {
        virtuals: true
    });
}
