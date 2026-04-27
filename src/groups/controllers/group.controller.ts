import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { GroupsService } from '../services/groups.service';
import SearchDto from '../../shared/dto/search.dto';
import { ApiTags } from '@nestjs/swagger';
import GroupListDto from '../dto/group-list.dto';
import CreateGroupDto from '../dto/create-group.dto';
import UpdateGroupDto from '../dto/update-group.dto';
import { SendSmsDto } from '../dto/send-sms.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SentryInterceptor } from '../../utils/sentry.interceptor';
import { TenantContextInterceptor } from 'src/interceptors/tenant-context.interceptor';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags('Groups')
@Controller('api/groups')
export class GroupController {
  constructor(private readonly service: GroupsService) {}

  @Get('me')
  async getMyGroups(@Request() rawRequest: any): Promise<GroupListDto[]> {
    return this.service.getMyGroups(rawRequest.user);
  }

  @Get('categories')
  async getCategories(): Promise<any[]> {
    return this.service.getCategories();
  }

  @Get('categories/:categoryName')
  async getGroupsByCategory(
    @Param('categoryName') categoryName: string,
    @Request() rawRequest: any,
  ): Promise<GroupListDto[]> {
    const groups = await this.service.getGroupsByCategory(categoryName);
    return groups.map((group) => this.service.toListView(group));
  }

  @Get(':id/members')
  async getGroupMembers(
    @Param('id') id: number,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
    @Request() rawRequest: any,
  ): Promise<any> {
    return this.service.getGroupMembers(id, rawRequest.user, limit, offset);
  }

  @Get(':id/sms-info')
  async getGroupSmsInfo(
    @Param('id') id: number,
    @Request() rawRequest: any,
  ): Promise<any> {
    return this.service.getGroupSmsInfo(id, rawRequest.user);
  }

  @Post(':groupId/send-sms')
  async sendGroupSms(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() body: SendSmsDto,
    @Request() rawRequest: any,
  ): Promise<any> {
    return this.service.sendGroupSms(groupId, body.message, rawRequest.user);
  }

  @Get()
  async findAll(
    @Query() req: SearchDto,
    @Request() rawRequest?: any,
  ): Promise<any> {
    return this.service.findAll(req);
  }

  @Post()
  async create(
    @Body() data: CreateGroupDto,
    @Request() rawRequest: any,
  ): Promise<GroupListDto> {
    return await this.service.create(data, rawRequest.user);
  }

  @Put()
  async update(
    @Body() data: UpdateGroupDto,
    @Request() rawRequest: any,
  ): Promise<GroupListDto> {
    return await this.service.update(data, rawRequest.user);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: number,
    @Request() rawRequest: any,
  ): Promise<GroupListDto> {
    return await this.service.findOne(id, true, rawRequest.user);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: number,
    @Request() rawRequest: any,
  ): Promise<void> {
    await this.service.remove(id, rawRequest.user);
  }
}
