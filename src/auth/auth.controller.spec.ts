import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    generateToken: jest.fn((dto) => {
      return {
        token: String(Date.now()),
        user: {
          ...dto
        }
      }
    }),
  }

  beforeEach(async () => {

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [AuthService],
    })
      .overrideProvider(AuthService)
      .useValue(mockAuthService)
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined(); 
  })

  it('should log user in', async () => {
    const usr = {
      id: Date.now(),
      contactId: Date.now(),
      username: "johndoe@test.com",
      email: "johndoe@test.com",
      fullName: "John Doe",
      role: ['RoleAdmin'],
      isActive: true,
    };
    const result = await controller.login({ user: usr });
    expect(result).toEqual({
      token: expect.any(String),
      user: {
        ...usr
      }
    })
  })
})

