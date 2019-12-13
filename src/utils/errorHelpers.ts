export const isDupError = (error: any) => {
    return !!error && (error.name === 'MongoError' || error.code === 11000)
}
