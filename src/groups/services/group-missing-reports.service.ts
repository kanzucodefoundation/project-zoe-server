import { Injectable, Inject } from "@nestjs/common";
import {
  addDays,
  differenceInDays,
  eachDayOfInterval,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from "date-fns";
import {
  FindConditions,
  ILike,
  In,
  LessThanOrEqual,
  Connection,
  MoreThanOrEqual,
  Repository,
  TreeRepository,
} from "typeorm";
import { GetMissingReportDto } from "../dto/group-missing-report.dto";
import Group from "../entities/group.entity";
import GroupCategoryReport from "../entities/groupCategoryReport.entity";
import GroupMembership from "../entities/groupMembership.entity";
import { getArray, hasValue } from "src/utils/validation";
import GroupEvent from "src/events/entities/event.entity";
import { GroupCategoryReportFrequency } from "../enums/groupCategoryReportFrequency ";
import { GroupSearchDto } from "../dto/group-search.dto";
import { GroupMissingReportSearchDto } from "../dto/group-missing-report-search.dto";
import { groupConstants } from "../../seed/data/groups";
import { EventFrequencyDto } from "../dto/event-frequency-search.dto";

@Injectable()
export class GroupMissingReportsService {
  private readonly groupRepository: TreeRepository<Group>;
  private readonly categoryReportRepository: Repository<GroupCategoryReport>;
  private readonly groupMemberRepository: Repository<GroupMembership>;
  private readonly groupEventRepository: Repository<GroupEvent>;

  constructor(@Inject("CONNECTION") connection: Connection) {
    this.groupRepository = connection.getTreeRepository(Group);
    this.categoryReportRepository = connection.getRepository(
      GroupCategoryReport,
    );
    this.groupMemberRepository = connection.getRepository(GroupMembership);
    this.groupEventRepository = connection.getRepository(GroupEvent);
  }

  async findMissingReports(
    searchDto: GroupMissingReportSearchDto,
  ): Promise<any[]> {
    ///Filter
    const eFilter: FindConditions<GroupEvent> = {};
    const groupFilter: FindConditions<Group> = {};
    const reportFilter: FindConditions<GroupCategoryReport> = {};
    // TODO use user object to filter reports
    if (hasValue(searchDto.categoryIdList))
      groupFilter.categoryId = In(getArray(searchDto.categoryIdList));

    if (hasValue(searchDto.reportFreqList))
      reportFilter.frequency = In(getArray(searchDto.reportFreqList));

    if (hasValue(searchDto.query)) {
      groupFilter.name = ILike(`%${searchDto.query.trim().toLowerCase()}%`);
    }

    // Find group category reports by week

    if (hasValue(searchDto.from) && hasValue(searchDto.to)) {
      // Only add 1 day to 'searchDto.to' since it is an endDate. This will cater for events as expected
      const from = searchDto.from;
      const to = addDays(new Date(searchDto.to), 1);
      //Calculate Days
      const days = differenceInDays(new Date(to), new Date(from));
      // Event filter Dates
      eFilter.startDate = MoreThanOrEqual(from);
      eFilter.endDate = LessThanOrEqual(to);

      let reportRange: GroupCategoryReportFrequency =
        GroupCategoryReportFrequency.Weekly;
      if (hasValue(searchDto.reportFreqList)) {
        const [range] = getArray(searchDto.reportFreqList);
        reportRange = range;
      }

      const intervalStartDates = this.getIntervalStartDates(
        searchDto,
        reportRange,
      );

      //// Load the groups and events relations
      const allGroups = await this.groupRepository.find({
        relations: ["category", "events"],
        where: groupFilter,
      });

      //// Get all report categories
      const reportCategories = await this.categoryReportRepository.find({
        where: reportFilter,
      });

      ////Get all group Leaders
      const groupLeaders = await this.groupMemberRepository.find({
        relations: ["contact", "contact.person"],
        where: { role: "Leader" },
      });

      /// Generate list of expected reports
      const groupArray: GetMissingReportDto[] = [];
      const reportResults: GetMissingReportDto[] = [];
      const reportTemplate: GetMissingReportDto[] = this.generateReportTemplates(
        intervalStartDates,
        reportCategories,
        allGroups,
        groupLeaders,
        reportRange,
      );

      ///// Get the group Events
      const groupEvents = await this.groupEventRepository.find({
        relations: ["group"],
        where: eFilter,
      });
      /// Loop through expected reports
      for (const exp of reportTemplate) {
        let eventExist = false;
        for (const event of groupEvents) {
          const eventStartDate = startOfWeek(new Date(event.startDate), {
            weekStartsOn: 0,
          }).toDateString();
          if (
            eventStartDate === exp.week &&
            event.group.categoryId === exp.groupCategory &&
            event.categoryId === exp.eventCategory &&
            event.group.name === exp.group.name
          ) {
            eventExist = true;
          }
        }
        if (eventExist === false) {
          reportResults.push({
            ...exp,
            info: `Missing ${exp.reportType} ${exp.eventCategory} report.`,
          });
          eventExist = false;
        }
      }
      return this.addId(reportResults);
    }
    return this.addId([]);
  }

  getIntervalStartDates(
    searchDto: GroupMissingReportSearchDto,
    reportRange: GroupCategoryReportFrequency,
  ) {
    /// Get weeks from dates entered by user
    const rawIntervals = eachDayOfInterval({
      start: new Date(searchDto.from),
      end: new Date(searchDto.to),
    }).map((it) => {
      if (reportRange === GroupCategoryReportFrequency.Weekly) {
        return startOfWeek(new Date(it), { weekStartsOn: 0 }).toDateString();
      }

      if (reportRange === GroupCategoryReportFrequency.Monthly) {
        return startOfMonth(new Date(it)).toDateString();
      }

      if (reportRange === GroupCategoryReportFrequency.Quarterly) {
        return startOfQuarter(new Date(it)).toDateString();
      }

      if (reportRange === GroupCategoryReportFrequency.Annually) {
        return startOfYear(new Date(it)).toDateString();
      }
    });

    return [...new Set(rawIntervals)];
  }

  async addId(data: GetMissingReportDto[]): Promise<any[]> {
    const finalReport = data.map((it, index) => ({ ...it, id: index }));
    return finalReport;
  }

  async getReportFreq(req: GroupSearchDto): Promise<any[]> {
    const repFreq = [];
    for (const freq in GroupCategoryReportFrequency) {
      repFreq.push({
        id: GroupCategoryReportFrequency[freq],
        name: GroupCategoryReportFrequency[freq],
      });
    }
    return repFreq;
  }

  generateReportTemplates(
    weekArray: any[],
    reportCategories: any[],
    allGroups: any[],
    groupLeaders: any[],
    reportRange: GroupCategoryReportFrequency,
  ) {
    /// Generate list of expected reports
    const reportTemplate: GetMissingReportDto[] = [];
    for (const wk of weekArray) {
      for (const rep of reportCategories) {
        for (const group of allGroups) {
          let myLeader = "No Group Leader";
          groupLeaders.map(
            (it) =>
              it.groupId === group.id &&
              (myLeader = `${it.contact.person.firstName} ${
                it.contact.person.middleName && it.contact.person.middleName
              } ${it.contact.person.lastName}`.replace(/\s+/g, " ")),
          );
          if (
            group.categoryId === rep.groupCategoryId &&
            rep.frequency === reportRange
          ) {
            reportTemplate.push({
              week: wk,
              groupCategory: group.categoryId,
              eventCategory: rep.eventCategoryId,
              reportType: rep.frequency,
              group: {
                id: group.id,
                name: group.name,
                category: group.categoryId,
              },
              groupLeader: myLeader,
            });
          }
        }
      }
    }

    return reportTemplate;
  }

  async combo(req: GroupSearchDto): Promise<any[]> {
    const groupCombo = [];
    for (const cat in groupConstants) {
      groupCombo.push({
        id: groupConstants[cat],
        name: groupConstants[cat],
      });
    }

    return groupCombo;
  }

  async getFrequencyByCategory(
    req: EventFrequencyDto,
  ): Promise<GroupCategoryReport[]> {
    const filter: FindConditions<GroupCategoryReport> = {};

    if (hasValue(req.groupCategory)) {
      filter.groupCategoryId = req.groupCategory;
    }
    if (hasValue(req.eventCategory)) {
      filter.eventCategoryId = req.eventCategory;
    }

    const frequency = await this.categoryReportRepository.find({
      where: filter,
    });
    return frequency;
  }
}
