import { Body, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Phone from './entities/phone.entity';
import { Repository } from 'typeorm';
import { PhoneDto } from './dto/phone.dto';
import SearchDto from 'src/shared/dto/search.dto';

@Injectable()
export class PhonesService {
  constructor(
    @InjectRepository(Phone) private readonly repository: Repository<Phone>,
  ) {}

  async findAll(req: SearchDto): Promise<Phone[]> {
    return await this.repository.find({
      skip: req.skip,
      take: req.limit,
    });
  }

  async create(@Body() data: PhoneDto): Promise<Phone[]> {
    const getIsPrimary = await this.repository.find({
      where: [{ contactId: data.contactId, isPrimary: true }],
    });

    if (data.isPrimary === true) {
      if (getIsPrimary.length > 0) {
        await getIsPrimary.map((it) => {
          const phones = { ...it, isPrimary: false };
          this.repository.save(phones);
        });
      }
    } else {
      if (getIsPrimary.length < 1) {
        data.isPrimary = true;
      } else if (getIsPrimary.length > 1) {
        await getIsPrimary.map((it) => {
          const phones = { ...it, isPrimary: false };
          data.isPrimary = true;
          this.repository.save(phones);
        });
      }
    }
    await this.repository.save(data);

    const getCurrentPhones = await this.repository.find({
      where: [{ contactId: data.contactId }],
    });
    return getCurrentPhones;
  }

  async update(data): Promise<Phone> {
    return await this.repository.save(data);
  }

  async findOne(id: number): Promise<Phone> {
    return await this.repository.findOne(id);
  }

  async remove(id: number):Promise<void> {
    await this.repository.delete(id);
  }
}
