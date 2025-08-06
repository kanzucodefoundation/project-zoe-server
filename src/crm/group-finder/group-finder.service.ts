import { Injectable, Inject } from "@nestjs/common";
import Group from "../../groups/entities/group.entity";
import { Connection, TreeRepository } from "typeorm";
import { GetClosestGroupDto } from "../../groups/dto/membershipRequest/new-request.dto";
import { groupConstants } from "../../seed/data/groups";

@Injectable()
export class GroupFinderService {
  private readonly groupRepository: TreeRepository<Group>;

  constructor(@Inject("CONNECTION") connection: Connection) {
    this.groupRepository = connection.getTreeRepository(Group);
  }

  public async findClosestGroup(data: GetClosestGroupDto): Promise<any> {
    const parentGroup = await this.groupRepository.findOne({
      where: { id: data.parentGroupId },
    });
    const childGroups = await this.groupRepository
      .createDescendantsQueryBuilder("group", "group_closure", parentGroup)
      .andWhere(`group.category.name = '${groupConstants.mc}'`)
      .getMany();
    return childGroups;
  }
}
