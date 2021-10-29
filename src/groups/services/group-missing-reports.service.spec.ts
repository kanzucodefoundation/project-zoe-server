import { Test, TestingModule } from '@nestjs/testing';
import { GroupMissingReportsService } from './group-missing-reports.service';
import { GroupMissingReportSearchDto } from '../dto/group-missing-report-search.dto';
import { TypeOrmModule } from '@nestjs/typeorm';
import config, { appEntities } from '../../config';
import { GroupCategoryReportFrequency } from '../enums/groupCategoryReportFrequency ';

describe('GroupMissingReportsService', () => {
  let service: GroupMissingReportsService;


  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          ...config.database,
          entities: [...appEntities],
          logging: 'all',
        }),
        TypeOrmModule.forFeature([...appEntities]),
      ],
      providers: [GroupMissingReportsService],
    }).compile();

    service = module.get<GroupMissingReportsService>(GroupMissingReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should be able to findMissingReports', async () => {
    const dto: GroupMissingReportSearchDto = {
      from: new Date(2021,4,19),
      to: new Date(2021,4,25),
      reportFreqList:[GroupCategoryReportFrequency.Quarterly],
      limit: 100,
      skip: 0,
    };
    const response = await service.findMissingReports(dto);
    expect(response.length).toBe(2);
  });

  it('should be able to getIntervalStartDates', () => {
    const dto: GroupMissingReportSearchDto = {
      from: new Date(2021,4,19),
      to: new Date(2021,4,25),
      reportFreqList:[GroupCategoryReportFrequency.Monthly],
      limit: 100,
      skip: 0,
    };
    expect(service.getIntervalStartDates(dto,GroupCategoryReportFrequency.Weekly).length).toBe(11);
    expect(service.getIntervalStartDates(dto,GroupCategoryReportFrequency.Monthly).length).toBe(3);
    expect(service.getIntervalStartDates(dto,GroupCategoryReportFrequency.Quarterly).length).toBe(2);
    expect(service.getIntervalStartDates(dto,GroupCategoryReportFrequency.Annually).length).toBe(1);
  });
});
