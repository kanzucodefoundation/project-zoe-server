import { ExternalSystemConnection } from './quickbooks/entities/external-system-connection.entity';
import { ExternalSystemMapping } from './quickbooks/entities/external-system-mapping.entity';
import { AccountingPosting } from './quickbooks/entities/accounting-posting.entity';

export const integrationsEntities = [
  ExternalSystemConnection,
  ExternalSystemMapping,
  AccountingPosting,
];
