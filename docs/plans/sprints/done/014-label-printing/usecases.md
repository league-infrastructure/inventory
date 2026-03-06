---
status: approved
---

# Sprint 014 Use Cases

## SUC-014-001: Generate and Print Labels
Parent: UC-4.8

- **Actor**: Quartermaster
- **Preconditions**: Kit/Pack/Computer exists in system
- **Main Flow**:
  1. User clicks "Print Labels" on kit detail page
  2. Modal shows checkboxes for kit label and each pack label
  3. User selects/deselects labels to print
  4. User clicks Print
  5. System generates PDF with selected labels
  6. Browser opens print dialog
- **Postconditions**: PDF generated with correct labels
- **Acceptance Criteria**:
  - [x] Kit, pack, and computer label PDFs generated
  - [x] Labels include QR code, name, organization info
  - [x] Batch printing generates multi-page PDF
  - [x] Print modal with select/clear all controls
