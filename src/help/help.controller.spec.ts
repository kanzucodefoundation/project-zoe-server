import { Test, TestingModule } from '@nestjs/testing';
import { HelpController } from './help.controller';
import { HelpService } from './help.service';

describe('HelpController', () => {
  let controller: HelpController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HelpController],
      providers: [HelpService],
    }).compile();

    controller = module.get<HelpController>(HelpController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
