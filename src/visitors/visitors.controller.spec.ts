import { Test, TestingModule } from '@nestjs/testing';
import { VisitorsController } from './visitors.controller';

describe('Visitors Controller', () => {
  let controller: VisitorsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VisitorsController],
    }).compile();

    controller = module.get<VisitorsController>(VisitorsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
