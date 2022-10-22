import { Injectable, Inject } from "@nestjs/common";
import GroupEvent from "src/events/entities/event.entity";
import { Connection, Repository, FindConditions } from "typeorm";
import { UserDto } from "src/auth/dto/user.dto";
import { EventCategories } from "src/events/enums/EventCategories";

@Injectable()
export class ReportsService {
  private readonly repository: Repository<GroupEvent>;

  constructor(@Inject("CONNECTION") connection: Connection) {
    this.repository = connection.getRepository(GroupEvent);
  }

  async getReport(name: string, user: UserDto): Promise<any> {
    const filter: FindConditions<GroupEvent> = {};
    let metadataKey: string = "";
    switch (name) {
      case "service-attendance":
        filter.categoryId = EventCategories.Garage;
        metadataKey = "numberOfAdults";
        break;
      case "small-group-attendance":
        filter.categoryId = EventCategories.MC;
        metadataKey = "numberOfGuests";
        break;
      default:
      // Nothing to see here
    }
    let reportResponse = {
      metadata: {
        name: name,
        columns: [],
      },
      data: [],
      summaryStatistics: [],
    };
    const dbReports = await this.repository.find({
      select: ["name", "categoryId", "metaData", "id", "startDate"],
      relations: ["category", "group", "group.members", "attendance"],
      where: filter,
    });
    // Service Attendance report info
    reportResponse.metadata.columns.push({
      name: "location",
      label: "Location",
    });
    reportResponse.summaryStatistics.push({
      location: { value: "", details: {} },
    });

    let dateReportTotals = {};
    let locationIndices = {}; // Save indices of locations in report.data
    let reportDateArray = []; // Tracks which dates we've added to the columns array
    dbReports.forEach(function (report, currentLocationIndex) {
      let reportDateLabel: string = report.startDate
        .toISOString()
        .split("T")[0];
      let reportDate: string = report.startDate
        .toDateString()
        .replace(/ /g, ""); // Remove hyphens
      let locationName: string = report.group.name;
      let rowData = {};

      if (!reportDateArray.includes(reportDate)) {
        reportResponse.metadata.columns.push({
          name: reportDate,
          label: reportDateLabel,
        });
        reportDateArray.push(reportDate);
      }

      if (!locationIndices.hasOwnProperty(locationName)) {
        // We have no prior data on this location
        locationIndices[locationName] = currentLocationIndex;
        rowData = {
          location: locationName,
          [reportDate]: report.metaData[metadataKey],
          average: report.metaData[metadataKey],
        };
        reportResponse.data.push(rowData);
      } else {
        // We have previous data on this location. Update it.
        reportResponse.data[locationIndices[locationName]][reportDate] =
          report.metaData[metadataKey];
        let numberOfDateEntries: number =
          Object.keys(reportResponse.data[locationIndices[locationName]])
            .length - 2;
        let locationAverage: number =
          (reportResponse.data[locationIndices[locationName]].average +=
            report.metaData[metadataKey]) / numberOfDateEntries;
        reportResponse.data[
          locationIndices[locationName]
        ].average = locationAverage;
      }
      dateReportTotals[reportDate] = dateReportTotals.hasOwnProperty(reportDate)
        ? (dateReportTotals[reportDate] += report.metaData[metadataKey])
        : report.metaData[metadataKey];
    });
    reportResponse.metadata.columns.push({
      name: "average",
      label: "Average",
    });
    for (const [reportDate, dateTotal] of Object.entries(dateReportTotals)) {
      reportResponse.summaryStatistics.push({
        [reportDate]: { value: dateTotal, details: {} },
      });
    }
    return reportResponse;
  }
}
