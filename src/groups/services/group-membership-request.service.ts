import { HttpException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindConditions } from 'typeorm/find-options/FindConditions';
import { Repository } from "typeorm";
import GroupMembershipRequestSearchDto from "../dto/membershipRequest/search-request.dto";
import GroupMembershipRequest from "../entities/groupMembershipRequest.entity";
import { hasValue } from '../../utils/basicHelpers';
import GroupMembershipRequestDto from "../dto/membershipRequest/group-membership-request.dto";
import NewRequestDto from "../dto/membershipRequest/new-request.dto";
import { getPersonFullName } from "src/crm/crm.helpers";
import { ContactsService } from "src/crm/contacts.service";
import CreateRequestDto from "src/crm/dto/create-request.dto";
import Contact from "src/crm/entities/contact.entity";

@Injectable()
export class GroupMembershipRequestService {
    constructor (
        @InjectRepository(GroupMembershipRequest)
        private readonly repository: Repository<GroupMembershipRequest>,
        @InjectRepository(Contact)
        private readonly contactRepository: Repository<Contact>,
        private readonly contactService: ContactsService,
    ) {
    }

    async findAll(req: GroupMembershipRequestSearchDto): Promise<GroupMembershipRequestDto[]> {

        const filter: FindConditions<GroupMembershipRequest> = {};

        if (hasValue(req.contactId)) filter.contactId = req.contactId;
        if (hasValue(req.parentId)) filter.parentId = req.parentId;
        if (hasValue(req.groupId)) filter.groupId = req.groupId;

        const data = await this.repository.find({
            relations: ['contact', 'contact.person', 'group'],
            skip: req.skip,
            take: req.limit,
            where: filter,
        })
        return data.map(this.toDto);
    }

    toDto(data: GroupMembershipRequest): GroupMembershipRequestDto {
        const {group, contact, ...rest} = data;
        return {
            ...rest,
            group: {
                id: group.id,
                name: group.name,
                parentId: group.parentId,
            },
            contact: {
                id: contact.id,
                fullName: getPersonFullName(contact.person), 
                avatar: contact.person.avatar,
            },
        }
    }

    async create(data: NewRequestDto): Promise<GroupMembershipRequestDto | any> {

        const user = await this.contactRepository.findOne(data.contactId, {
            relations: ['person']
        });

        const isPendingRequest = await this.repository.count({where: {contactId: data.contactId}});
        if (isPendingRequest > 0) {
            throw new HttpException("User already has a pending request", 400)
        }

        const info: CreateRequestDto = {
            firstName: user.person.firstName,
            lastName: user.person.lastName,
            email: data.phone,
            phone: data.email,
            churchLocation: data.churchLocation,
            residencePlaceId: data.residencePlaceId,
            residenceDescription: data.residenceDescription
        }

        await this.contactService.createRequest(info);

        return (await this.repository.find({
            where: {contactId: data.contactId},
            relations: ['contact', 'contact.person', 'group'],
        })).map(this.toDto)
    }

    async update(): Promise<any>  {
        return "Not Yet Implemented"
    }

    async findOne(id: number): Promise<GroupMembershipRequestDto> {
        return this.toDto(await this.repository.findOne(id, {
            relations: ['contact', 'contact.person', 'group']
        }));
    }

    async remove(id: number): Promise<void> {
        await this.repository.delete(id);
    } 

}





