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
import { EventCategoryService } from './event-category.service';
import { EventCategoryDto } from './dto/event-category.dto';
import { EventCategoryCreateDto } from './dto/event-category-create.dto';

@UseGuards(JwtAuthGuard)
@ApiTags('Events Categories')
@Controller('api/events/category')
export class EventsCategoriesController {
  constructor(
    private readonly service: EventCategoryService
  ){}

  //Get all event categories
  @Get()
  async findAll(): Promise<EventCategoryDto[]> {
    return await this.service.getAllCategory();
  }
 
  //Create event category
  @Post()
  async create( @Body() createEventCategoryDto: EventCategoryCreateDto): Promise<EventCategoryDto> {
    return await this.service.createEventCategory(createEventCategoryDto);
  }

  //Get event category by id
  @Get(':id')
  async findOne(@Param('id') id:number): Promise<EventCategoryDto> {
    return await this.service.getOneCategory(id);
  }

  //Update event category
  @Put(':id')
  async update(@Param('id') id:number, @Body() eventCategoryDto: EventCategoryDto): Promise<EventCategoryDto>{
    return await this.service.updateCategory(id,eventCategoryDto);
  }

  //Delete event category
  @Delete(':id')
  async remove(@Param('id') id:number): Promise<EventCategoryDto>{
    return await this.service.deleteCategory(id);
  }
}
