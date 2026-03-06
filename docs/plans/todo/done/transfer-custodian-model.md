---
status: done
sprint: 019
---

# Replace checkout/checkin with transfer and custodian model

## Description

Replace the current checkout/checkin model with a "transfer" concept.
A transfer changes the custodian and/or site of a kit or computer.
This is a chain-of-custody operation recorded as a distinct audit
event, not a regular field edit.

### Custodian

A custodian is the person responsible for an item. There are two kinds:

- **Admin** — the default custodian when an item is in a storeroom.
- **Person (User)** — a specific user who has taken responsibility.

Both kits and computers get a custodian field.

### Site

The site is the physical location. When an item is with admin in a
storeroom, the site is the storeroom. When transferred to a person,
the site becomes "floating" unless the person specifies a location
(e.g., a school).

### Transfer semantics

- Transfer sets a new custodian and/or site.
- When transferring back to admin, the site is set to the return
  location.
- Transfer is a separate audit operation — chain of custody, not a
  field edit.

### Kit-computer cascade

When a computer is part of a kit, transferring the kit cascades the
site and custodian to all computers in the kit. When a computer is
not in a kit, it is transferred independently.

### Migration from current model

- Remove the Checkout and ComputerCheckout models.
- Add custodianId (nullable User FK) to Kit and Computer.
- Keep siteId on Kit and Computer.
- Create a Transfer audit model or use the existing AuditLog with a
  transfer-specific source/type.
