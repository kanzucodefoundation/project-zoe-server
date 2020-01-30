import {check} from "express-validator";

export const createGroupRules = [
    check("name", "name is required").not().isEmpty(),
    check("category", "category is required").not().isEmpty(),
    check("privacy", "privacy is required").not().isEmpty()
];

export const editGroupRules = [
    check("id", "id is required").not().isEmpty(),
    ...createGroupRules
];

export const createGroupCategoryRules = [
    check("name", "group is required").not().isEmpty(),
    check("details", "contact is required").not().isEmpty()
];

export const editGroupCategoryRules = [
    check("id", "id is required").not().isEmpty(),
    ...createGroupCategoryRules
];


export const createMemberRules = [
    check("group", "group is required").not().isEmpty(),
    check("contact", "contact is required").not().isEmpty(),
    check("role", "role is required").not().isEmpty()
];

export const editMemberRules = [
    check("id", "id is required").not().isEmpty(),
    ...createMemberRules
];
