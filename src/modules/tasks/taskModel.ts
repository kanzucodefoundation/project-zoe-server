import {Schema, model, Document} from "mongoose";
import {check} from "express-validator";


const schema = new Schema({
    name: String,
    isComplete: Boolean,
    details: String,
    parent: String
});

schema.virtual('id').get(function(){
    return this._id.toHexString();
});

// Ensure virtual fields are serialised.
schema.set('toJSON', {
    virtuals: true
});

export type TaskDocument = Document & {
    name: string
    occupation: string
    isComplete: boolean
    details: string
    parent: string | null
};

const TaskModel = model<TaskDocument>('tasks', schema);

export const validation = [
    check('isComplete').isBoolean(),
    check('name').not().isEmpty(),
];

export const updateValidation = [
    check('isComplete').isBoolean(),
    check('name').not().isEmpty(),
    check('ocupation').not().isEmpty(),
    check('_id').not().isEmpty(),
];

export default TaskModel
