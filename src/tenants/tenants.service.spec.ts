import { Test, TestingModule } from '@nestjs/testing';
import { TenantsService } from './tenants.service';
import { DbService } from '../shared/db.service';

describe('TenantsService', () => {
  let service: TenantsService;

  beforeEach(async () => {
    const mockDataSource = {
      getRepository: jest.fn().mockReturnValue({
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
      }),
    };

    const mockDbService = {
      createTenant: jest.fn(),
      getTenant: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: 'CONNECTION',
          useValue: mockDataSource,
        },
        {
          provide: DbService,
          useValue: mockDbService,
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
