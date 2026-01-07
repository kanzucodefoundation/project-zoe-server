import { Global, Module, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthController } from './auth/auth.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { AuthModule } from './auth/auth.module';
import { CrmModule } from './crm/crm.module';
import { GroupsModule } from './groups/groups.module';
import config, { appEntities } from './config';
import { SeedModule } from './seed/seed.module';
import { VendorModule } from './vendor/vendor.module';
import { EventsModule } from './events/events.module';
import { ChatModule } from './chat/chat.module';
import { HelpModule } from './help/help.module';
import { TenantsModule } from './tenants/tenants.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SearchModule } from './search/search.module';
import { Tenant } from './tenants/entities/tenant.entity';
import { TenantHeaderMiddleware } from './middleware/tenant-header.middleware';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { redisStore } from 'cache-manager-redis-yet';
import { AppLogger } from './utils/app-logger.service';
import { PerformanceMonitoringInterceptor } from './interceptors/performance-monitoring.interceptor';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
    }),
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      ttl: 60 * 60, // 1 hour default TTL
    }),
    TypeOrmModule.forRoot({
      ...config.database,
      entities: [...appEntities, Tenant],
      schema: 'public', // Use public schema for row-level multi-tenancy
    }),
    UsersModule,
    AuthModule,
    CrmModule,
    GroupsModule,
    SeedModule,
    VendorModule,
    EventsModule,

    ChatModule,
    HelpModule,
    TenantsModule,
    ReportsModule,
    DashboardModule,
    SearchModule,
  ],
  exports: [AppService],
  controllers: [AuthController],
  providers: [
    AppService,
    AppLogger,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceMonitoringInterceptor,
    },
  ],
})
export class AppModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantHeaderMiddleware)
      .forRoutes(
        'api/auth/login',
        'api/auth/forgot-password',
        'api/auth/reset-password/:token',
        'api/register',
        'api/tenants',
        'api/tenants/seed',
      );
  }
}
