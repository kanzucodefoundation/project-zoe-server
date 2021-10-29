import { contact } from '@prisma/client';
import { MemberEventActivities } from './entities/member-event-activities.entity';
import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';

import {UpdateMemberEventActivitiesDto } from './dto/update-member-event-activities.dto';
import { InjectRepository } from '@nestjs/typeorm';

import MemberEventActivitiesSearchDto from './dto/member-event-activities-search.dto';
import { MemberEventActivitiesDto } from './dto/member-event-activities.dto';

@Injectable()
export class MemberEventActivitiesService {
  
  constructor(
    @InjectRepository(MemberEventActivities)
    private readonly repository: Repository<MemberEventActivities>,
  ) {}


  async create(data:  MemberEventActivitiesDto): Promise< MemberEventActivitiesDto> {
    console.log(data);
    //const result = await this.repository(MemberEventActivities)
    // .createQueryBuilder()
    // .where(data.contactId)      
    for (let i = 0; i <= data.contactId.length; i++) {
      //.createQueryBuilder()
    let toSave = new MemberEventActivities();
      toSave.activityId= data.activityId;

      toSave.contactId = data.contactId[i];
    

    
      const member = await this.repository.save(toSave);
    

      
    }

    //   .createQueryBuilder()
    //   .insert()
    //   .values({
        // 
    //      //activity: data.activity,
    //      activitiesId: data.activitiesId,
    //      contactId:data.contactId,
    //     //  contact:data.contact,

    //   })
    //   .execute();
    // console.log(result);
    // Logger.log('Member asssigned activity successfully');

    return data;
  }

  

  async findAll(req:MemberEventActivitiesSearchDto): Promise<MemberEventActivities[] | any > {
    console.log('finding all',req);
    const data = await this.repository.find({
      //  where: { activitiesId: req.activitiesId},
      relations: ['activities','contact','contact.person'],
    });
    
    return req;
  }

 
  async findOne(id: number): Promise<MemberEventActivities> {
    return await this.repository.findOne(id);
  }

  async update(dto: UpdateMemberEventActivitiesDto): Promise<UpdateMemberEventActivitiesDto> {
    const result = await this.repository
      .createQueryBuilder()
      .update(MemberEventActivities)
      .set({
        // name: dto.name,
        activityId:dto.activityId,  
        contactId: dto.contactId,
      })
      .where('id = :id', { id: dto.id })
      .execute();
    if (result.affected)
      Logger.log(
        `Update.MemberEventActivities id: ${dto.id} affected:${result.affected} complete`,
      );
    return await this.findOne(dto.id);
  }



  async remove(id: number): Promise<void> {
    console.log('removing an member');
    await this.repository.delete(id);
  }
}
