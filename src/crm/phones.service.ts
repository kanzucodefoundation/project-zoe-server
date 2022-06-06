import { Body, Injectable, Inject } from "@nestjs/common";
import Phone from "./entities/phone.entity";
import { Repository, Connection } from "typeorm";
import { PhoneDto } from "./dto/phone.dto";

@Injectable()
export class PhonesService {
  private readonly repository: Repository<Phone>;

  constructor(@Inject("CONNECTION") connection: Connection) {
    this.repository = connection.getRepository(Phone);
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
}
