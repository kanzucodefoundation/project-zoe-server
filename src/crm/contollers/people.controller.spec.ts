import { Test, TestingModule } from '@nestjs/testing';
import ContactListDto from '../dto/contact-list.dto';
import { CreatePersonDto } from '../dto/create-person.dto';
import { PersonEditDto } from '../dto/person-edit.dto';
import Person from '../entities/person.entity';
import { PeopleService } from '../people.service';
import { PeopleController } from './people.controller';

describe('PeopleController', () => {
  let controller: PeopleController;

  let mockPeopleService = {
    create: jest.fn((it) => new ContactListDto()),
    update: jest.fn((it) => new Person()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PeopleController],
      providers: [PeopleService],
    })
      .overrideProvider(PeopleService)
      .useValue(mockPeopleService)
      .compile();

    controller = module.get<PeopleController>(PeopleController);
  });

  it('Should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('Should create a person', async () => {
    const data: CreatePersonDto = new CreatePersonDto();
    const result = await controller.create(data);
    expect(result).toEqual(expect.any(ContactListDto));
  });

  it('Should update person details', async () => {
    const data: PersonEditDto = new PersonEditDto();
    const result = await controller.update(data);
    expect(result).toEqual(expect.any(Person));
  });
});
