import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import EventCategory from './entities/eventCategory.entity';
import { Repository } from 'typeorm';
import { EventCategoryService } from './event-category.service';
import { EventCategoryListDto } from './dto/event-category-list.dto';
import { EventCategoryDto } from './dto/event-category.dto';
import CreateEventDto from './dto/create-event.dto';
import { EventCategoryCreateDto } from './dto/event-category-create.dto';

//@UseGuards(JwtAuthGuard)
@ApiTags('Events Categories')
@Controller('api/events/category')
export class EventsCategoriesController {
  // constructor(
  //   @InjectRepository(EventCategory)
  //   private readonly repository: Repository<EventCategory>,
  //   //private readonly service: GroupCategoriesService

  // ) {}

  // @Get()
  // async findAll(): Promise<EventCategory[]> {
  //   return await this.repository.find({});
  // }

  // @Post()
  // async create(@Body() data: EventCategory): Promise<EventCategory> {
  //   return this.repository.save(data);
  // }

  // @Put()
  // async update(@Body() { id, ...data }: EventCategory): Promise<EventCategory> {
  //   await this.repository.update(id, data);
  //   return this.repository.findOne({ where: { id } });
  // }

  // @Get(':id')
  // async findOne(@Param('id') id: any): Promise<EventCategory> {
  //   return await this.repository.findOne(id);
  // }

  // @Delete(':id')
  // async remove(@Param('id') id: any): Promise<void> {
  //   await this.repository.delete(id);
  // }

  constructor(
    private readonly service: EventCategoryService
  ){}

  @Get()
  async findAll(@Req() req: any): Promise<EventCategoryListDto> {
    const categories = await this.service.getAllCategory();
    return { categories };
  }
 
  @Post()
  async create( @Body() createEventCategoryDto: EventCategoryCreateDto): Promise<EventCategoryDto> {
    return await this.service.createEventCategory(createEventCategoryDto);
  }

  @Get(':id')
  async findOne(@Param('id') id:number): Promise<EventCategoryDto> {
    return await this.service.getOneCategory(id);
  }

  @Put(':id')
  async update(@Param('id') id:number, @Body() eventCategoryDto: EventCategoryDto): Promise<EventCategoryDto>{
    return await this.service.updateCategory(id,eventCategoryDto);
  }


  @Delete(':id')
  async remove(@Param('id') id:number): Promise<EventCategoryDto>{
    return await this.service.deleteCategory(id);
  }
}
