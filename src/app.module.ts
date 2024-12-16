import { Global, Module, MiddlewareConsumer } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { AuthController } from "./auth/auth.controller";
import { AppService } from "./app.service";
import { UsersModule } from "./users/users.module";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module";
import { CrmModule } from "./crm/crm.module";
import { GroupsModule } from "./groups/groups.module";
import config, { appEntities } from "./config";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { SeedModule } from "./seed/seed.module";
import { VendorModule } from "./vendor/vendor.module";
import { EventsModule } from "./events/events.module";
import { EmailSchedulerService } from "./shared/email-scheduler.service";
import { ChatModule } from "./chat/chat.module";
import { HelpModule } from "./help/help.module";
import { TenantsModule } from "./tenants/tenants.module";
import { JwtTenantHeaderMiddleware } from "./middleware/jwtTenantHeader.middleware";
import { ReportsModule } from "./reports/reports.module";
import { BotModule } from "./bot/bot.module";
import { SalvationModule } from "./salvations.module";

@Global()
@Module({
  imports: [
    HttpModule,

    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "public"),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
    }),
    TypeOrmModule.forRoot({
      ...config.database,
      entities: appEntities,
    }),
    UsersModule,
    AuthModule,
    CrmModule,
    GroupsModule,
    SeedModule,
    VendorModule,
    EventsModule,
    SalvationModule,

    ChatModule,
    HelpModule,
    TenantsModule,
    ReportsModule,
    BotModule,
  ],
  exports: [AppService],
  controllers: [AuthController],
  providers: [AppService, EmailSchedulerService],
})
export class AppModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(JwtTenantHeaderMiddleware)
      .exclude(
        "api/auth/login",
        "api/auth/forgot-password",
        "api/groups/combo/locations",
        "api/auth/reset-password/:token",
        "api/register",
      )
      .forRoutes("*");
  }
}
