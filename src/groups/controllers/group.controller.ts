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
import { BadRequestException } from '@nestjs/common';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@UseGuards(JwtAuthGuard)
@ApiTags('Groups')
@Controller('api/groups')
export class GroupController {
  constructor(private readonly service: GroupsService) {}

  private parseIntegerQueryParam(
    value: string | number | undefined,
    fieldName: string,
    fallback: number,
    min = 0,
    max?: number,
  ): number {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    const rawValue = String(value);
    if (!/^\d+$/.test(rawValue)) {
      throw new BadRequestException(`Invalid ${fieldName} parameter`);
    }

    const parsedValue = Number(rawValue);
    if (!Number.isSafeInteger(parsedValue)) {
      throw new BadRequestException(`Invalid ${fieldName} parameter`);
    }

    if (parsedValue < min) {
      throw new BadRequestException(`Invalid ${fieldName} parameter`);
    }

    if (max !== undefined && parsedValue > max) {
      return max;
    }

    return parsedValue;
  }

  private parseGroupId(value: string | number | undefined): number {
    const parsedValue = this.parseIntegerQueryParam(value, 'groupId', 0, 1);
    if (parsedValue < 1) {
      throw new BadRequestException('Invalid groupId parameter');
    }
    return parsedValue;
  }

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
  
  @Get('member')
  async getGroupMembersByQuery(
    @Query('groupId') groupId: string,
    @Query('limit') limit: string,
    @Query('skip') skip: string,
    @Request() rawRequest: any,
  ): Promise<any> {
    const parsedGroupId = this.parseGroupId(groupId);
    const parsedLimit = this.parseIntegerQueryParam(limit, 'limit', 100, 0, 100);
    const parsedOffset = this.parseIntegerQueryParam(skip, 'skip', 0, 0);
    return this.service.getGroupMembers(
      parsedGroupId,
      rawRequest.user,
      parsedLimit,
      parsedOffset,
    );
  }
  @Get(':id/members')
  async getGroupMembers(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit: any = 50,
    @Query('offset') offset: any = 0,
    @Request() rawRequest: any,
  ): Promise<any> {
    const parsedLimit = this.parseIntegerQueryParam(limit, 'limit', 50, 0, 100);
    const parsedOffset = this.parseIntegerQueryParam(offset, 'offset', 0, 0);
    return this.service.getGroupMembers(id, rawRequest.user, parsedLimit, parsedOffset);
  }

  @Get(':id/sms-info')
  async getGroupSmsInfo(
    @Param('id', ParseIntPipe) id: number,
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
    return this.service.findAll(req, rawRequest?.user);
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
    @Param('id', ParseIntPipe) id: number,
    @Request() rawRequest: any,
  ): Promise<GroupListDto> {
    return await this.service.findOne(id, true, rawRequest.user);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() rawRequest: any,
  ): Promise<void> {
    await this.service.remove(id, rawRequest.user);
  }
}
