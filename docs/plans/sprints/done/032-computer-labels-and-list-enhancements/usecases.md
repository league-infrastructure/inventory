---
status: done
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Sprint 032 Use Cases

## SUC-001: Print a Single Computer Label from Detail Page
Parent: UC-4.8

- **Actor**: Quartermaster
- **Preconditions**: Computer record exists with at least a machine name
  or hostname assigned
- **Main Flow**:
  1. Quartermaster navigates to the computer detail page
  2. Clicks "Print Label" button
  3. System generates an 89mm × 28mm PDF label with:
     - Full-height QR code on the left
     - Flag icon + "The League Of Amazing Programmers" on top right
     - jointheleague.org and (858) 284-0481 below org name
     - Machine name (hostname) in large font
     - Username and password on the next line
     - Serial number in small text at the bottom
  4. PDF opens in a new browser tab for printing
- **Postconditions**: Label PDF is generated and displayed for printing
- **Acceptance Criteria**:
  - [ ] "Print Label" button appears on computer detail page
  - [ ] Generated PDF has 89mm × 28mm page dimensions
  - [ ] Label layout matches the specified format
  - [ ] QR code links to the computer's detail page URL
  - [ ] All fields render correctly (hostname, credentials, serial)
  - [ ] Missing fields (e.g., no serial number) are handled gracefully

## SUC-002: Print a Single Computer Label from List Page
Parent: UC-4.8

- **Actor**: Quartermaster
- **Preconditions**: Computer list is displayed
- **Main Flow**:
  1. Quartermaster views the computer list
  2. Clicks a print/label action on a specific computer row
  3. System generates the 89mm × 28mm label PDF for that computer
  4. PDF opens in a new browser tab
- **Postconditions**: Single computer label PDF is generated
- **Acceptance Criteria**:
  - [ ] Print action is accessible from the computer list row
  - [ ] Generates the same label format as SUC-001

## SUC-003: Batch Print Computer Labels via Checkbox Selection
Parent: UC-4.8

- **Actor**: Quartermaster
- **Preconditions**: Computer list is displayed with multiple computers
- **Main Flow**:
  1. Quartermaster views the computer list
  2. Checks the checkbox on one or more computer rows
  3. A floating/sticky "Print Labels" button appears (showing count of
     selected computers)
  4. Quartermaster clicks "Print Labels"
  5. System generates a multi-page PDF with one 89mm × 28mm label per
     page for each selected computer
  6. PDF opens in a new browser tab
  7. Quartermaster prints the PDF
- **Postconditions**: Multi-label PDF is generated with all selected
  computers
- **Acceptance Criteria**:
  - [ ] Checkbox column appears on the computer list
  - [ ] "Select all" checkbox in the header selects/deselects all visible
  - [ ] Floating action bar appears when any checkbox is selected
  - [ ] Action bar shows count of selected computers
  - [ ] Batch PDF contains one label per page
  - [ ] Each label uses the 89mm × 28mm format
  - [ ] Deselecting all checkboxes hides the action bar

## SUC-004: Sort Computers by Last Updated Date
Parent: UC-5.2

- **Actor**: Quartermaster
- **Preconditions**: Computer list is displayed
- **Main Flow**:
  1. Quartermaster views the computer list
  2. Sees the "Last Updated" column showing when each computer was last
     modified
  3. Clicks the "Last Updated" column header to sort
  4. Computers sort by most recently updated first (descending)
  5. Clicking again reverses to ascending order
- **Postconditions**: Computer list is sorted by last updated date
- **Acceptance Criteria**:
  - [ ] "Last Updated" column appears on the computer list
  - [ ] Column shows relative or short date format (e.g., "Mar 11" or
        "2 days ago")
  - [ ] Column is sortable (ascending/descending)
  - [ ] Default sort can put recently updated computers at top
  - [ ] `updatedAt` is included in the computer list API response
