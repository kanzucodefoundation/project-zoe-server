import { isEmpty, isArray as _isArray, isNumber, isInteger } from 'lodash';

export const hasValue = (data: any) => {
  return !isEmpty(data);
};

export const hasNoValue = (data: any) => {
  return isEmpty(data);
};

export const isValidNumber = (data: any) => {
  return isNumber(data) && isInteger(data) && parseInt(`${data}`) > 0;
};

export const isArray = (data: any) => {
  return _isArray(data);
};

