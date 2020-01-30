import {hasValue} from "./validation";

export const parseNumber = (str: any): number | null => {
    const value = `${str}`
    if (hasValue(value)) {
        const v = parseInt(value)
        return isNaN(v) ? null : v
    }
    return null
}
