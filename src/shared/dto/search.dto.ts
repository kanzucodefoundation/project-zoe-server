/* eslint-disable @typescript-eslint/no-inferrable-types */

export default class SearchDto {
  query?: string;
  limit: number = 100;
  skip: number = 0;
  category?: string;
}
