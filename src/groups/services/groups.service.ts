import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import Group from '../entities/group.entity';
import SearchDto from '../../shared/dto/search.dto';
import CreateGroupDto from '../dto/create-group.dto';
import { GroupSearchDto } from '../dto/group-search.dto';
import { FindConditions } from 'typeorm/find-options/FindConditions';
import { hasValue } from '../../utils/basicHelpers';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private readonly repository: Repository<Group>,
  ) {
  }

  async findAll(req: SearchDto): Promise<Group[]> {
    return await this.repository.find({
      skip: req.skip,
      take: req.limit,
    });
  }

  async combo(req: GroupSearchDto): Promise<Group[]> {
    const findOps: FindConditions<Group> = {};
    if (hasValue(req.categories)) {
      findOps.categoryId = In(req.categories);
    }
    return await this.repository.find({
      select: ['id', 'name','categoryId'],
      where: findOps,
      skip: req.skip,
      take: req.limit,
    });
  }

  async create(data: CreateGroupDto): Promise<Group> {
    return await this.repository.save(data);
  }

  async findOne(id: number): Promise<Group> {
    return await this.repository.findOne(id);
  }

  async update(data: Group): Promise<Group> {
    return await this.repository.save(data);
  }

  async remove(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  async exits(name: string): Promise<boolean> {
    const count = await this.repository.count({ where: { name } });
    return count > 0;
  }

  async count(): Promise<number> {
    return await this.repository.count();
  }
}
