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
