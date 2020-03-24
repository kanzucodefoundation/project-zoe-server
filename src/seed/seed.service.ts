import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { seedUsers } from './data/users';
import { seedGroupCategories, seedGroups } from './data/groups';
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
    for (const user of seedUsers) {
      const exists = await this.usersService.exits(user.email);
      if (exists) {
        Logger.log(`User: ${user.email} already exists`);
      } else{
        await this.usersService.register(user);
      }
    }
  }

  async createGroupCategories() {
    for (const rec of seedGroupCategories) {
      const exists = await this.groupCategoriesService.exits(rec.name);
      if (exists) {
        Logger.log(`Group Cat: ${rec.name} already exists`);
      } else{
        await this.groupCategoriesService.create(rec);
      }
    }
  }


  async createGroups() {
    const count = await this.groupsService.count();
    if (count> 0) {
      Logger.log(`Groups : ${count} already exists`);
    } else{
      for (const rec of seedGroups) {
        await this.groupsService.create(rec);
      }
    }
  }
}
