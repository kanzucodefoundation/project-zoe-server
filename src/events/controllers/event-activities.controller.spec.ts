import { Test, TestingModule } from "@nestjs/testing";
import { EventActivitiesController } from "./event-activities.controller";
import { EventActivitiesService } from "../event-activities.service";
import { id } from "date-fns/locale";

describe("EventActivitiesController", () => {
  let controller: EventActivitiesController;
  const mockEventActivitiesService = {
    create: jest.fn((dto) => {
      return {
        id: Date.now(),
        ...dto,
      };
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventActivitiesController],
      providers: [EventActivitiesService],
    })
      .overrideProvider(EventActivitiesController)
      .useValue(mockEventActivitiesService)
      .compile();

    controller = module.get<EventActivitiesController>(
      EventActivitiesController,
    );
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should create an activitiy", () => {
    // expect(controller.create(name:'Test')).toEqual({
    //   id:expect.any(Number),
    //   name:"Test",
    // })
  });
});
