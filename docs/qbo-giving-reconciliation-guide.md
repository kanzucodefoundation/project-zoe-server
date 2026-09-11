# QuickBooks Giving Reconciliation — Setup & Testing Guide

## What this does

Once a giving transaction in Zoe has been matched to a donor, this feature posts a **Sales Receipt** to QuickBooks Online directly from the Finance → Reconciliation screen. The Sales Receipt records:

- **Who gave** — the QBO Customer (mapped from the donor contact)
- **How much** — the transaction amount
- **What category** — the QBO Item (Tithes, Offering, Donations, etc.)
- **Which location** — the QBO Location / Department (e.g. WH Kira)
- **Which FOB** — the QBO Class (e.g. Kira FOB)
- **Which bank account** — the QBO Account the money was deposited into

---

## Part 1 — Local setup (do this once)

### Step 1 — Add QBO environment variables

Add the following to your server `.env` file. Get the values from Peter.

```
QUICKBOOKS_CLIENT_ID=<provided by Peter>
QUICKBOOKS_CLIENT_SECRET=<provided by Peter>
QUICKBOOKS_REDIRECT_URI=http://localhost:3000/api/integrations/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox
```

### Step 2 — Run database migrations

```bash
cd server
npm run migration:run
```

This creates the `external_system_mapping` and `accounting_posting` tables needed for QBO integration.

### Step 3 — Add the sandbox redirect URI in the Intuit Developer portal

The sandbox app needs to trust your local callback URL. Ask Peter to add
`http://localhost:3000/api/integrations/quickbooks/callback` to the app's
**Redirect URIs** in the Intuit Developer portal if it is not already there.

### Step 4 — Connect your local Zoe to the QBO sandbox

1. Start the server and client locally.
2. Log in as the WHM tenant admin.
3. Go to **Settings → Integrations → QuickBooks**.
4. Click **Connect to QuickBooks**.
5. You will be redirected to Intuit's login page — sign in with the sandbox QBO account credentials Peter shares with you.
6. Approve the permissions. You will be redirected back to Zoe.
7. The settings page should now show the sandbox company name confirming the connection.

This stores OAuth tokens in your local database. You only need to do this once (tokens refresh automatically).

---

## Part 2 — Posting a transaction to QuickBooks

No Postman needed — everything is in the Finance UI.

### Step 1 — Find an approved transaction

1. Go to **Finance → Reconciliation**.
2. Find a transaction that has been **matched and approved** (the match status shows "Approved").
3. Open the transaction detail.

### Step 2 — Click "Post to QuickBooks"

A **Post to QuickBooks** button appears on approved, matched transactions. Clicking it opens a panel that automatically runs a readiness check.

### Step 3 — Review the readiness check

The panel will either:

**Show blockers** — things that must be fixed before posting is allowed:

| Blocker | What to do |
|---------|-----------|
| Transaction must have an approved contact match | Approve the match in Reconciliation first |
| No QuickBooks Customer mapped for contact | See Part 3 below — add a Customer mapping |
| No QuickBooks Location mapped for group | Contact Peter — the location seeding may be incomplete |
| No QuickBooks Class mapped for FOB | Contact Peter — the FOB seeding may be incomplete |
| No QuickBooks Account mapped for financial account | Contact Peter — the bank account mapping is missing |
| Already posted to QuickBooks | This transaction was already posted — check QBO for the receipt |

**Show a Sales Receipt preview** — if all checks pass, you will see:
- Customer name
- Transaction date and reference number
- Which bank account it will be deposited to
- Location and line items with amounts

### Step 4 — Confirm and post

Review the preview and click **Confirm & Post**. The panel will show:
- A success confirmation with the QBO Sales Receipt number, or
- An error message if QBO rejected the posting

### Step 5 — Verify in QuickBooks

Log into the QBO sandbox at [app.sandbox.qbo.intuit.com](https://app.sandbox.qbo.intuit.com) and go to **Sales → All Sales**. Find the Sales Receipt by receipt number or donor name and confirm the details look correct.

---

## Part 3 — Adding a QuickBooks Customer mapping for a donor

Each donor needs to be linked to a QBO Customer before their transaction can be posted. This is a one-time setup per donor.

### Step 1 — Find or create the Customer in QBO sandbox

Log into the QBO sandbox → **Sales → Customers**. Search for the donor by name.

- If they exist, note their Customer ID from the URL: `...nameId=**67**`
- If they don't exist, click **New Customer**, enter their name, and save. Note the ID.

### Step 2 — Find the Contact ID in Zoe

Open the donor's contact record in Zoe and note the Contact ID from the URL.

### Step 3 — Create the mapping

Call this endpoint (use Postman or the browser dev tools' network tab to find your auth token):

```
POST /api/integrations/quickbooks/mappings
Authorization: Bearer <your token>
Content-Type: application/json

{
  "system": "QUICKBOOKS",
  "internalReferenceType": "CONTACT",
  "internalReferenceId": "<Zoe Contact ID>",
  "externalReferenceType": "CUSTOMER",
  "externalReferenceId": "<QBO Customer ID>"
}
```

After this, the "Post to QuickBooks" panel should pass the Customer check and show a preview.

---

## Notes

- **Sandbox only** — the sandbox QBO account is a test environment. Posting here does not affect the live WHM QuickBooks account.
- **Safe to retry** — if a posting fails, you can click "Post to QuickBooks" again. The system creates a new attempt each time.
- **Seeded reference data** — Locations (Departments), FOBs (Classes), giving categories (Items), and bank accounts have been pre-loaded into the sandbox by Peter. You do not need to set these up yourself.
