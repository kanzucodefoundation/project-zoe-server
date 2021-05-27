import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Group from '../../groups/entities/group.entity';
import { TreeRepository } from 'typeorm';
import { GetClosestGroupDto } from '../../groups/dto/membershipRequest/new-request.dto';
import { groupConstants } from '../../seed/data/groups';

@Injectable()
export class GroupFinderService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: TreeRepository<Group>,
  ) {}

  public async findClosestGroup(data: GetClosestGroupDto): Promise<any> {
    const parentGroup = await this.groupRepository.findOne({
      where: { id: data.parentGroupId },
    });
    const childGroups = await this.groupRepository
      .createDescendantsQueryBuilder('group', 'group_closure', parentGroup)
      .andWhere(`group.categoryId = '${groupConstants.mc}'`)
      .getMany();
    return childGroups;
  }
}
