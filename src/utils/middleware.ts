import {validationResult} from "express-validator";
import {Request, Response, NextFunction} from "express";
import passport from "passport"
import {handleError} from "./routerHelpers";

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
                req.user = user
                next()
            }
        }
    )(req, res, next);
}

export const handleErrors = function (error: any, req: Request, res: Response, next: NextFunction) {
    console.error('Global error')
    if (error) {
        handleError(error, res)
    }
}

