import { groupConstants } from './groups';
import { eventsCategories } from './eventCategories';
import { GroupCategoryReportFrequency } from 'src/groups/enums/groupCategoryReportFrequency ';
import CrGroupCatReportDto from 'src/groups/dto/create-group-category-report.dto';

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
          eventCategoryId: eventsCategories.mc,
          frequency: freq,
        });
        seedGrReportCategory.push({
          groupCategoryId: groupConstants.mc,
          eventCategoryId: eventsCategories.garage,
          frequency: freq,
        });
        seedGrReportCategory.push({
          groupCategoryId: groupConstants.mc,
          eventCategoryId: eventsCategories.evangelism,
          frequency: freq,
        });
      }
      if (
        freq === GroupCategoryReportFrequency.Monthly &&
        groupConstants[group] === groupConstants.mc
      ) {
        seedGrReportCategory.push({
          groupCategoryId: groupConstants.mc,
          eventCategoryId: eventsCategories.wedding,
          frequency: freq,
        });
        seedGrReportCategory.push({
          groupCategoryId: groupConstants.mc,
          eventCategoryId: eventsCategories.baptism,
          frequency: freq,
        });
        seedGrReportCategory.push({
          groupCategoryId: groupConstants.mc,
          eventCategoryId: eventsCategories.frontier,
          frequency: freq,
        });
      }
    }
    if (groupConstants.location === 'Location') {
      for (const freq in GroupCategoryReportFrequency) {
        if (
          freq === GroupCategoryReportFrequency.Weekly &&
          groupConstants[group] === groupConstants.location
        ) {
          seedGrReportCategory.push({
            groupCategoryId: groupConstants.location,
            eventCategoryId: eventsCategories.mc,
            frequency: freq,
          });
          seedGrReportCategory.push({
            groupCategoryId: groupConstants.location,
            eventCategoryId: eventsCategories.garage,
            frequency: freq,
          });
        }
        if (
          freq === GroupCategoryReportFrequency.Monthly &&
          groupConstants[group] === groupConstants.location
        ) {
          seedGrReportCategory.push({
            groupCategoryId: groupConstants.location,
            eventCategoryId: eventsCategories.wedding,
            frequency: freq,
          });
          seedGrReportCategory.push({
            groupCategoryId: groupConstants.location,
            eventCategoryId: eventsCategories.baptism,
            frequency: freq,
          });
          seedGrReportCategory.push({
            groupCategoryId: groupConstants.location,
            eventCategoryId: eventsCategories.frontier,
            frequency: freq,
          });
        }
      }
    }
  }
  return seedGrReportCategory;
}

export default seedGroupReportCategories();
