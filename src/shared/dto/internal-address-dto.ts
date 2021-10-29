import { Point } from '../../utils/locationHelpers';
import { IsNotEmpty } from 'class-validator';

export default class InternalAddressDto {
  @IsNotEmpty()
  country: string;

  district: string;

  @IsNotEmpty()
  placeId: string;

  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  latitude: number;

  longitude: number;

  vicinity: string;

  geoCoordinates?: Point | string;
}
