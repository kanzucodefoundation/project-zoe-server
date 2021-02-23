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

export function hasValue(dt: string) {
  return !!dt && dt.trim().length > 0;
}

export function arrayHasValues(dt?: any[]) {
  return dt && dt.length > 0;
}

export function isValidPassword(pass: string): boolean {
  return !!schema.validate(pass);
}
