import {Schema} from "mongoose";
let mongooseHidden = require('mongoose-hidden')()
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');

export const configureId = (schema: Schema) => {
    schema.virtual('id').get(function () {
        return this._id.toHexString();
    });
    schema.set('toJSON', {
        virtuals: true
    });
    schema.plugin(mongooseLeanVirtuals);
    schema.plugin(mongooseHidden)
}




