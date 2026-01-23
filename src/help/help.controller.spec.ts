import { Test, TestingModule } from '@nestjs/testing';
import { HelpController } from './help.controller';
import { HelpService } from './help.service';

describe('HelpController', () => {
  let controller: HelpController;
  let mockHelpService: Partial<HelpService>;

  beforeEach(async () => {
    mockHelpService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HelpController],
      providers: [
        {
          provide: HelpService,
          useValue: mockHelpService,
        },
      ],
    }).compile();

    controller = module.get<HelpController>(HelpController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
