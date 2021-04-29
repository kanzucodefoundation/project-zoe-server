import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { EventFieldService } from './event-field.service';
import EventFieldDto from './dto/event-field.dto';
import { EventFieldCreateDto } from './dto/event-field-create.dto';

@UseGuards(JwtAuthGuard)
@ApiTags('Events Fields')
@Controller('api/events/fields')
export class EventsFieldsController {
  constructor (
    private service: EventFieldService
  ){}

  //Get event field by id  
  @Get(':id')
  async findOne(@Param('id') id:number): Promise<EventFieldDto>{
    return await this.service.getOneField(id);
  }

  //Create event field
  @Post('category/:id')
  async create(@Param('id') category:number, @Body() createFieldDto: EventFieldCreateDto): Promise<EventFieldDto>{
    return await this.service.createField(category,createFieldDto);
  }

  //Get event field by category
  @Get('category/:id')
  async findFieldbyCategory(@Param('id') id:number): Promise<EventFieldDto[]>{
    return await this.service.getFieldbyCategory(id);
  }

  //Update event field
  @Put(':id')
  async update(@Param('id') id:number, @Body() eventFieldDto: EventFieldDto): Promise<EventFieldDto>{
    return await this.service.updateField(id,eventFieldDto);
  }

  //Delete event field
  @Delete(':id')
  async remove(@Param('id') id:number):Promise<EventFieldDto>{
    return await this.service.deleteField(id);
  }
}
