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

@Module({
  imports: [
    HttpModule,
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
