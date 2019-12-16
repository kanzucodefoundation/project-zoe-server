import {hasValue} from "./validation";


const isDupError = (error: any) => {
    return !!error && (error.name === 'MongoError' || error.code === 11000)
}

const isBadRequest = (error: any) => {
    return !!error && (error.name === 'BadRequest' || error.code === 400)
}

export const badRequest = (msg: string) => {
    return {
        message: msg,
        name: 'BadRequest',
        code: 400
    }
}

export const handleError = (error: any, res: any,) => {
    console.log("Global Error", error)
    let message = 'Oops, unknown error, please contact admin'
    if (typeof error === 'string') {
        message = error
    }else if (isBadRequest(error)) {
        res.status(400)
            .json({message: error.message});
        return
    } else if (isDupError(error)) {
        res.status(400)
            .json({message: 'Duplicate record'});
        return
    } else if (hasValue(error.message)) {
        message = error.message
    }
    res.status(500)
        .json({message});
}


