import {hasValue} from "./validation";
import {isDupError} from "./errorHelpers";

export const handleError = (error: any, res: any,) => {
    console.log("Global Error", error)
    let message = 'Oops, unknown error, please contact admin'
    if (typeof error === 'string') {
        message = error
    }else if (isDupError(error)) {
        res.status(400)
            .json({message: 'Duplicate record'});
        return
    } else if (hasValue(error.message)) {
        message = error.message
    }
    res.status(500)
        .json({message});
}
