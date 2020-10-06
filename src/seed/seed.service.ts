import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { seedUsers } from './data/users';
import seedGroups, { seedGroupCategories } from './data/groups';
import { GroupCategoriesService } from '../groups/services/group-categories.service';
import { GroupsService } from '../groups/services/groups.service';

@Injectable()
export class SeedService {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly groupCategoriesService: GroupCategoriesService,
    private readonly usersService: UsersService,
  ) {
  }

  async createUsers() {
    Logger.log(`Seeding ${seedUsers.length} users`);
    for (const user of seedUsers) {
      const exists = await this.usersService.exits(user.email);
      if (exists) {
        Logger.log(`User: ${user.email} already exists`);
      } else {
        await this.usersService.register(user);
      }
    }
  }

  async createGroupCategories() {
    Logger.log(`Seeding ${seedGroupCategories.length} Group Categories`);
    for (const rec of seedGroupCategories) {
      const exists = await this.groupCategoriesService.exits(rec.id);
      if (exists) {
        Logger.debug(`Group Cat: ${rec.id} already exists`);
      } else {
        await this.groupCategoriesService.create(rec);
      }
    }
  }

  async createGroups() {
    Logger.log(`Seeding ${seedGroups.length} Groups`);
    const count = await this.groupsService.count();
    if (count > 0) {
      Logger.debug(`${count} Groups already exist`);
    } else {
      for (const rec of seedGroups) {
        await this.groupsService.create(rec);
      }
    }
  }
}
