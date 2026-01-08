import { Test, TestingModule } from '@nestjs/testing';
import { PhonesService } from './phones.service';
import { Connection } from 'typeorm';

describe('PhonesService', () => {
  let service: PhonesService;

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
        PhonesService,
        {
          provide: 'CONNECTION',
          useValue: mockConnection,
        },
      ],
    }).compile();

    service = module.get<PhonesService>(PhonesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
