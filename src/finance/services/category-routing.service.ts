import { Injectable } from '@nestjs/common';
import { ExternalSystemMappingService } from '../../integrations/quickbooks/external-system-mapping.service';
import {
  ACCOUNTING_SYSTEM,
  CATEGORY_CURRENCY_REFERENCE_TYPE,
  CURRENCY_ROUTED_CATEGORIES,
  DEFAULT_CURRENCY,
  categoryCurrencyKey,
} from '../constants/accounting-mapping.constants';

/** Offertory items, whatever service they were collected at. */
const COLLECTED_ITEM = /offer(?:tory|ing)/i;

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

  /**
   * True when the money was collected in the room rather than given by a
   * named person, so posting it needs no giver.
   *
   * The four-value category cannot say which offering an item is: a YXP or
   * children's church collection carries no category keyword and defaults to
   * tithe, and "thanksgiving" reads as a donation. Both are still offertory,
   * so the item the statement resolved to decides this as well as the
   * category.
   */
  isCollected(category: string, itemName?: string | null): boolean {
    return (
      this.isCurrencyRouted(category) || COLLECTED_ITEM.test(itemName ?? '')
    );
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

  /**
   * The product/service a line books against.
   *
   * A statement that named a specific item wins: offertory is collected per
   * service, and "Offertory - Children's Church" is not the same income item as
   * the campus default for the currency.
   */
  resolveLineItem(
    categoryItem: CategoryItemResolution,
    statementItemId: string | null | undefined,
    statementItemName: string | null | undefined,
    categoryMappingItemId: string | null | undefined,
    categoryKey: string,
  ): { externalItemId: string | null; externalItemName: string } {
    if (statementItemId) {
      return {
        externalItemId: statementItemId,
        externalItemName: statementItemName ?? categoryKey,
      };
    }

    return {
      externalItemId:
        categoryItem.externalItemId ?? categoryMappingItemId ?? null,
      externalItemName: categoryItem.externalItemName ?? categoryKey,
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
