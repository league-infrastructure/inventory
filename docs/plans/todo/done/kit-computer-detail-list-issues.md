---
status: done
---

# Detail pages for computers and kits should list issues

Kit and computer detail pages should display a section showing open issues
associated with that entity. Clicking an issue should navigate to the main
issues page where it can be resolved.

## Implementation

Added the `IssuesSection` reusable component (`client/src/components/IssuesSection.tsx`)
which fetches open issues filtered by `kitId` or `computerId` and renders them
as a list with links to `/issues`. Integrated into both `KitDetail.tsx` and
`ComputerDetail.tsx`.
