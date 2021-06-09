import { GroupCategoryReportFrequency } from 'src/groups/enums/groupCategoryReportFrequency ';
import ComboDto from 'src/shared/dto/combo.dto';

export default class GroupReportDto {
  id?: number;

  frequency: GroupCategoryReportFrequency;

  submittedById?: number;
  groupLeader?: {
    fullName: string;
    role: string;
  };

  eventCategoryId: string;
  category?: ComboDto;

  parentId?: number;

  group: {
    id: number;
    name: string;
    parentId?: number;
    category?: string;
  };
}
