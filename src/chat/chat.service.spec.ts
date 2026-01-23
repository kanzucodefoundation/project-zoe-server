import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { Connection, Repository } from 'typeorm';
import Email from '../crm/entities/email.entity';

describe('ChatService', () => {
  let service: ChatService;
  let mockConnection: Partial<Connection>;
  let mockEmailRepository: Partial<Repository<Email>>;

  beforeEach(async () => {
    // Create mock email repository
    mockEmailRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    // Create mock connection
    mockConnection = {
      getRepository: jest.fn().mockReturnValue(mockEmailRepository),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: 'CONNECTION',
          useValue: mockConnection,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize email repository', () => {
    expect(mockConnection.getRepository).toHaveBeenCalledWith(Email);
  });
});
