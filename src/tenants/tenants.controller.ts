import {
  Controller,
  UseGuards,
  UseInterceptors,
  Post,
  Body,
} from "@nestjs/common";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { SentryInterceptor } from "src/utils/sentry.interceptor";
import { TenantDto } from "./dto/tenant.dto";
import { TenantsService } from "./tenants.service";

@UseInterceptors(SentryInterceptor)
@UseGuards(JwtAuthGuard)
@Controller("api/tenants")
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  create(@Body() tenantDto: TenantDto) {
    // @TODO Check if user has permission to do this
    return {};
  }
}
