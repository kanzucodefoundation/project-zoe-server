import { isArray as _isArray, isEmpty, isInteger, isNumber } from 'lodash';

export const hasValue = (text: any) => {
  return !hasNoValue(text);
};

export const hasNoValue = (text: any) => {
  if (isNumber(text)) return false;
  return isEmpty(text);
};

export const isValidNumber = (data: any) => {
  return isNumber(data) && isInteger(data) && parseInt(`${data}`) > 0;
};

export const isArray = (data: any) => {
  return _isArray(data);
};

export function getArray(data: any) {
  return Array.isArray(data) ? data : [data]; 
} 

export function removeDuplicates(data: any) {
  var result = [];
  data.forEach((i) => {
    if(result.indexOf(i) < 0) {
      result.push(i)
    }
  })
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PasswordValidator = require('password-validator');

const schema = new PasswordValidator();
schema
  .is()
  .min(8) // Minimum length 8
  .is()
  .max(20) // Maximum length 20
  .has()
  .uppercase() // Must have uppercase letters
  .has()
  .lowercase() // Must have lowercase letters
  .has()
  .digits() // Must have digits
  .has()
  .not()
  .spaces() // Should not have spaces
  .is()
  .not()
  .oneOf(['Passw0rd', 'Password123', 'password']); // Blacklist these values

export function isValidPassword(pass: string): boolean {
  return !!schema.validate(pass);
}
