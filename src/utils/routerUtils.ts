import {hasValue} from "./validation";
import {isDupError} from "./dbUtils";


export const handleError = (error: any, res: any,) => {
    console.log(error)
    let message = 'Oops, unknown error, please contact admin'
    if (typeof error === 'string') {
        message = error
    } else if (hasValue(error.message)) {
        message = error.message
    } else if (isDupError(error)) {
        res.status(400)
            .json({message: 'Duplicate record'});
        return
    }
    res.status(500)
        .json({message});
}
