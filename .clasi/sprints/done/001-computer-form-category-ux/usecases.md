---
status: final
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Sprint 001 Use Cases

## SUC-001: Create a Computer with Full Identity Fields
Parent: UC-4.3

- **Actor**: Quartermaster
- **Preconditions**: Quartermaster is authenticated and on the New Computer form.
- **Main Flow**:
  1. Quartermaster opens `/computers/new`.
  2. Form presents fields for: Manufacturer (select), Model Number (text),
     Manufactured Year (number), Operating System (select), Category (select),
     in addition to existing fields.
  3. Quartermaster fills in desired identity fields.
  4. Quartermaster submits the form.
  5. Server creates the computer record with all five identity fields persisted.
  6. Browser navigates to the new computer's detail page, which shows all five
     values.
- **Postconditions**: Computer record exists with manufacturer, modelNumber,
  manufacturedYear, osId, and categoryId correctly set.
- **Acceptance Criteria**:
  - [ ] All five fields (Manufacturer, Model Number, Manufactured Year, Operating
        System, Category) are visible on `/computers/new`.
  - [ ] OS and Category selects populate from `/api/operating-systems` and
        `/api/categories` respectively.
  - [ ] Submitting with values set persists them (verified on detail page).
  - [ ] Edit mode (`/computers/:id/edit`) hydrates all five fields from the
        existing record.
  - [ ] Submitting the edit form without changes preserves values.

## SUC-002: Filter Computer List by Category
Parent: UC-4.3, UC-5.2

- **Actor**: Quartermaster or Instructor
- **Preconditions**: User is authenticated and on the Computer List page.
  At least two computers exist in different categories.
- **Main Flow**:
  1. User opens `/computers`.
  2. Page shows a Category column in the table.
  3. User selects a category from the category-filter dropdown.
  4. Table updates to show only computers in the selected category.
  5. User selects "All" to clear the filter and see all computers again.
- **Postconditions**: Displayed computers match the selected category filter.
- **Acceptance Criteria**:
  - [ ] Computer list table has a Category column (hidden on narrow viewports
        like other secondary columns).
  - [ ] Category column shows the category name or "—" for uncategorized.
  - [ ] A Category filter dropdown appears alongside the existing Disposition
        filter, populated from `/api/categories`.
  - [ ] Selecting a category filters the displayed rows client-side.
  - [ ] "All" option clears the filter.

## SUC-003: Edit a Category Name from the Admin Panel
Parent: UC-4.3

- **Actor**: Admin
- **Preconditions**: Admin is authenticated on the admin dashboard. At least
  one category exists.
- **Main Flow**:
  1. Admin opens the Categories & Types panel and selects the Categories tab.
  2. Category names in the list are rendered as clickable links or buttons.
  3. Admin clicks a category name.
  4. An edit form appears (inline or navigated) with the current name pre-filled.
  5. Admin edits the name and saves.
  6. The updated name is reflected in the list immediately without a full-page
     reload.
- **Postconditions**: Category record in the database has the new name.
- **Acceptance Criteria**:
  - [ ] Category names in the admin list are visually clickable (link or button
        styling).
  - [ ] Clicking a name opens an editable state with the current value.
  - [ ] Saving issues a `PUT /api/categories/:id` request with the new name.
  - [ ] The list reflects the updated name after save.
  - [ ] Cancel discards changes without persisting.
  - [ ] Server-side validation errors (e.g., duplicate name) surface to the user.
