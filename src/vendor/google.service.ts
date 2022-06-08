import { HttpService, Injectable, Logger } from '@nestjs/common';
import GooglePlaceDto from './google-place.dto';
import ClientFriendlyException from '../shared/exceptions/client-friendly.exception';

@Injectable()
export class GoogleService {
  constructor(private httpService: HttpService) {}

  async getPlaceDetails(placeId: string): Promise<GooglePlaceDto> {
    const url = process.env.MAPS_URL;
    const key = process.env.MAPS_KEY;

    Logger.log(`Google.PlaceDetails placeId: ${placeId} start request`);
    const data = await this.httpService
      .get(`${url}`, {
        params: {
          key,
          ['place_id']: placeId,
        },
      })
      .toPromise();
    const response = data.data;
    if (response.status !== 'OK')
      throw new ClientFriendlyException(response['error_message']);
    Logger.log(`Google.PlaceDetails placeId: ${placeId} got response`);
    const {
      geometry: { location },
      name,
      formatted_address: addressParts,
      vicinity,
    } = response.result;

    const parts = addressParts
      .split(',')
      .map((it) => it.trim())
      .reverse();

    const [country, ...rest] = parts;
    return {
      placeId,
      latitude: location.lat,
      longitude: location.lng,
      name,
      vicinity,
      country,
      district: rest.join(', '),
    };
  }
}
