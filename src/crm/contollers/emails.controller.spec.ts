import { Test, TestingModule } from '@nestjs/testing';
import { DeleteResult } from 'typeorm';
import { EmailService } from '../emails.service';
import Email from '../entities/email.entity';
import { EmailCategory } from '../enums/emailCategory';
import { EmailsController } from './emails.controller';

describe('EmailsController', () => {
  let controller: EmailsController;

  let mockEmailService = {
    create: jest.fn((it) => new Email()),
    update: jest.fn((it) => new Email()),
    delete: jest.fn((it) => new Email()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailsController],
      providers: [EmailService],
    })
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .compile();

    controller = module.get<EmailsController>(EmailsController);
  });

  it('Should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('Should create an email', async () => {
    const data: Email = new Email();
    const result = await controller.create(data);
    expect(result).toEqual(expect.any(Email));
  });

  it('Should update an Email', async () => {
    // const newEmail: Email = {
    //   id: Math.floor(Math.random() * 100),
    //   category: EmailCategory.Personal,
    //   value: 'test@email.com',
    //   isPrimary: true,
    //   contactId: Math.floor(Math.random() * 100),
    // };
    const data: Email = new Email();
    const result = await controller.update(data);
    expect(result).toEqual(expect.any(Email));
  });

  it('Should delete an Email', async () => {
    const myId = Math.floor(Math.random() * 100);
    const myResult = await controller.remove(myId);
    expect(myResult).toBeUndefined();
  });
});
