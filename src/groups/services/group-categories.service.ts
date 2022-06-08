import { Injectable, Inject } from '@nestjs/common';
import { Repository, Connection } from 'typeorm';
import SearchDto from '../../shared/dto/search.dto';
import GroupCategory from '../entities/groupCategory.entity';

@Injectable()
export class GroupCategoriesService {
  private readonly repository: Repository<GroupCategory>;
  constructor(@Inject('CONNECTION') connection: Connection) {
    this.repository = connection.getRepository(GroupCategory);
  }

  async findAll(req: SearchDto): Promise<GroupCategory[]> {
    return await this.repository.find({
      skip: req.skip,
      take: req.limit,
    });
  }

  async create(data: GroupCategory): Promise<GroupCategory> {
    return await this.repository.save(data);
  }

  async findOne(id: number): Promise<GroupCategory> {
    return await this.repository.findOne(id);
  }

  async update(data: GroupCategory): Promise<GroupCategory> {
    return await this.repository.save(data);
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async exits(name: string): Promise<boolean> {
    const count = await this.repository.count({ where: { id: name } });
    return count > 0;
  }
}
