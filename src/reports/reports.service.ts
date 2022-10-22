import { Injectable, Inject } from "@nestjs/common";
import GroupEvent from "src/events/entities/event.entity";
import { Connection, Repository, FindConditions } from "typeorm";
import { UserDto } from "src/auth/dto/user.dto";

@Injectable()
export class ReportsService {
  private readonly repository: Repository<GroupEvent>;

  constructor(@Inject("CONNECTION") connection: Connection) {
    this.repository = connection.getRepository(GroupEvent);
  }

  async getReport(name: string, user: UserDto): Promise<any> {
    const filter: FindConditions<GroupEvent> = {};

    const reportData = await this.repository.find({
      select: ["name", "categoryId", "metaData", "id"],
      relations: ["category", "group", "group.members", "attendance"],
      where: filter,
    });
    return "Placeholder text for now";
  }
}
