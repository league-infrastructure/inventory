---
status: done
---

# Show issues on kit and computer detail pages

## Description

The detail pages for kits (`KitDetail.tsx`) and computers
(`ComputerDetail.tsx`) should display a list of issues associated with
that entity. Currently users can create issues from these pages via the
"Report Issue" button, but there is no visibility into existing open or
resolved issues without navigating to the global Issues list.

### Suggested approach

- Fetch issues for the specific kit/computer from the API (e.g.,
  `/api/issues?kitId=X` or `/api/issues?computerId=X`).
- Display them in a collapsible or inline section on the detail page,
  showing type, status, notes, and reporter.
- Use the same `IssueTarget` icon/link pattern used on the Issues list
  page for visual consistency.
- Allow resolving issues directly from the detail page if the user has
  the appropriate role.
