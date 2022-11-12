import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import SearchDto from 'src/shared/dto/search.dto';
import { hasValue } from 'src/utils/validation';
import GooglePlaceDto from 'src/vendor/google-place.dto';
import { GoogleService } from 'src/vendor/google.service';
import { Repository } from 'typeorm';
import Address from './entities/address.entity';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address) private readonly repository: Repository<Address>,
    private googleService: GoogleService,
  ) {}

  async create(data: Address): Promise<Address> {
    let place: GooglePlaceDto;
    if (hasValue(data.placeId)) {
      place = await this.googleService.getPlaceDetails(data.placeId);
    }

    const getIsPrimary = await this.repository.find({
      where: [{ contactId: data.contactId, isPrimary: true }],
    });

    if (data.isPrimary === true) {
      if (getIsPrimary.length > 0) {
        await getIsPrimary.map((it) => {
          const addresses = { ...it, isPrimary: false };
          this.repository.save(addresses);
        });
      }
    } else {
      if (getIsPrimary.length < 1) {
        data.isPrimary = true;
      } else if (getIsPrimary.length > 1) {
        await getIsPrimary.map((it) => {
          const addresses = { ...it, isPrimary: false };
          data.isPrimary = true;
          this.repository.save(addresses);
        });
      }
    }
    //Get new Address details
    const newAddress = { ...data, ...place };
    return await this.repository.save(newAddress);
  }

  async findAll(req: SearchDto): Promise<Address[]> {
    return await this.repository.find({
      skip: req.skip,
      take: req.limit,
    });
  }

  async update(data: Address): Promise<Address> {
    return await this.repository.save(data);
  }

  async findOne(id: number): Promise<Address> {
    return await this.repository.findOne(id);
  }

  async delete(id: number) {
    return await this.repository.delete(id);
  }
}
