import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { GroupCategoryController } from './controllers/group-category.controller';
import { GroupComboController } from './controllers/group-combo.controller';
import { GroupMembershipReqeustController } from './controllers/group-membership-request.contoller';
import { GroupMembershipController } from './controllers/group-membership.controller';
import { GroupController } from './controllers/group.controller';

describe('GroupsModule', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  it('registers static child routes before the generic group id route', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GroupsModule } = require('./groups.module');
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      GroupsModule,
    );
    const genericGroupControllerIndex = controllers.indexOf(GroupController);

    [
      GroupCategoryController,
      GroupComboController,
      GroupMembershipController,
      GroupMembershipReqeustController,
    ].forEach((controller) => {
      expect(controllers.indexOf(controller)).toBeLessThan(
        genericGroupControllerIndex,
      );
    });
  });
});
