import { Test, TestingModule } from '@nestjs/testing';
import { ContactsService } from '../contacts.service';
import Contact from '../entities/contact.entity';
import { ContactsController } from './contacts.controller';
import { UsersService } from '../../users/users.service';
import { Reflector } from '@nestjs/core';

describe('Crm Controller', () => {
  let controller: ContactsController;

  const mockContactsService = {
    findOne: jest.fn((dto) => {
      return new Contact();
    }),
  };

  beforeEach(async () => {
    const mockUsersService = {
      findOne: jest.fn(),
      findByName: jest.fn(),
    };

    const mockReflector = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [
        {
          provide: ContactsService,
          useValue: mockContactsService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    controller = module.get<ContactsController>(ContactsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return contact details for personal profile', async () => {
    const result = await controller.findOne(Math.floor(Math.random() * 10));

    expect(result).toEqual(expect.any(Contact));
  });
});
