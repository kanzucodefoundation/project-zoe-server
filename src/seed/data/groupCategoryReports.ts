import { groupConstants } from "./groups";
import { GroupCategoryReportFrequency } from "src/groups/enums/groupCategoryReportFrequency ";
import CrGroupCatReportDto from "src/groups/dto/create-group-category-report.dto";
import { EventCategories } from "src/events/enums/EventCategories";

const seedGrReportCategory: CrGroupCatReportDto[] = [];

function seedGroupReportCategories(): CrGroupCatReportDto[] {
  for (const group in groupConstants) {
    for (const freq in GroupCategoryReportFrequency) {
      if (
        freq === GroupCategoryReportFrequency.Weekly &&
        groupConstants[group] === groupConstants.mc
      ) {
        seedGrReportCategory.push({
          groupCategoryId: groupConstants.mc,
          eventCategoryId: EventCategories.MC,
          frequency: freq,
        });
        seedGrReportCategory.push({
          groupCategoryId: groupConstants.mc,
          eventCategoryId: EventCategories.Garage,
          frequency: freq,
        });
        seedGrReportCategory.push({
          groupCategoryId: groupConstants.mc,
          eventCategoryId: EventCategories.Evangelism,
          frequency: freq,
        });
      }
      if (
        freq === GroupCategoryReportFrequency.Monthly &&
        groupConstants[group] === groupConstants.mc
      ) {
        seedGrReportCategory.push({
          groupCategoryId: groupConstants.mc,
          eventCategoryId: EventCategories.Wedding,
          frequency: freq,
        });
        seedGrReportCategory.push({
          groupCategoryId: groupConstants.mc,
          eventCategoryId: EventCategories.Baptism,
          frequency: freq,
        });
        seedGrReportCategory.push({
          groupCategoryId: groupConstants.mc,
          eventCategoryId: EventCategories.Frontier,
          frequency: freq,
        });
      }
    }
    if (groupConstants.location === "Location") {
      for (const freq in GroupCategoryReportFrequency) {
        if (
          freq === GroupCategoryReportFrequency.Weekly &&
          groupConstants[group] === groupConstants.location
        ) {
          seedGrReportCategory.push({
            groupCategoryId: groupConstants.location,
            eventCategoryId: EventCategories.MC,
            frequency: freq,
          });
          seedGrReportCategory.push({
            groupCategoryId: groupConstants.location,
            eventCategoryId: EventCategories.Garage,
            frequency: freq,
          });
        }
        if (
          freq === GroupCategoryReportFrequency.Monthly &&
          groupConstants[group] === groupConstants.location
        ) {
          seedGrReportCategory.push({
            groupCategoryId: groupConstants.location,
            eventCategoryId: EventCategories.Wedding,
            frequency: freq,
          });
          seedGrReportCategory.push({
            groupCategoryId: groupConstants.location,
            eventCategoryId: EventCategories.Baptism,
            frequency: freq,
          });
          seedGrReportCategory.push({
            groupCategoryId: groupConstants.location,
            eventCategoryId: EventCategories.Frontier,
            frequency: freq,
          });
        }
      }
    }
  }
  return seedGrReportCategory;
}

export default seedGroupReportCategories();
