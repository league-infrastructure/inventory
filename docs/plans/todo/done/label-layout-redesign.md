---
status: done
sprint: '022'
tickets:
- '001'
---

# Redesign label layout to match spec

Implement the landscape two-column label layout described in
`docs/label-spec.md`, replacing the current portrait stacked layout.

## Changes needed

- Rotate label orientation to landscape (102mm wide × 59mm tall)
- Implement two-row, two-column grid layout
- Header row: flag logo + org name + contact info
- Content row left column: large kit/pack number + QR code
- Content row right column: entity name in large bold text
- Add kit/pack numbering scheme (kit: `5`, pack: `5/2`)
- Add flag logo asset
- Update both PDF and HTML generation paths
