import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { GoogleService } from './google.service';
import GooglePlaceDto from './google-place.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';

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
