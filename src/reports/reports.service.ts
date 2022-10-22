import { Injectable, Inject } from "@nestjs/common";
import GroupEvent from "src/events/entities/event.entity";
import { Connection, Repository, FindConditions } from "typeorm";
import { UserDto } from "src/auth/dto/user.dto";
import { EventCategories } from "src/events/enums/EventCategories";
import { lowerCaseRemoveSpaces } from "src/utils/stringHelpers";

@Injectable()
export class ReportsService {
  private readonly repository: Repository<GroupEvent>;

  constructor(@Inject("CONNECTION") connection: Connection) {
    this.repository = connection.getRepository(GroupEvent);
  }

  async getReport(name: string, user: UserDto): Promise<any> {
    const filter: FindConditions<GroupEvent> = {};
    switch (name) {
      case "service-attendance":
        filter.categoryId = EventCategories.Garage;
        break;
      default:
      // Nothing to see here
    }
    let reportResponse = {
      metaData: {
        name: name,
        columns: [],
      },
      data: [],
    };
    const dbReports = await this.repository.find({
      select: ["name", "categoryId", "metaData", "id", "startDate"],
      relations: ["category", "group", "group.members", "attendance"],
      where: filter,
    });
    // Service Attendance report info
    reportResponse.metaData.columns.push({
      name: "location",
      label: "Location",
    });
    for (const report of dbReports) {
      let reportDateLabel = report.startDate.toISOString().split("T")[0];
      let reportDate = reportDateLabel.replace(/-/g, ""); // Remove hyphens
      let rowData = {
        location: report.group.name,
        [reportDate]: report.metaData.numberOfAdults,
      };
      reportResponse.data.push(rowData);
      reportResponse.metaData.columns.push({
        name: reportDate,
        label: reportDateLabel,
      });
    }
    return reportResponse;
  }
}
