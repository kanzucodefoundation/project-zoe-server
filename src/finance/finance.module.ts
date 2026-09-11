import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { appEntities } from '../config';
import { AppLogger } from '../utils/app-logger.service';
import { GroupsModule } from '../groups/groups.module';
import { QuickBooksModule } from '../integrations/quickbooks/quickbooks.module';

// Controllers
import { FinancialAccountsController } from './controllers/financial-accounts.controller';
import { TransactionsController } from './controllers/transactions.controller';
import { ReconciliationController } from './controllers/reconciliation.controller';
import { DistributionsController } from './controllers/distributions.controller';
import { CategoryRulesController } from './controllers/category-rules.controller';
import { ReportsController } from './controllers/reports.controller';
import { AccountingController } from './controllers/accounting.controller';

// Services
import { AccountsService } from './services/accounts.service';
import { TransactionsService } from './services/transactions.service';
import { MatchingService } from './services/matching.service';
import { ReconciliationService } from './services/reconciliation.service';
import { CategoryRulesService } from './services/category-rules.service';
import { DistributionsService } from './services/distributions.service';
import { ReportsService } from './services/reports.service';
import { AccountingService } from './services/accounting.service';

// Plugins
import { ReconciliationPluginRegistry } from './plugins/reconciliation-plugin.registry';
import { DefaultReconciliationPlugin } from './plugins/default-reconciliation.plugin';
import { WorshipHarvestReconciliationPlugin } from './plugins/worship-harvest-reconciliation.plugin';
import { WorshipHarvestAccountingPlugin } from './plugins/worship-harvest-accounting.plugin';

@Module({
  imports: [
    TypeOrmModule.forFeature([...appEntities]),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
      },
    }),
    GroupsModule,
    QuickBooksModule,
  ],
  controllers: [
    FinancialAccountsController,
    TransactionsController,
    ReconciliationController,
    DistributionsController,
    CategoryRulesController,
    ReportsController,
    AccountingController,
  ],
  providers: [
    AccountsService,
    TransactionsService,
    MatchingService,
    ReconciliationService,
    CategoryRulesService,
    DistributionsService,
    ReportsService,
    AccountingService,
    ReconciliationPluginRegistry,
    DefaultReconciliationPlugin,
    WorshipHarvestReconciliationPlugin,
    WorshipHarvestAccountingPlugin,
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
    this.pluginRegistry.register(this.defaultPlugin, true);
    this.pluginRegistry.register(this.worshipHarvestPlugin);
  }
}
