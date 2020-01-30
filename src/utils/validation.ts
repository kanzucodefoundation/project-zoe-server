import PasswordValidator from 'password-validator'
import {parseNumber} from "./numberHelpers";

const schema = new PasswordValidator();
schema
    .is().min(6)                                    // Minimum length 8
    .is().max(20)                                  // Maximum length 20
    .has().uppercase()                              // Must have uppercase letters
    .has().lowercase()                              // Must have lowercase letters
    .has().digits()                                 // Must have digits
    .has().not().spaces()                           // Should not have spaces
    .is().not().oneOf(['Passw0rd', 'Password123', 'password']); // Blacklist these values


export function hasValue(dt: any) {
    if (typeof dt === "string")
        return !!dt && `${dt}`.trim().length > 0
    if (typeof dt === "number") {
        const n = parseInt(`${dt}`)
        return !isNaN(n)
    }
}

export function arrayHasValues(dt?: any[]) {
    return dt && dt.length > 0
}


export function isValidPassword(pass: string): boolean {
    return !!schema.validate(pass)
}



