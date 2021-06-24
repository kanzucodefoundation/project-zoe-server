import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hasValue } from 'src/utils/validation';
import { FindConditions, ILike, Repository } from 'typeorm';
import {UserRoleDto, UserRoleSearch} from './dto/user-role.dto';
import UserRoles from './entities/userRoles.entity';

@Injectable()
export class UserRolesService {
  constructor(
    @InjectRepository(UserRoles) private readonly repository: Repository<UserRoles>,
  ) {}

  async create(userRole: UserRoleDto): Promise<UserRoleDto> {
    return await this.repository.save(userRole)
  }

  async findAll(req: UserRoleSearch): Promise<UserRoleDto[]> {
    const filter: FindConditions<UserRoles> = {};

    if (hasValue(req.query)) {
      filter.roleName = ILike(`%${req.query.trim().toLowerCase()}%`);
    }

    return await this.repository.find({
      where:filter
    })
  }

  async findOne(id: number): Promise<UserRoleDto> {
    return await this.repository.findOne(id)
  }

  async update(userRole: UserRoleDto): Promise<UserRoleDto> {
        return await this.repository.save(userRole)
  }

  async remove(id: number): Promise<void> {
    const checkRole = await this.repository.findOne({
      select:['isActive'],
      where:{id:id}
    })
    if(checkRole.isActive){
      throw new BadRequestException({
        message:
          'Unable to delete an active role. Make sure no users have been assigned this role',
      });
    }
    await this.repository.delete(id);
  }
}
