import { isArray as _isArray, isEmpty, isInteger, isNumber } from 'lodash';
import { isDate } from 'date-fns';

export const hasValue = (text: any) => {
  return !hasNoValue(text);
};

export const hasNoValue = (text: any) => {
  if (isDate(text)) return false;
  if (isNumber(text)) return false;
  return isEmpty(text);
};

export const isValidNumber = (data: any) => {
  return isNumber(data) && isInteger(data) && parseInt(`${data}`) > 0;
};

export const isArray = (data: any) => {
  return _isArray(data);
};

export const isEmptyObject = (data: any) => {
  return isEmpty(data);
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
  .has()
  .not()
  .spaces() // Should not have spaces
  .is()
  .not()
  .oneOf(['Passw0rd', 'Password123', 'password']); // Blacklist these values

export function isValidPassword(pass: string): boolean {
  return !!schema.validate(pass);
}
