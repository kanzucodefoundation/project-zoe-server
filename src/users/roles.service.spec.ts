import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from './roles.service';
import { Connection } from 'typeorm';

describe('RolesService', () => {
  let service: RolesService;

  beforeEach(async () => {
    const mockConnection = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn(),
        find: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        {
          provide: 'CONNECTION',
          useValue: mockConnection,
        },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
