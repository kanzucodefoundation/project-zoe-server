import { hasValue } from './validation';

export interface Point {
  x: number;
  y: number;
}

export const stringToPoint = (str: string): Point | undefined => {
  if (hasValue(str)) {
    const parts = str.split(',');
    if (parts.length === 2)
      return {
        x: parseFloat(parts[0]),
        y: parseFloat(parts[1]),
      };
  }
};
