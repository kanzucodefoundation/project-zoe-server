import { Test, TestingModule } from '@nestjs/testing';
import { ContactsService } from '../contacts.service';
import Contact from '../entities/contact.entity';
import { ContactsController } from './contacts.controller';

describe('Crm Controller', () => {
  let controller: ContactsController;

  const mockContactsService = {
    findOne: jest.fn((dto) => {
      return new Contact();
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [ContactsService],
    })
      .overrideProvider(ContactsService)
      .useValue(mockContactsService)
      .compile();

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
