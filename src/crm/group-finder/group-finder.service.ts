import { Injectable, Inject } from "@nestjs/common";
import Group from "../../groups/entities/group.entity";
import { In, Repository, Connection, TreeRepository } from "typeorm";
import {
  GetClosestGroupDto,
  GetMissingReportDto,
} from "../../groups/dto/membershipRequest/new-request.dto";
import { groupConstants } from "../../seed/data/groups";
import GroupCategoryReport from "../../groups/entities/groupCategoryReport.entity";

@Injectable()
export class GroupFinderService {
  private readonly groupRepository: TreeRepository<Group>;
  private readonly categoryReportRepository: Repository<GroupCategoryReport>;

  constructor(@Inject("CONNECTION") connection: Connection) {
    this.groupRepository = connection.getTreeRepository(Group);
    this.categoryReportRepository = connection.getRepository(
      GroupCategoryReport,
    );
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

  public async findMissingReports(data: GetMissingReportDto): Promise<any[]> {
    const parentGroup = await this.groupRepository.findOne({
      where: { id: data.parentGroupId },
    });
    const childGroups = await this.groupRepository.findDescendants(parentGroup);
    const ids = childGroups.map((it) => it.id);
    const reportCategories = await this.categoryReportRepository.find({
      where: {
        groupCategoryId: In(ids),
      },
    });

    const expected = [];
    for (const reportCategory of reportCategories) {
      for (const childGroup of childGroups) {
        expected.push({ reportId: reportCategory.id, groupId: childGroup.id });
      }
    }

    //find reports

    return childGroups;
  }
}
