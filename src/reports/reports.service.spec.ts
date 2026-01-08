import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { UsersService } from '../users/users.service';
import { GroupsService } from '../groups/services/groups.service';
import { GroupTreeService } from '../groups/services/group-tree.service';
import { AppLogger } from '../utils/app-logger.service';
import { Connection, Repository, TreeRepository } from 'typeorm';
import { Report } from './entities/report.entity';
import { ReportSubmission } from './entities/report.submission.entity';
import { ReportSubmissionData } from './entities/report.submission.data.entity';
import { User } from '../users/entities/user.entity';
import { ReportField } from './entities/report.field.entity';
import GroupMembership from '../groups/entities/groupMembership.entity';
import Group from '../groups/entities/group.entity';

describe('ReportsService', () => {
  let service: ReportsService;
  let mockConnection: Partial<Connection>;
  let mockUsersService: Partial<UsersService>;
  let mockGroupsService: Partial<GroupsService>;
  let mockGroupTreeService: Partial<GroupTreeService>;
  let mockAppLogger: Partial<AppLogger>;
  let mockRepositories: any;

  beforeEach(async () => {
    // Create mock repositories
    mockRepositories = {
      report: {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      reportSubmission: {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
      },
      reportSubmissionData: {
        find: jest.fn(),
        save: jest.fn(),
      },
      user: {
        findOne: jest.fn(),
      },
      reportField: {
        save: jest.fn(),
        find: jest.fn(),
      },
      groupMembership: {
        find: jest.fn(),
      },
      groupTree: {
        findDescendants: jest.fn(),
        findAncestors: jest.fn(),
      },
    };

    // Create mock connection
    mockConnection = {
      getRepository: jest.fn((entity: any) => {
        if (entity === Report) return mockRepositories.report;
        if (entity === ReportSubmission) return mockRepositories.reportSubmission;
        if (entity === ReportSubmissionData) return mockRepositories.reportSubmissionData;
        if (entity === User) return mockRepositories.user;
        if (entity === ReportField) return mockRepositories.reportField;
        if (entity === GroupMembership) return mockRepositories.groupMembership;
        return mockRepositories.report;
      }),
      getTreeRepository: jest.fn().mockReturnValue(mockRepositories.groupTree),
    };

    // Create mock services
    mockUsersService = {
      findOne: jest.fn(),
      findAll: jest.fn(),
    };

    mockGroupsService = {
      findOne: jest.fn(),
      findAll: jest.fn(),
    };

    mockGroupTreeService = {
      findDescendants: jest.fn(),
      findAncestors: jest.fn(),
    };

    mockAppLogger = {
      createContextLogger: jest.fn().mockReturnValue({
        startTracking: jest.fn().mockReturnValue('tracking-id'),
        endTracking: jest.fn(),
        apiLog: jest.fn(),
        businessLog: jest.fn(),
        error: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: 'CONNECTION',
          useValue: mockConnection,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: GroupsService,
          useValue: mockGroupsService,
        },
        {
          provide: GroupTreeService,
          useValue: mockGroupTreeService,
        },
        {
          provide: AppLogger,
          useValue: mockAppLogger,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create context logger on initialization', () => {
    expect(mockAppLogger.createContextLogger).toHaveBeenCalledWith('ReportsService');
  });

  it('should initialize all repositories correctly', () => {
    expect(mockConnection.getRepository).toHaveBeenCalledWith(Report);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(ReportField);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(GroupMembership);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(ReportSubmissionData);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(ReportSubmission);
    expect(mockConnection.getRepository).toHaveBeenCalledWith(User);
    expect(mockConnection.getTreeRepository).toHaveBeenCalledWith(Group);
  });
});
