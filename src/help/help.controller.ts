import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards,UseInterceptors, Query,} from '@nestjs/common';
import { HelpService } from './help.service';
import { CreateHelpDto } from './dto/create-help.dto';
import { UpdateHelpDto } from './dto/update-help.dto';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SentryInterceptor } from '../utils/sentry.interceptor';
import SearchDto from '../shared/dto/search.dto';
import HelpDto from './dto/help.dto';
import Help from './entities/help.entity';
import { InjectRepository } from '@nestjs/typeorm';

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags('Help')
@Controller('api/help')
export class HelpController {
  constructor(
    //@InjectRepository(Help)
    private readonly helpService: HelpService) {}

  @Get()
  async findAll(@Query() req: SearchDto): Promise<HelpDto[]> {
    return await this.helpService.findAll(req);
  }

  @Post()
  create(@Body() createHelpDto: CreateHelpDto): Promise<HelpDto> {
    return this.helpService.create(createHelpDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<HelpDto> {
    return await this.helpService.findOne(id);
  }

  @Put()
  async update(@Body() data: UpdateHelpDto): Promise<HelpDto> {
    return this.helpService.update(data);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    await this.helpService.remove(id);
  }
}
