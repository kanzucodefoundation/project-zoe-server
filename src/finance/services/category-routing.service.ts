import { Injectable } from '@nestjs/common';
import { ExternalSystemMappingService } from '../../integrations/quickbooks/external-system-mapping.service';
import {
  ACCOUNTING_SYSTEM,
  CATEGORY_CURRENCY_REFERENCE_TYPE,
  CURRENCY_ROUTED_CATEGORIES,
  DEFAULT_CURRENCY,
  categoryCurrencyKey,
} from '../constants/accounting-mapping.constants';

/** `unconfigured` must block rather than fall back to the giver. */
export type CategoryRoutingKind = 'giver' | 'category' | 'unconfigured';

export interface CategoryItemResolution {
  kind: CategoryRoutingKind;
  externalItemId: string | null;
  externalItemName: string | null;
  currency: string;
  configuredCurrencies: string[];
}

@Injectable()
export class CategoryRoutingService {
  constructor(private readonly mappingService: ExternalSystemMappingService) {}

  /** Declared in code, not inferred from mappings, so it holds before setup. */
  isCurrencyRouted(category: string): boolean {
    return CURRENCY_ROUTED_CATEGORIES.includes(category);
  }

  /** Offerings book against their own income item, chosen by currency. */
  async resolveGivingItem(
    category: string,
    currency: string | null | undefined,
  ): Promise<CategoryItemResolution> {
    const normalizedCurrency = (currency || DEFAULT_CURRENCY)
      .trim()
      .toUpperCase();

    if (!this.isCurrencyRouted(category)) {
      return {
        kind: 'giver',
        externalItemId: null,
        externalItemName: null,
        currency: normalizedCurrency,
        configuredCurrencies: [],
      };
    }

    const exact = await this.mappingService.lookupByInternal({
      system: ACCOUNTING_SYSTEM,
      internalReferenceType: CATEGORY_CURRENCY_REFERENCE_TYPE,
      internalReferenceId: categoryCurrencyKey(category, normalizedCurrency),
      externalReferenceType: 'ITEM',
    });

    if (exact) {
      return {
        kind: 'category',
        externalItemId: exact.externalReferenceId,
        externalItemName: exact.externalReferenceName,
        currency: normalizedCurrency,
        configuredCurrencies: [normalizedCurrency],
      };
    }

    const siblings = await this.mappingService.listByInternalPrefix(
      ACCOUNTING_SYSTEM,
      CATEGORY_CURRENCY_REFERENCE_TYPE,
      `${category}:`,
    );

    return {
      kind: 'unconfigured',
      externalItemId: null,
      externalItemName: null,
      currency: normalizedCurrency,
      configuredCurrencies: siblings
        .filter((m) => m.externalReferenceType === 'ITEM')
        .map((m) => m.internalReferenceId.split(':')[1])
        .filter(Boolean)
        .sort(),
    };
  }

  /** Optional per-currency deposit account; falls back to the imported one. */
  async resolveDepositAccount(
    category: string,
    currency: string | null | undefined,
  ): Promise<{ externalAccountId: string | null; currency: string }> {
    const normalizedCurrency = (currency || DEFAULT_CURRENCY)
      .trim()
      .toUpperCase();

    if (!this.isCurrencyRouted(category)) {
      return { externalAccountId: null, currency: normalizedCurrency };
    }

    const exact = await this.mappingService.lookupByInternal({
      system: ACCOUNTING_SYSTEM,
      internalReferenceType: CATEGORY_CURRENCY_REFERENCE_TYPE,
      internalReferenceId: categoryCurrencyKey(category, normalizedCurrency),
      externalReferenceType: 'ACCOUNT',
    });

    return {
      externalAccountId: exact?.externalReferenceId ?? null,
      currency: normalizedCurrency,
    };
  }
}
