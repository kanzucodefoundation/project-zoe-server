import {hasValue} from "./validation";
import {NextFunction, Request, Response} from "express";
import logger from "./logging/logger";


const isDupError = (error: any) => {
    return !!error && (error.name === "MongoError" || error.code === 11000);
};

const isBadRequest = (error: any) => {
    return !!error && (error.name === "BadRequest" || error.code === 400);
};

export const badRequest = (msg: string) => {
    return {
        message: msg,
        name: "BadRequest",
        code: 400
    };
};

export const errorMiddleware = function (error: any, req: Request, res: Response, next: NextFunction) {
    logger.log("Global error", error);
    if (error) {
        handleError(error, res);
    }
    next();
};

export const handleError = (error: any, res: any,) => {
    logger.error("handling error", error);
    let message = "Oops, unknown error, please contact admin";
    if (typeof error === "string") {
        message = error;
    }else if (isBadRequest(error)) {
        res.status(400)
            .json({message: error.message});
        return;
    } else if (isDupError(error)) {
        res.status(400)
            .json({message: "Duplicate record"});
        return;
    } else if (hasValue(error.message)) {
        message = error.message;
    }
    res.status(500)
        .json({message});
};


