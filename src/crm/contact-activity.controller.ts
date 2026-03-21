import { Controller, Get, Param, Request, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SentryInterceptor } from '../utils/sentry.interceptor';
import { TenantContextInterceptor } from '../interceptors/tenant-context.interceptor';
import { ContactActivityService } from './contact-activity.service';

@UseInterceptors(SentryInterceptor, TenantContextInterceptor)
@ApiTags('Crm')
@Controller('api/crm')
export class ContactActivityController {
  constructor(private readonly service: ContactActivityService) {}

  @Get('contacts/:contactId/activity')
  async findForContact(
    @Param('contactId') contactId: number,
    @Request() req: any,
  ) {
    return this.service.findForContact(req.tenantId, contactId);
  }
}
