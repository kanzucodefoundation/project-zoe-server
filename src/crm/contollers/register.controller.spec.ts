import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from 'src/users/users.service';
import { CreatePersonDto } from '../dto/create-person.dto';
import { CivilStatus } from '../enums/civilStatus';
import { Gender } from '../enums/gender';
import { RegisterController } from './register.controller';

describe('Register Controller', () => {
  let controller: RegisterController;

  const mockContactsService = {
    registerUser: jest.fn((it) => {
      return {
        id: Math.floor(Math.random() * 100),
        name: 'Test Testing User',
        avatar: 'person avatar',
        ageGroup: '25-35',
        dateOfBirth: Date.now().toString(),
        email: 'test@email.com',
        phone: '07749381034',
        cellGroup: 'New Cell',
        location: 'Kampala',
      };
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RegisterController],
      providers: [UsersService],
    })
      .overrideProvider(UsersService)
      .useValue(mockContactsService)
      .compile();

    controller = module.get<RegisterController>(RegisterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('Should register a user', async () => {
    const data: CreatePersonDto = {
      email: 'test@email.com',
      phone: '07749381034',
      firstName: 'Test',
      lastName: 'User',
      middleName: 'Testing',
      gender: Gender.Female,
      civilStatus: CivilStatus.Other,
      dateOfBirth: Date.now().toString(),
      ageGroup: '25-35',
      placeOfWork: 'KC',
      residence: 'Kampala',
      churchLocationId: Math.floor(Math.random() * 100),
      inCell: false,
      joinCell: true,
    };

    const final = {
      id: expect.any(Number),
      name: expect.any(String),
      avatar: expect.any(String),
      ageGroup: expect.any(String),
      dateOfBirth: expect.any(String),
      email: expect.any(String),
      phone: expect.any(String),
      cellGroup: expect.any(String),
      location: expect.any(String),
    };
    const result = await controller.create(data);
    expect(result).toEqual(final);
  });
});
