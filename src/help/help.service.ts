import { Injectable, Logger, Inject } from '@nestjs/common';
import { CreateHelpDto } from './dto/create-help.dto';
import { UpdateHelpDto } from './dto/update-help.dto';
import { Repository, Connection } from 'typeorm';
import Help from './entities/help.entity';
import HelpDto from './dto/help.dto';
import SearchDto from '../shared/dto/search.dto';
import { hasValue, isArray } from '../utils/validation';

@Injectable()
export class HelpService {
  private readonly repository: Repository<Help>;

  constructor(@Inject('CONNECTION') connection: Connection) {
    this.repository = connection.getRepository(Help);
  }

  async create(data: CreateHelpDto): Promise<HelpDto> {
    return this.repository.save(data);
  }

  async findAll(req: SearchDto): Promise<HelpDto[]> {
    const data = await this.repository.find({
      select: ['id', 'title', 'category', 'url'],
    });
    return data;
  }

  async findOne(id: number): Promise<HelpDto> {
    const data = await this.repository.findOne({
      select: ['id', 'title', 'category', 'url'],
    });
    return data;
  }

  async update(data: UpdateHelpDto): Promise<HelpDto> {
    const newFile = await this.repository
      .createQueryBuilder()
      .update(Help)
      .set({
        ...data,
      })
      .where('id = :id', { id: data.id })
      .execute();

    if (newFile.affected)
      Logger.log(
        `Update.Help id:${data.id} affected:${newFile.affected} complete`,
      );

    return await this.repository.findOne({ where: { id: data.id } });
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
