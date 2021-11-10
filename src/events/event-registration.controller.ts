import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import EventAttendance from './entities/eventAttendance.entity';
import GroupEvent from './entities/event.entity';
import GroupMembership from '../groups/entities/groupMembership.entity';
import { SentryInterceptor } from 'src/utils/sentry.interceptor';
import { EventRegistrationService } from './event-registration.service';
import EventRegistartion from './dto/event-registration.dto';
import EventRegistrationSearchDto from './dto/even-registration-search.dto';

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags('Event Registration')
@Controller('api/events/registration')
export class EventsRegistrationController {
  constructor(
    private readonly eventRegistrationService: EventRegistrationService,
  ) {}
  @Post()
  create(@Body() data: EventRegistartion): Promise<void> {
    return this.eventRegistrationService.create(data);
  }

  @Get()
  async findAll(@Query() req: EventRegistrationSearchDto): Promise<any> {
    return await this.eventRegistrationService.findAll(req);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<any> {
    return await this.eventRegistrationService.findOne(id);
  }
  //TODO to work on this soon
  // @Put()
  // async update(): Promise<any> {
  //   return await this.service.update;
  // }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    return await this.eventRegistrationService.remove(id);
  }
}
