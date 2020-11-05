import { Module } from '@nestjs/common';
import { BlockedDateController } from './controllers/blocked_date.controller';
import { BlockedDateService } from './blocked_date.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockedDate } from './entities/blocked_date.entity';


@Module({
    imports: [TypeOrmModule.forFeature([BlockedDate])],
    providers: [BlockedDateService],
    controllers: [
        BlockedDateController,
    ],
    exports: [BlockedDateService],
})
export class BlockedDateModule {
}

