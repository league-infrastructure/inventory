---
id: "002"
title: "Add create-issue buttons to admin detail pages"
status: todo
use-cases: []
depends-on: ["001"]
---

# Add create-issue buttons to admin detail pages

## Description

Issue creation currently only exists on the QR mobile pages
(`ReportIssueAction`). The main admin Kit, Pack, and Computer detail
pages have no way to create issues.

Add a "Report Issue" button (or similar) to the admin detail pages for
Kit, Pack, and Computer. The button should open a dialog/form that lets
the user select the issue type and add a description, then POST to
`/api/issues`.

### Changes needed

- Identify the admin Kit, Pack, and Computer detail page components
- Add a Report Issue button/action to each
- Create a shared issue creation dialog/form component if one doesn't
  exist for admin pages (the QR `ReportIssueAction` may be reusable
  or adaptable)

## Acceptance Criteria

- [ ] Kit detail page has a Report Issue button
- [ ] Pack detail page has a Report Issue button
- [ ] Computer detail page has a Report Issue button
- [ ] Issue creation form allows selecting type and entering description
- [ ] Created issues appear on the issues list page

## Testing

- **Existing tests to run**: `npm run test:server`
- **Verification command**: Visual verification on admin detail pages
