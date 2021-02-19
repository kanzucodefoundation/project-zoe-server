/* eslint-disable @typescript-eslint/no-inferrable-types */

import { IsNumber } from 'class-validator';

export default class SearchDto {
  query?: string;
  @IsNumber({}, { each: true })
  limit: number = 100;
  @IsNumber({}, { each: true })
  skip: number = 0;
}
