import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import Group from '../entities/group.entity';
import SearchDto from '../../shared/dto/search.dto';
import { GroupSearchDto } from '../dto/group-search.dto';
import { FindConditions } from 'typeorm/find-options/FindConditions';
import { hasValue } from '../../utils/basicHelpers';
import GroupListDto from '../dto/group-list.dto';
import CreateGroupDto from '../dto/create-group.dto';
import UpdateGroupDto from '../dto/update-group.dto';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private readonly repository: Repository<Group>,
  ) {
  }

  async findAll(req: SearchDto): Promise<GroupListDto[]> {
    const data = await this.repository.find({
      relations: ['category', 'parent'],
      skip: req.skip,
      take: req.limit,
    });
    return data.map(this.toListView);
  }

  toListView(group: Group): GroupListDto {
    const { parent, category, id, categoryId, name, details, parentId, privacy } = group;
    return {
      id, categoryId, name, details, parentId, privacy,
      category: { name: category.name, id: category.id },
      parent: parent ? { name: parent.name, id: parent.id } : null,
    };
  }

  async combo(req: GroupSearchDto): Promise<Group[]> {
    const findOps: FindConditions<Group> = {};
    if (hasValue(req.categories)) {
      findOps.categoryId = In(req.categories);
    }
    if (hasValue(req.query)) {
      findOps.name = Like(`%${req.query}%`);
    }
    return await this.repository.find({
      select: ['id', 'name', 'categoryId'],
      where: findOps,
      skip: req.skip,
      take: req.limit,
      cache: true,
    });
  }

  async create(data: CreateGroupDto): Promise<GroupListDto> {
    const group: Group = {
      id: 0, ...data,
      children: [],
      members: [],
    };
    const created = await this.repository.save(group);
    return this.findOne(created.id);
  }

  async findOne(id: number): Promise<GroupListDto> {
    const data = await this.repository.findOne(id, {
      relations: ['category', 'parent'],
    });
    return this.toListView(data);
  }

  async update(dto: UpdateGroupDto): Promise<GroupListDto> {
    Logger.log(`Updating groupID:${dto.id}`);
    const result = await this.repository
      .createQueryBuilder()
      .update(Group)
      .set({
        name: dto.name,
        parentId: dto.parentId,
        details: dto.details,
        privacy: dto.privacy,
        categoryId: dto.categoryId,
        placeId: dto.placeId,
        latLon: dto.latLon,
        freeForm: dto.freeForm,
      })
      .where('id = :id', { id: dto.id })
      .execute();
    Logger.log(`Update complete groupID:${dto.id} result:${JSON.stringify(result)}`);
    return await this.findOne(dto.id);
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
