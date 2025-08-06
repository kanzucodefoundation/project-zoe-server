import { BadRequestException, Injectable, Inject } from "@nestjs/common";
import { roleAdmin } from "src/auth/constants";
import SearchDto from "src/shared/dto/search.dto";
import { hasValue } from "src/utils/validation";
import { ILike, Repository, Connection } from "typeorm";
import { RolesDto } from "./dto/roles.dto";
import Roles from "./entities/roles.entity";

@Injectable()
export class RolesService {
  private readonly repository: Repository<Roles>;

  constructor(@Inject("CONNECTION") connection: Connection) {
    this.repository = connection.getRepository(Roles);
  }

  async create(userRole: RolesDto): Promise<RolesDto> {
    const checkRole = await this.repository.findOne({
      where: [
        { role: userRole.role },
        // { permissions: In(userRole.permissions) },
      ],
    });

    if (checkRole) {
      throw new BadRequestException({
        message:
          "Duplicate role or permission entry detected. Contact your administrator",
      });
    }
    return await this.repository.save(userRole);
  }

  async findAll(req: SearchDto): Promise<RolesDto[]> {
    const filter: Record<string, any> = {};

    if (hasValue(req.query)) {
      filter.role = ILike(`%${req.query.trim().toLowerCase()}%`);
    }

    return await this.repository.find({
      where: filter,
    });
  }

  async findOne(id: number): Promise<RolesDto> {
    return await this.repository.findOne({ where: { id } });
  }

  async update(userRole: RolesDto): Promise<RolesDto> {
    const checkRole = await this.repository.findOne({
      where: { id: userRole.id },
    });
    if (checkRole.role === roleAdmin.role) {
      throw new BadRequestException({
        message: "Unable to edit an Admin role. Contact your administrator",
      });
    }
    return await this.repository.save(userRole);
  }

  async remove(roleId: number): Promise<void> {
    const checkRole = await this.repository.findOne({
      where: { id: roleId },
    });
    if (checkRole.role === roleAdmin.role) {
      throw new BadRequestException({
        message: "Unable to delete an Admin role. Contact your administrator",
      });
    }

    if (checkRole.isActive) {
      throw new BadRequestException({
        message:
          "Unable to delete an active role. Make sure no users have been assigned this role",
      });
    }
    await this.repository.delete(roleId);
  }
}
