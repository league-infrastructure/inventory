---
status: pending
---

# Computer financial tracking — acquisition cost, depreciation, replacement value

Add financial fields to the Computer model to track asset valuation
over the lifecycle of each device.

## New fields

| Field | Type | Description |
|-------|------|-------------|
| **acquisitionDate** | Date | When the device was acquired (may differ from `dateReceived`) |
| **acquisitionCost** | Decimal | Purchase price paid — never changes after initial entry |
| **depreciatedValue** | Decimal | Current book value after depreciation — set manually, typically decreases over time. Related to acquisition date. Most current computers will be $0 |
| **replacementCost** | Decimal | What it would cost to replace this device today — e.g., current eBay/market value. Updated periodically |

## Notes

- `acquisitionCost` is immutable after creation (or at least rarely changed)
- `depreciatedValue` is set outside the system (e.g., by an accountant)
  and entered manually — not auto-calculated
- `replacementCost` is the practical "what is this worth to us" number
- All three values are independent — they serve different purposes
  (historical cost, book value, market value)
- Display on the computer detail page, possibly in a "Financial" section
- Consider whether these should appear on reports or exports
