import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {In, Repository} from 'typeorm';
import Group from '../entities/group.entity';
import SearchDto from '../../shared/dto/search.dto';
import {GroupSearchDto} from '../dto/group-search.dto';
import {FindConditions} from 'typeorm/find-options/FindConditions';
import {hasValue} from '../../utils/basicHelpers';
import GroupListDto from "../dto/group-list.dto";
import CreateGroupDto from "../dto/create-group.dto";
import UpdateGroupDto from "../dto/update-group.dto";

@Injectable()
export class GroupsService {
    constructor(
        @InjectRepository(Group)
        private readonly repository: Repository<Group>,
    ) {
    }

    async findAll(req: SearchDto): Promise<GroupListDto[]> {
        const data = await this.repository.find({
            relations: ['category', 'parent'],
            skip: req.skip,
            take: req.limit
        });
        return data.map(this.toListView)
    }

    toListView(group: Group): GroupListDto {
        const {parent, category, id, categoryId, name, details, parentId, privacy} = group
        return {
            id, categoryId, name, details, parentId, privacy,
            category: {name: category.name, id: category.id},
            parent: parent ? {name: parent.name, id: parent.id} : null
        }
    }

    async combo(req: GroupSearchDto): Promise<Group[]> {
        const findOps: FindConditions<Group> = {};
        if (hasValue(req.categories)) {
            findOps.categoryId = In(req.categories);
        }
        return await this.repository.find({
            select: ['id', 'name', 'categoryId'],
            where: findOps,
            skip: req.skip,
            take: req.limit,
        });
    }

    async create(data: CreateGroupDto): Promise<GroupListDto> {
        const group: Group = {
            id: 0, ...data,
            children: [],
            members: [],
        };
        const created = await this.repository.save(group);
        return this.findOne(created.id)
    }

    async findOne(id: number): Promise<GroupListDto> {
        const data = await this.repository.findOne(id, {
            relations: ['category', 'parent'],
        });
        return this.toListView(data)
    }

    // Added by Daniel
    async findAllMinistries(categoryId: string): Promise<GroupListDto[]> {
        const resp = await this.repository
        .find({
        select: ['name'],
        where: {
            contactId: categoryId,
          },
        });
        return resp.map(this.toListView);
    }
    // END

    async update(dto: UpdateGroupDto): Promise<GroupListDto> {
        const group: Group = {
            ...dto,
            children: [],
            members: [],
        };
        await this.repository.save(group);
        return await this.findOne(dto.id)
    }

    async remove(id: number): Promise<void> {
        await this.repository.delete(id);
    }

    async exits(name: string): Promise<boolean> {
        const count = await this.repository.count({where: {name}});
        return count > 0;
    }

    async count(): Promise<number> {
        return await this.repository.count();
    }
}
