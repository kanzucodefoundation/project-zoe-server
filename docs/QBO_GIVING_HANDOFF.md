# QBO Giving Reconciliation — Engineer Handoff

Branch: `feature/quickbooks-integration` (merged into `develop` as of 2026-09-12, PR #295)

This document lists every outstanding engineering item before the QBO giving reconciliation
feature can move from develop → staging → production. Items are grouped by gate.

---

## Gate 1 — Before staging test

These two items can cause incorrect or duplicated data in QBO. Do not run a staging test until both are done.

---

### 1. Add unique constraint on `Transaction.externalReference`

**Risk:** Re-uploading the same bank/mobile-money statement silently creates duplicate `Transaction`
rows. The `AccountingPosting` idempotency guard (migration `UniqueAccountingPostingPerTransaction`)
prevents double-posting, but only once the transaction row exists. If two identical transaction rows
exist, both can independently trigger a posting, resulting in two Sales Receipts in QBO for the same payment.

**What to build:**

Add a migration that creates a partial unique index on `(tenantId, accountId, externalReference)`
where `externalReference IS NOT NULL`. Partial because many transactions have no external reference
(cash, manual entries) and those should not constrain each other.

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_transaction_tenant_account_ref"
ON "transaction" ("tenantId", "accountId", "externalReference")
WHERE "externalReference" IS NOT NULL;
```

Also update `TransactionsService.importFromFile` / `importParsed` to catch the unique violation and
return a user-friendly message ("X rows skipped — already imported") rather than a 500.

Entity: `src/finance/entities/transaction.entity.ts`
Service: `src/finance/services/transactions.service.ts`
Migration: new file in `src/migrations/`

---

### 2. Enforce `FINANCE_VIEW` / `FINANCE_EDIT` permissions on finance controllers

**Risk:** Any authenticated tenant user can approve reconciliation matches and execute distribution
batches. With QBO posting wired in, this means any staff login can create Sales Receipts in the
church's live QuickBooks account.

**What to build:**

Apply `@UseGuards(PermissionsGuard)` and the appropriate `@Permissions()` decorator to each finance
controller. The `PermissionsGuard` and `FINANCE_VIEW`/`FINANCE_EDIT` constants already exist.

| Controller | File | Guard |
|---|---|---|
| `TransactionsController` | `src/finance/controllers/transactions.controller.ts` | `FINANCE_VIEW` on GETs, `FINANCE_EDIT` on POST/PUT/DELETE |
| `ReconciliationController` | `src/finance/controllers/reconciliation.controller.ts` | `FINANCE_VIEW` on GETs, `FINANCE_EDIT` on approve/reject/bulk |
| `DistributionsController` | `src/finance/controllers/distributions.controller.ts` | `FINANCE_EDIT` on all mutating actions |
| `ReportsController` | `src/finance/controllers/reports.controller.ts` | `FINANCE_VIEW` on all |
| `CategoryRulesController` | `src/finance/controllers/category-rules.controller.ts` | `FINANCE_EDIT` on all |

`ExternalSystemMappingController` already has `PermissionsGuard` — use it as the reference implementation.

---

## Gate 2 — Before production

These items do not block a staging test but must be resolved before going live.

---

### 3. Unique constraint on `ContactPaymentMethod.valueNormalized`

**Important distinction:** `ContactPaymentMethod` is a *payment account registry* — records
deliberately added to say "this person sends money via this number." It is separate from
`Contact.phones` (`Phone` entity), which is the communication record where a parent's number might
legitimately appear on a child's contact card.

The unique constraint belongs only on `ContactPaymentMethod`. A child recorded with a parent's
phone in `Contact.phones` is expected and fine — that is a Strategy 2 match (90% confidence,
fallback). The constraint here is specifically about the curated payment account table.

**Risk:** If two contacts are both registered in `ContactPaymentMethod` with the same normalised
phone (e.g. a number incorrectly added twice during data entry), the matching engine
(`src/finance/services/matching.service.ts:241`) calls `findOne` and silently returns whichever
row PostgreSQL surfaces. A 95%-confidence match is created against the wrong person; finance
approves it; a Sales Receipt posts to the wrong QBO customer. There is no warning.

**What to build:**

Add a migration with a unique index:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_contact_payment_method_tenant_value"
ON "contact_payment_method" ("tenantId", "valueNormalized");
```

Before running the migration, query for duplicates in the WHM tenant and resolve them:

```sql
SELECT "valueNormalized", COUNT(*) AS cnt, array_agg("contactId") AS contacts
FROM contact_payment_method
WHERE "tenantId" = <WHM tenant id>
GROUP BY "valueNormalized"
HAVING COUNT(*) > 1;
```

For each duplicate: keep the record for the actual account holder (typically `isPrimary = true`
or the elder contact), remove the other. Do not delete the phone from `Contact.phones` — only
from `ContactPaymentMethod`.

Entity: `src/finance/entities/contact-payment-method.entity.ts`
Migration: new file in `src/migrations/`

---

### 4. Replace hardcoded group IDs in `WorshipHarvestReconciliationPlugin`

**Risk:** Tithe distributions (10% Ministries / 30% Operations / 30% Welfare / 30% Location) write
`Distribution` rows with `targetGroupId` hard-set to `1`, `2`, and `3`. These are placeholders that
almost certainly do not correspond to the real Ministries, Operations, and Welfare groups in the WHM
production database. Every tithe batch will report distributions to the wrong groups.

**Correct tithe split (updated 2026-09-17):**
- 10% → Ministries
- 30% → Operations
- 30% → Welfare  ← new bucket (was previously missing)
- 30% → Location

The plugin percentages have been corrected in code. The group IDs still need to be wired up.

**What to build:**

Option A (recommended for now — one tenant, fast): Read the IDs from environment variables via
`ConfigService`.

```typescript
// In WorshipHarvestReconciliationPlugin constructor
constructor(private readonly configService: ConfigService) {}

private get MINISTRIES_GROUP_ID() {
  return this.configService.get<number>('WHM_MINISTRIES_GROUP_ID');
}
private get OPERATIONS_GROUP_ID() {
  return this.configService.get<number>('WHM_OPERATIONS_GROUP_ID');
}
private get WELFARE_GROUP_ID() {
  return this.configService.get<number>('WHM_WELFARE_GROUP_ID');
}
```

Add `WHM_MINISTRIES_GROUP_ID`, `WHM_OPERATIONS_GROUP_ID`, `WHM_WELFARE_GROUP_ID` to `.env` and
the production `.env` on the server.

**You need from the WHM team / database:** the actual `group.id` values for the Ministries, Operations,
and Welfare groups. Run:

```sql
SELECT g.id, g.name, gc.name AS category, gc.purpose
FROM "group" g
JOIN group_category gc ON gc.id = g."categoryId"
WHERE g."tenantId" = <WHM tenant id>
  AND g.name ILIKE ANY(ARRAY['%ministr%', '%operation%', '%welfare%']);
```

Plugin file: `src/finance/plugins/worship-harvest-reconciliation.plugin.ts`

---

## Gate 3 — Tech debt (no ship blocker)

These are genuine gaps but do not block staging or production. Schedule them in a later sprint.

---

### 5. Finance events in `ContactActivity`

Finance actions (approve match, reject match, post to QBO) are currently logged only to Winston.
The app already has a structured activity feed via `ContactActivity`
(`src/crm/entities/contact-activity.entity.ts`) — this is where finance events should go, not a
new table.

`ContactActivity` has: `contact` (FK), `type` (enum), `summary` (human-readable string),
`occurredAt`, `referenceTable`, `referenceId`, `recordedBy` (FK User). Finance events are
contact-centric — they record what happened to a specific person's giving — so this fits naturally.

**What to build:**

1. Extend `ContactActivityType` (`src/crm/enums/contact-activity-type.enum.ts`) with giving events:

```typescript
// Giving / finance
GIVING_MATCHED = 'giving_matched',       // auto or manual match created
GIVING_APPROVED = 'giving_approved',     // match approved by finance staff
GIVING_REJECTED = 'giving_rejected',     // match rejected
GIVING_POSTED_TO_QBO = 'giving_posted_to_qbo', // Sales Receipt created in QBO
```

2. Write a `ContactActivity` row at each of those moments in `ReconciliationService` and
`AccountingService`. Use `referenceTable = 'reconciliation_match'` / `referenceTable = 'accounting_posting'`
and `referenceId` = the relevant row ID.

**Batch-level events** (batch approved, batch executed) are not contact-linked. Those are
already partially captured by `DistributionBatch.approvedById` / `executedById` fields, which
is sufficient for now.

---

### 6. `DistributionBatch` double-execution under concurrency

`executeBatch` checks `batch.status !== BatchStatus.APPROVED` before proceeding, but two concurrent
requests can both pass that check before either write commits. Add a database-level guard:

```sql
-- In executeBatch, inside a transaction:
UPDATE distribution_batch
SET status = 'EXECUTING'
WHERE id = $1 AND status = 'APPROVED'
RETURNING id;
-- If no row returned, bail out
```

Or add a `UNIQUE` partial index on `(tenantId)` where `status IN ('EXECUTING', 'EXECUTED')` to make
concurrent execution impossible at the DB level.

---

### 7. Async import queue for large bank statements

Imports are processed synchronously inside the HTTP request
(`src/finance/services/transactions.service.ts`). Statements with more than ~500 rows will timeout.

Redis is already configured in `AppModule`. Add BullMQ (`bull` + `@nestjs/bull`) and move the
import processing into a background job. Return a `jobId` immediately; poll for status via a new
`GET /api/finance/transactions/import/:jobId/status` endpoint.

---

### 8. Soft delete for Contact

Hard-deleting a `Contact` cascades to `ContactPaymentMethod` (via `onDelete: 'CASCADE'`) and sets
`ReconciliationMatch.contactId = NULL`. An approved match silently loses its person; the audit
trail becomes incomplete.

Add `@DeleteDateColumn() deletedAt: Date` to `Contact` and switch service calls to `softDelete`.
This is a wider CRM change — coordinate with whoever owns the contacts module.

---

## Reference — what is already done

| Item | Status |
|---|---|
| `Contact.titheNumber` field + migration | Done |
| `ExternalSystemMapping` entity / service / controller | Done |
| `ExternalSystemConnection` entity (OAuth token storage) | Done |
| `AccountingPosting` unique constraint per transaction | Done |
| Tithe number matching (strategy 0, 98% confidence) | Done |
| `IAccountingPostingPlugin` + `WorshipHarvestAccountingPlugin` | Done |
| `AccountingService` preflight / preview / post endpoints | Done |
| `QuickBooksService.postSalesReceipt()` calling QBO API | Done |
| `GroupPermissionsService.resolveForContact()` (location + FOB) | Done |
| `externalItemId` / `externalItemName` on `Transaction` | Done |
| `ExternalSystemMappingController` has `PermissionsGuard` | Done |
| Tithe distribution percentages corrected (10/30/30/30) | Done (group IDs still need wiring — see Gate 2 item 4) |
