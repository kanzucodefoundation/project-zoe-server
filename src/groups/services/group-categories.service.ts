import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import SearchDto from '../../shared/dto/search.dto';
import GroupCategory from '../entities/groupCategory.entity';
import CreateGroupCategoryDto from '../dto/create-group-category.dto';

@Injectable()
export class GroupCategoriesService {
  constructor(
    @InjectRepository(GroupCategory)
    private readonly repository: Repository<GroupCategory>,
  ) {}

  async findAll(req: SearchDto): Promise<GroupCategory[]> {
    return await this.repository.find({
      skip:req.skip,
      take:req.limit
    });
  }



  async create(data: CreateGroupCategoryDto): Promise<GroupCategory> {
    return await this.repository.save(data);
  }

  async findOne(id: number): Promise<GroupCategory> {
    return await this.repository.findOne(id);
  }

  async update(data: GroupCategory): Promise<GroupCategory> {
    return await this.repository.save(data);
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  async exits(name: string): Promise<boolean> {
    const count = await this.repository.count({ where: { name } });
    return count > 0;
  }
}
