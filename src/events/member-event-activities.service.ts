import { MemberEventActivities } from "./entities/member-event-activities.entity";
import { Injectable, Logger } from "@nestjs/common";
import { In, Repository } from "typeorm";

import { UpdateMemberEventActivitiesDto } from "./dto/update-member-event-activities.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { EventActivity } from "./entities/event-activity.entity";
import MemberEventActivitiesSearchDto from "./dto/member-event-activities-search.dto";
import { MemberEventActivitiesDto } from "./dto/member-event-activities.dto";
import { CreateMemberEventActivitiesDto } from "./dto/create-member-event-activities.dto";

@Injectable()
export class MemberEventActivitiesService {
  constructor(
    @InjectRepository(MemberEventActivities)
    private readonly repository: Repository<MemberEventActivities>,
    @InjectRepository(EventActivity)
    private readonly eventActivityrepository: Repository<EventActivity>,
  ) {}

  async create(
    data: MemberEventActivitiesDto,
  ): Promise<MemberEventActivitiesDto> {
    for (let i = 0; i < data.contactId.length; i++) {
      let toSave = new MemberEventActivities();

      toSave.activityId = data.activityId;

      toSave.contactId = data.contactId[i];

      console.log(toSave);
      const member = await this.repository.save(toSave);
    }
    return data;
  }

  async findAll(): Promise<any> {
    console.log("finding all");
    const allActivities = await this.eventActivityrepository.find({});

    const toDto = [];

    for (let i = 0; i < allActivities.length; i++) {
      const data = await this.repository.find({
        where: { activityId: allActivities[i].id },

        relations: ["activity", "contact", "contact.person"],
      });

      const member = [];
      if (data) {
        for (let j = 0; j < data.length; j++) {
          const fullName = `${data[j].contact.person.firstName} ${data[j].contact.person.lastName}`;
          member.push({
            contactId: data[j].contactId,
            person: fullName,
            id: data[j].id,
          });
        }
      }
      const allData = { activity: allActivities[i].name, members: member };
      toDto.push(allData);
    }

    return toDto;
  }

  async findOne(id: number): Promise<MemberEventActivities> {
    return await this.repository.findOne(id);
  }

  async update(
    data: UpdateMemberEventActivitiesDto,
  ): Promise<UpdateMemberEventActivitiesDto | any> {
    console.log("updating members", data.memberIds);
    for (let i = 0; i < data.memberIds.length; i++) {
      await this.repository.delete(data.memberIds[i]);
    }
    return data;
  }

  async remove(id: number): Promise<void> {
    console.log("removing an member from an activity");
    await this.repository.delete(id);
  }
}
