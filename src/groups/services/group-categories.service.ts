import { Injectable, Inject, Logger } from "@nestjs/common";
import { Repository, Connection } from "typeorm";
import SearchDto from "../../shared/dto/search.dto";
import GroupCategory from "../entities/groupCategory.entity";

@Injectable()
export class GroupCategoriesService {
  private readonly repository: Repository<GroupCategory>;
  private readonly logger = new Logger(GroupCategoriesService.name);
  constructor(@Inject("CONNECTION") connection: Connection) {
    this.repository = connection.getRepository(GroupCategory);
  }

  async findAll(req: SearchDto): Promise<GroupCategory[]> {
    return await this.repository.find({
      skip: req.skip,
      take: req.limit,
    });
  }

  async create(data: GroupCategory): Promise<GroupCategory> {
    return await this.repository.save(data);
  }

  async findOne(id: number): Promise<GroupCategory> {
    return await this.repository.findOne(id);
  }

  async update(id: number, name: string): Promise<GroupCategory> {
    this.logger.log({ id, name });
    await this.repository.update(id, { name });
    return this.repository.findOne({ where: { id } });
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async exits(id: number): Promise<boolean> {
    const count = await this.repository.count({ where: { id: id } });
    return count > 0;
  }
}
