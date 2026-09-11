import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuickBooksController } from './quickbooks.controller';
import { QuickBooksService } from './quickbooks.service';
import { ExternalSystemConnection } from './entities/external-system-connection.entity';
import { TenantContextInterceptor } from '../../interceptors/tenant-context.interceptor';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([ExternalSystemConnection])],
  controllers: [QuickBooksController],
  providers: [QuickBooksService, TenantContextInterceptor],
  exports: [QuickBooksService],
})
export class QuickBooksModule {}
