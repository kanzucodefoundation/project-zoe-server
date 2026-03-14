import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { appEntities } from '../config';
import { AppLogger } from '../utils/app-logger.service';

// Controllers
import { FinancialAccountsController } from './controllers/financial-accounts.controller';
import { TransactionsController } from './controllers/transactions.controller';
import { ReconciliationController } from './controllers/reconciliation.controller';
import { DistributionsController } from './controllers/distributions.controller';
import { CategoryRulesController } from './controllers/category-rules.controller';
import { ReportsController } from './controllers/reports.controller';

// Services
import { AccountsService } from './services/accounts.service';
import { TransactionsService } from './services/transactions.service';
import { MatchingService } from './services/matching.service';
import { ReconciliationService } from './services/reconciliation.service';
import { CategoryRulesService } from './services/category-rules.service';
import { DistributionsService } from './services/distributions.service';
import { ReportsService } from './services/reports.service';

// Plugins
import { ReconciliationPluginRegistry } from './plugins/reconciliation-plugin.registry';
import { DefaultReconciliationPlugin } from './plugins/default-reconciliation.plugin';
import { WorshipHarvestReconciliationPlugin } from './plugins/worship-harvest-reconciliation.plugin';

@Module({
  imports: [
    TypeOrmModule.forFeature([...appEntities]),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
      },
    }),
  ],
  controllers: [
    FinancialAccountsController,
    TransactionsController,
    ReconciliationController,
    DistributionsController,
    CategoryRulesController,
    ReportsController,
  ],
  providers: [
    AccountsService,
    TransactionsService,
    MatchingService,
    ReconciliationService,
    CategoryRulesService,
    DistributionsService,
    ReportsService,
    ReconciliationPluginRegistry,
    DefaultReconciliationPlugin,
    WorshipHarvestReconciliationPlugin,
    AppLogger,
  ],
  exports: [
    AccountsService,
    TransactionsService,
    MatchingService,
    ReconciliationService,
    DistributionsService,
    ReportsService,
    ReconciliationPluginRegistry,
  ],
})
export class FinanceModule {
  constructor(
    private pluginRegistry: ReconciliationPluginRegistry,
    private defaultPlugin: DefaultReconciliationPlugin,
    private worshipHarvestPlugin: WorshipHarvestReconciliationPlugin,
  ) {
    // Register plugins
    this.pluginRegistry.register(this.defaultPlugin, true);
    this.pluginRegistry.register(this.worshipHarvestPlugin);
  }

}
