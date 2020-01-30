import jwt from 'jsonwebtoken'

export const jwtConstants = {
    secret: 'zNh3JJdxfwVuZU7w3M8GCfqsXVvWm8xWRhRsG8xr'
};
const JWT_EXPIRATION_MS = 1000 * 60 * 60 * 24
export const createJWT = (payload: any) => {
    return jwt.sign(
        JSON.stringify({
            ...payload,
            expires: Date.now() + JWT_EXPIRATION_MS,
        }),
        jwtConstants.secret, {});
}

export const appRoles = {
    roleCrmView: "CRM_VIEW",
    roleCrmEdit: "CRM_EDIT",

    roleAuthUserView: "AUTH_USER_VIEW",
    roleAuthUserEdit: "AUTH_USER_EDIT",

    roleAuthGroupView: "AUTH_GROUP_VIEW",
    roleAuthGroupEdit: "AUTH_GROUP_EDIT",

    roleTagView: "AUTH_TAG_VIEW",
    roleTagEdit: "AUTH_TAG_EDIT",

    roleGroupView: "GROUP_VIEW",
    roleGroupEdit: "GROUP_EDIT",
}
