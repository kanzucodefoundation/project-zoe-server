import {check} from "express-validator";

export const userGroupRules = [
    check("name", "Name cannot be blank").not().isEmpty(),
    check("details", "User must be attached to a contact").not().isEmpty(),
    check("roles", "Groups require roles").isArray({min: 1})
];
