import { ReportFrequency } from 'src/groups/enums/reportFrequency';
import ComboDto from 'src/shared/dto/combo.dto';

export default class GroupReportDto {
  id?: number;

  frequency: ReportFrequency;

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
