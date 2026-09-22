import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_TRANSACTION_CATEGORY,
  TransactionCategory,
} from '../enums/transaction-category.enum';
import { ExternalSystemMappingService } from '../../integrations/quickbooks/external-system-mapping.service';
import { QuickBooksService } from '../../integrations/quickbooks/quickbooks.service';
import { TenantContext } from '../../shared/tenant/tenant-context';
import { ACCOUNTING_SYSTEM } from '../constants/accounting-mapping.constants';
import { QboNamedEntity } from '../../integrations/quickbooks/quickbooks.types';

export interface GivingCategoryDto {
  /** Zoe's internal category key, which is what transactions store. */
  category: TransactionCategory | null;
  /** What to show: the QuickBooks product/service name wherever there is one. */
  label: string;
  /** Zoe's own name for the category, when it has one. */
  internalLabel: string | null;
  qboItemId: string | null;
  qboItemName: string | null;
  /**
   * Always true for an active QuickBooks item. A transaction records the item
   * directly, so an item with no Zoe category behind it is still a valid
   * choice — it simply falls back to the default category for the coarse
   * classification that distribution rules use.
   */
  selectable: boolean;
  /** True for the category used when a statement line names none. */
  isDefault: boolean;
}

/** Fallback display names for categories not yet mapped to a QuickBooks item. */
const INTERNAL_LABELS: Record<TransactionCategory, string> = {
  [TransactionCategory.TITHE]: 'Tithe',
  [TransactionCategory.OFFERING]: 'Offering',
  [TransactionCategory.DONATION]: 'Donation',
  [TransactionCategory.ARISE_BUILD]: 'Arise & Build',
};

@Injectable()
export class GivingCategoriesService {
  private readonly logger = new Logger(GivingCategoriesService.name);

  constructor(
    private readonly mappingService: ExternalSystemMappingService,
    private readonly qbService: QuickBooksService,
    private readonly tenantContext: TenantContext,
  ) {}

  /**
   * The giving categories the importer can assign, driven by the QuickBooks
   * chart of products and services rather than a list hardcoded in Zoe.
   *
   * Every active QuickBooks item is returned and every one is choosable, named
   * as QuickBooks names it — all twelve giving items, not the four Zoe knows
   * about. A transaction stores the item directly, so an item with no Zoe
   * category behind it simply falls back to the default category for the coarse
   * classification distribution rules use. If QuickBooks cannot be reached the
   * Zoe categories alone are returned, so importing still works.
   */
  async list(): Promise<GivingCategoryDto[]> {
    const tenantId = this.tenantContext.requireTenant();
    const categories = Object.values(TransactionCategory);

    const mappings = await Promise.all(
      categories.map((category) =>
        this.mappingService.lookupByInternal({
          system: ACCOUNTING_SYSTEM,
          internalReferenceType: 'GIVING_CATEGORY',
          internalReferenceId: category,
          externalReferenceType: 'ITEM',
        }),
      ),
    );

    /** QBO item id -> the Zoe category that posts to it. */
    const categoryByItemId = new Map<string, TransactionCategory>();
    categories.forEach((category, index) => {
      const mapping = mappings[index];
      if (mapping) categoryByItemId.set(mapping.externalReferenceId, category);
    });

    const items = await this.fetchItems(tenantId);

    // QuickBooks is the source of the list, so walk its items first.
    const fromQuickBooks: GivingCategoryDto[] = items.map((item) => {
      const id = String(item.Id);
      const category = categoryByItemId.get(id) ?? null;
      return {
        category,
        label: item.Name,
        internalLabel: category ? INTERNAL_LABELS[category] : null,
        qboItemId: id,
        qboItemName: item.Name,
        selectable: true,
        isDefault: category === DEFAULT_TRANSACTION_CATEGORY,
      };
    });

    // Anything Zoe knows about that QuickBooks did not return still has to be
    // choosable, otherwise a failed lookup would empty the importer's dropdown.
    const covered = new Set(
      fromQuickBooks
        .filter((entry) => entry.category)
        .map((entry) => entry.category as TransactionCategory),
    );
    const unmatched: GivingCategoryDto[] = categories
      .filter((category) => !covered.has(category))
      .map((category) => ({
        category,
        label: INTERNAL_LABELS[category],
        internalLabel: INTERNAL_LABELS[category],
        qboItemId: null,
        qboItemName: null,
        selectable: true,
        isDefault: category === DEFAULT_TRANSACTION_CATEGORY,
      }));

    return [...fromQuickBooks, ...unmatched].sort((a, b) => {
      // The default first, then anything already tied to a Zoe category, then
      // alphabetically — so the common choices sit at the top of the list.
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      const aMapped = a.category !== null;
      const bMapped = b.category !== null;
      if (aMapped !== bMapped) return aMapped ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
  }

  /** Validates a picked item against the live list and derives its category. */
  async resolveGivingItem(externalItemId: string | null): Promise<{
    externalItemId: string | null;
    externalItemName: string | null;
    category: TransactionCategory;
  }> {
    if (!externalItemId) {
      return {
        externalItemId: null,
        externalItemName: null,
        category: DEFAULT_TRANSACTION_CATEGORY,
      };
    }

    const options = await this.list();
    const chosen = options.find(
      (option) => option.qboItemId === externalItemId,
    );

    if (!chosen) {
      // `list()` falls back to Zoe categories (no item ids) when QBO is down.
      const quickBooksUnavailable = options.every(
        (option) => option.qboItemId === null,
      );
      throw new BadRequestException(
        quickBooksUnavailable
          ? 'QuickBooks could not be reached, so the giving item could not be verified. Try again in a moment.'
          : `"${externalItemId}" is not a giving item available in QuickBooks. It may have been archived — reload the categories and pick again.`,
      );
    }

    return {
      externalItemId: chosen.qboItemId,
      externalItemName: chosen.qboItemName,
      category: chosen.category ?? DEFAULT_TRANSACTION_CATEGORY,
    };
  }

  /**
   * The QuickBooks item a category books against.
   *
   * Read from the mapping table rather than `list()`: that degrades to Zoe's
   * own categories when QuickBooks is unreachable, and a caller overwriting a
   * stored item with the resulting nulls would lose it. Nulls here mean the
   * category genuinely has no item mapped.
   */
  async resolveItemForCategory(category: TransactionCategory | null): Promise<{
    externalItemId: string | null;
    externalItemName: string | null;
  }> {
    if (!category) return { externalItemId: null, externalItemName: null };

    const mapping = await this.mappingService.lookupByInternal({
      system: ACCOUNTING_SYSTEM,
      internalReferenceType: 'GIVING_CATEGORY',
      internalReferenceId: category,
      externalReferenceType: 'ITEM',
    });

    return {
      externalItemId: mapping?.externalReferenceId ?? null,
      externalItemName: mapping?.externalReferenceName ?? null,
    };
  }

  private async fetchItems(tenantId: number): Promise<QboNamedEntity[]> {
    try {
      return await this.qbService.getQboItems(tenantId);
    } catch (error) {
      this.logger.warn(
        `Could not read QuickBooks items; falling back to Zoe categories: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return [];
    }
  }
}
