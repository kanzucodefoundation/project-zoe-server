import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('Users Controller', () => {
  let controller: UsersController;

  const mockUsersService = {
    createUser: jest.fn((dto) => {
      return {
        id: dto.contactId,
        fullName: 'Herbert Otim',
        avatar: 'http://avatar.com/1',
        ...dto,
      };
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [UsersService],
    })
      .overrideProvider(UsersService)
      .useValue(mockUsersService)
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create and register a user account', async () => {
    const userDto = {
      contactId: Math.floor(Math.random() * 100),
      username: 'htest@email.com',
      password: 'RarePassString.123',
      roles: ['TestUser', 'User'],
      isActive: true,
    };
    const result = await controller.create(userDto);

    expect(result).toEqual({
      ...userDto,
      id: expect.any(Number),
      fullName: expect.any(String),
      avatar: expect.any(String),
    });
  });
});
