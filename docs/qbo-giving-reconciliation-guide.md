# QuickBooks Giving Reconciliation — Testing Guide

## What this does

Once a giving transaction in Zoe has been matched to a donor, this feature posts a **Sales Receipt** to QuickBooks Online. The Sales Receipt records:

- **Who gave** — the QBO Customer (mapped from the donor contact)
- **How much** — the transaction amount
- **What category** — the QBO Item (Tithes, Offering, Donations, etc.)
- **Which location** — the QBO Location / Department (e.g. WH Kira)
- **Which FOB** — the QBO Class (e.g. Kira FOB)
- **Which bank account** — the QBO Account the money was deposited into

---

## Prerequisites for a transaction to be postable

Before a transaction can be posted, **all five** of the following must be true:

1. **Approved match** — the transaction has been reconciled and the match approved in Zoe Finance.
2. **Customer mapping** — the matched donor contact has a QBO Customer ID linked in Zoe.
3. **Item mapping** — the transaction's giving category (Tithe, Offering, Donation, Arise & Build) is mapped to a QBO Item.
4. **Account mapping** — the bank account the transaction came through is mapped to a QBO Account.
5. **Location and FOB mappings** — the donor's home Location and FOB (Field of Battle) groups are mapped to a QBO Department and Class respectively.

Items 3–5 are set up once during the sandbox seeding and do not need to be done per transaction. Item 2 (Customer mapping) needs to exist for each individual donor.

---

## Step-by-step: posting a transaction

### Step 1 — Find the transaction ID

In Zoe Finance, open the transaction you want to post and note the transaction ID from the URL or the transaction detail view.

### Step 2 — Run the preflight check

Call the preflight endpoint to confirm the transaction is ready. This is read-only and safe to call at any time.

```
GET /api/finance/transactions/{id}/accounting/preflight
```

**A passing response looks like:**
```json
{
  "ready": true,
  "blockers": []
}
```

**A failing response lists what is missing:**
```json
{
  "ready": false,
  "blockers": [
    {
      "code": "CUSTOMER_MAPPING_MISSING",
      "message": "No QuickBooks Customer mapped for contact 1234"
    }
  ]
}
```

Common blockers and how to fix them:

| Code | Fix |
|------|-----|
| `MATCH_NOT_APPROVED` | Approve the reconciliation match in Zoe Finance first |
| `CUSTOMER_MAPPING_MISSING` | Add the donor's QBO Customer ID via the mappings endpoint (see below) |
| `LOCATION_MAPPING_MISSING` | The donor's Location group is not mapped to a QBO Department — contact the dev team |
| `CLASS_MAPPING_MISSING` | The donor's FOB is not mapped to a QBO Class — contact the dev team |
| `ACCOUNT_MAPPING_MISSING` | The bank account is not mapped to a QBO Account — contact the dev team |
| `ALREADY_POSTED` | This transaction was already posted — check QBO for the Sales Receipt |

### Step 3 — Preview the Sales Receipt (optional)

To see exactly what will be sent to QuickBooks before committing:

```
GET /api/finance/transactions/{id}/accounting/preview
```

This returns the full Sales Receipt structure — Customer, amount, Item, Location, Class, and deposit account — without posting anything.

### Step 4 — Post to QuickBooks

```
POST /api/finance/transactions/{id}/accounting/post
```

A successful response includes the QBO document number:
```json
{
  "status": "POSTED",
  "externalDocumentId": "183",
  "externalDocumentNumber": "1043",
  "postedAt": "2026-09-11T10:00:00.000Z"
}
```

A failed attempt returns `"status": "FAILED"` with an `errorMessage` explaining what QBO rejected.

### Step 5 — Verify in QuickBooks

Log into the QBO sandbox account and go to **Sales → All Sales**. Find the Sales Receipt by document number or donor name and confirm:

- Customer name matches the donor
- Amount is correct
- Location (Department) and FOB (Class) are correct
- The receipt is deposited to the right bank account

---

## Adding a Customer mapping for a donor

When a donor does not yet have a QBO Customer ID linked in Zoe, create the mapping:

**1. Find or create the Customer in QBO**
In QBO sandbox, go to **Sales → Customers** and find the donor by name. If they don't exist, create them. Note their Customer ID from the URL (e.g. `customerType=Customer&nameId=67`).

**2. Create the mapping in Zoe**

```
POST /api/integrations/quickbooks/mappings
Content-Type: application/json

{
  "system": "QUICKBOOKS",
  "internalReferenceType": "CONTACT",
  "internalReferenceId": "<Zoe contact ID>",
  "externalReferenceType": "CUSTOMER",
  "externalReferenceId": "<QBO Customer ID>"
}
```

After this, re-run the preflight — the `CUSTOMER_MAPPING_MISSING` blocker should be gone.

---

## Checking the posting status later

```
GET /api/finance/transactions/{id}/accounting/posting
```

Returns the latest posting record for that transaction, including status (`PENDING`, `POSTED`, or `FAILED`) and the QBO document number if posted.

---

## Notes for sandbox testing

- The sandbox QBO account mirrors production data for Locations and FOBs but uses test/fictitious donors. Do not use real donor names or amounts during sandbox testing.
- Posting to the sandbox does not affect the live QBO account.
- If a posting fails, it is safe to retry — the system creates a new posting attempt each time.
