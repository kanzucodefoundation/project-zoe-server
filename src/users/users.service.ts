import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {User} from './user.entity';
import {RegisterUserDto} from '../auth/dto/register-user.dto';
import SearchDto from '../shared/dto/search.dto';
import {ContactsService} from '../crm/contacts.service';
import Contact from '../crm/entities/contact.entity';
import {UpdateUserDto} from "./dto/update-user.dto";
import {UserListDto} from "./dto/user-list.dto";
import {getPersonFullName} from "../crm/crm.helpers";
import {hasValue} from "../utils/basicHelpers";
import {QueryDeepPartialEntity} from "typeorm/query-builder/QueryPartialEntity";

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly repository: Repository<User>,
        private readonly contactsService: ContactsService,
    ) {
    }

    async findAll(req: SearchDto): Promise<UserListDto[]> {
        const data = await this.repository.find({
            relations: ['contact', 'contact.person'],
            skip: req.skip,
            take: req.limit,
        });
        return data.map(this.toListModel)
    }

    toListModel(user: User): UserListDto {
        const fullName = getPersonFullName(user.contact.person);
        return {
            avatar: user.contact.person.avatar,
            contact: {
                id: user.contactId,
                name: fullName
            },
            id: user.id,
            roles: user.roles,
            username: user.username,
            contactId: user.contactId,
            fullName
        }
    }

    async create(data: User): Promise<User> {
        data.hashPassword();
        return await this.repository.save(data);
    }

    async register(dto: RegisterUserDto): Promise<User> {
        const contact = await this.contactsService.createPerson(dto);
        const user = new User();
        user.username = dto.email;
        user.password = dto.password;
        user.contact = Contact.ref(contact.id);
        user.roles = dto.roles
        user.hashPassword();
        return await this.repository.save(user);
    }

    async findOne(id: number): Promise<UserListDto> {
        const data = await this.repository.findOne(id, {
            relations: ['contact', 'contact.person']
        });
        return this.toListModel(data)
    }

    async update(data: UpdateUserDto): Promise<UserListDto> {
        const update: QueryDeepPartialEntity<User> = {
            roles: data.roles
        }

        if (hasValue(data.password)) {
            const user = new User()
            user.password = data.password;
            user.hashPassword()
            update.password = user.password;
        }

        await this.repository.createQueryBuilder()
            .update()
            .set(update)
            .where("id = :id", {id: data.id})
            .execute()
        return await this.findOne(data.id);
    }

    async remove(id: number): Promise<void> {
        await this.repository.delete(id);
    }

    async findByName(username: string): Promise<User | undefined> {
        return this.repository.findOne({where: {username}, relations: ['contact', 'contact.person']});
    }

    async exits(username: string): Promise<boolean> {
        const count = await this.repository.count({where: {username}});
        return count > 0;
    }
}
