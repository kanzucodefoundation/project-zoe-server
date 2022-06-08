import {
  Controller,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { GoogleService } from './google.service';
import GooglePlaceDto from './google-place.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags('Vendors')
@Controller('vendor')
export class VendorController {
  constructor(private googleService: GoogleService) {}

  @Get('place-details/:placeId')
  async findOne(@Param('placeId') placeId: string): Promise<GooglePlaceDto> {
    return await this.googleService.getPlaceDetails(placeId);
  }
}
