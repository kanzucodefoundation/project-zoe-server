import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Reflector } from '@nestjs/core';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    generateToken: jest.fn((dto) => {
      return {
        token: String(Date.now()),
        user: {
          ...dto,
        },
      };
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
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
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

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should log user in', async () => {
    const usr = {
      id: Date.now(),
      contactId: Date.now(),
      username: 'johndoe@test.com',
      email: 'johndoe@test.com',
      fullName: 'John Doe',
      role: ['RoleAdmin'],
      isActive: true,
    };
    const mockRequest = {
      user: usr,
      body: { churchName: 'Test Church' },
    };
    const result = await controller.login(mockRequest);
    expect(result).toEqual({
      token: expect.any(String),
      user: {
        ...usr,
      },
    });
  });
});
