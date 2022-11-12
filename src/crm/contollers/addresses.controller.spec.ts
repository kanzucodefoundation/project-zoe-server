import { Test, TestingModule } from '@nestjs/testing';
import { DeleteResult } from 'typeorm';
import { AddressesService } from '../addresses.service';
import Address from '../entities/address.entity';
import { AddressesController } from './addresses.controller';

describe('Addresses Controller', () => {
  let controller: AddressesController;

  let mockAddressesService = {
    create: jest.fn((it) => new Address()),
    update: jest.fn((it) => new Address()),
    delete: jest.fn((it) => new Address()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AddressesController],
      providers: [AddressesService],
    })
      .overrideProvider(AddressesService)
      .useValue(mockAddressesService)
      .compile();

    controller = module.get<AddressesController>(AddressesController);
  });

  it('Should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('Should create an address', async () => {
    const data: Address = new Address();
    const result = await controller.create(data);
    expect(result).toEqual(expect.any(Address));
  });

  it('Should update and address', async () => {
    const data: Address = new Address();
    const result = await controller.update(data);
    expect(result).toEqual(expect.any(Address));
  });

  it('Should delete an address', async () => {
    const id = Math.floor(Math.random() * 100);
    const result = await controller.remove(id);
    expect(result).toBeUndefined();
  });
});
