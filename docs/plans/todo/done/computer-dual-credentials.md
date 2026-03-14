---
status: pending
---

# Add student and admin credentials to computer records

The Computer model currently has a single `defaultUsername` /
`defaultPassword` pair. We need to support two sets of credentials per
computer so labels and detail pages can show both:

## Credential sets

| Role | Username | Password | Used on |
|------|----------|----------|---------|
| **Student** | `student` | `student` | All machines — the account students log in with |
| **Admin (Mac)** | `admin` | `JvN:foc` | Macs — "John Von Neumann: father of computing" |
| **Admin (Ubuntu)** | `ubuntu` | (TBD) | Ubuntu machines |

## Scope

- Add `studentUsername` / `studentPassword` fields to the Computer model
  (or rename existing fields and add admin fields — TBD)
- Update the computer detail form to show both credential pairs
- Update the compact label to print the **student** credentials
  (not admin)
- Populate existing records: student is always `student`/`student`;
  admin varies by OS (Mac = `admin`/`JvN:foc`, Ubuntu = `ubuntu`/TBD)
- Capitalization matters — store credentials exactly as they should be
  typed
