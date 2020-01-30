import {check} from "express-validator";

export const createUserRules = [
    check("username", "username cannot be blank").not().isEmpty(),
    check("contact", "User must be attached to a contact").not().isEmpty(),
    check("password", "Password cannot be blank").not().isEmpty(),
    check("group", "User must be in a group").not().isEmpty()
];

export const editUserRules = [
    check("id", "Id is required").not().isEmpty(),
    check("group", "User must be attached to a contact").not().isEmpty()
];
