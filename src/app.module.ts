import { HttpModule, Logger, Module } from '@nestjs/common';
import {AuthController} from './auth/auth.controller';
import {AppService} from './app.service';
import {UsersModule} from './users/users.module';
import {ConfigModule} from '@nestjs/config';
import {TypeOrmModule} from '@nestjs/typeorm';
import {AuthModule} from './auth/auth.module';
import {CrmModule} from './crm/crm.module';
import {GroupsModule} from './groups/groups.module';
import config from './config';
import {groupEntities} from './groups/groups.helpers';
import {crmEntities} from './crm/crm.helpers';
import {usersEntities} from './users/users.helpers';
import {ServeStaticModule} from '@nestjs/serve-static';
import {join} from 'path';
import {SeedModule} from './seed/seed.module';
import {SeedService} from './seed/seed.service';
import { VendorModule } from './vendor/vendor.module';


@Module({
    imports: [
        HttpModule,
        ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', 'public'),
        }),
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        TypeOrmModule.forRoot({
            type: 'mysql', ...config.database,
            entities: [
                ...usersEntities, ...crmEntities, ...groupEntities
            ],
            //logging: true
        }),
        UsersModule,
        AuthModule,
        CrmModule,
        GroupsModule,
        SeedModule,
        VendorModule
    ],
    controllers: [AuthController],
    providers: [AppService],
})
export class AppModule {
    constructor(private readonly seedService: SeedService) {
    }

    async onModuleInit(): Promise<void> {
        Logger.log('#########Initializing application############');
        await this.seedService.createUsers();
        await this.seedService.createGroupCategories();
        await this.seedService.createGroups();
        Logger.log('#########Initialization complete############');
    }
}


