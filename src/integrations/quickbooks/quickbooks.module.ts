import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuickBooksController } from './quickbooks.controller';
import { QuickBooksService } from './quickbooks.service';
import { ExternalSystemConnection } from './entities/external-system-connection.entity';
import { ExternalSystemMapping } from './entities/external-system-mapping.entity';
import { AccountingPosting } from './entities/accounting-posting.entity';
import { TenantContextInterceptor } from '../../interceptors/tenant-context.interceptor';
import { ExternalSystemMappingService } from './external-system-mapping.service';
import { ExternalSystemMappingController } from './external-system-mapping.controller';

/**
 * A bare `HttpModule` sets no Axios timeout, so a request that Intuit accepts
 * but never answers can hang for as long as the operating system allows. That
 * turns a posted sales receipt into an outcome this server never learns, which
 * is the worst case for money: the receipt exists in QuickBooks and Zoe records
 * a failure. Bounding the wait is what makes the ambiguity short-lived and
 * detectable.
 */
const QUICKBOOKS_HTTP_TIMEOUT_MS = Number(
  process.env.QUICKBOOKS_HTTP_TIMEOUT_MS ?? 30000,
);

@Module({
  imports: [
    HttpModule.register({
      timeout: QUICKBOOKS_HTTP_TIMEOUT_MS,
    }),
    TypeOrmModule.forFeature([
      ExternalSystemConnection,
      ExternalSystemMapping,
      AccountingPosting,
    ]),
  ],
  controllers: [QuickBooksController, ExternalSystemMappingController],
  providers: [
    QuickBooksService,
    ExternalSystemMappingService,
    TenantContextInterceptor,
  ],
  exports: [QuickBooksService, ExternalSystemMappingService],
})
export class QuickBooksModule {}
