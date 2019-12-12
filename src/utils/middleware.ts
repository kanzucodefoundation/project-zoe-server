import {validationResult} from "express-validator";
import {Request, Response, NextFunction} from "express";
import passport from "passport"

export const validate = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req)
    if (errors.isEmpty()) {
        return next()
    }
    const extractedErrors: any[] = []
    errors.array().map(err => extractedErrors.push({[err.param]: err.msg}))
    return res.status(400).json({
        message: 'Data validation failed',
        errors: extractedErrors,
    })
}

export const authorize = function (req: Request, res: Response, next: NextFunction) {
    passport.authenticate(
        'jwt',
        {session: false},
        function (error, user, info) {
            if (error) {
                res.status(401).json({message: error});
            } else if (!user) {
                res.status(401).send({message: 'invalid user', info});
            } else {
                next();
            }
        }
    )(req, res);
}
