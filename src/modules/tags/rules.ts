import {check} from "express-validator";

export const createTagRules = [
    check("category", "category is required").not().isEmpty(),
    check("name", "name is required").not().isEmpty(),
    check("color", "color is required").not().isEmpty()
];

export const editTagRules = [
    check("id", "Id is required").not().isEmpty(),
    ...createTagRules
];
