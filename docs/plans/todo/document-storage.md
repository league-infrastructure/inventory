---
status: pending
---

# Document Storage (Purchase Orders, Invoices, Receipts)

Add a document management system for storing purchase orders, invoices,
receipts, and other files associated with kits and computers.

## Core Model

- New `Document` table in Postgres with fields:
  - `id` (PK)
  - `fileName` (original filename)
  - `mimeType` (e.g. `application/pdf`, `image/jpeg`)
  - `type` (enum: `PURCHASE_ORDER`, `INVOICE`, `RECEIPT`, `OTHER`)
  - `objectKey` (S3/Spaces key for the stored file)
  - `size` (file size in bytes)
  - `uploadedById` (FK → User)
  - `createdAt`, `updatedAt`
- Join table or nullable FKs to link documents to Kits and/or Computers
  (a document can be linked to multiple entities, e.g. a purchase order
  covering several computers)
- Storage in DigitalOcean Spaces (same bucket as photos), under a
  `documents/` prefix

## UI

- **Document list on Kit detail and Computer detail pages** — shown below
  photos, displays linked documents with type badge, filename, date, and
  download link
- **Upload widget** on Kit and Computer detail pages to attach documents
- **Documents page** in the left sidebar nav — lists all documents with
  columns for type, filename, linked kit/computer, date, uploader.
  Filterable by type.

## MCP / AI Access

- MCP tools for documents (critical for AI workflows):
  - `list_documents` — list/filter documents by type, kit, computer
  - `get_document` — get metadata for a document
  - `download_document` — retrieve the document contents (base64 or
    a presigned URL the AI can fetch)
  - `upload_document` — store a document and link it to a kit/computer
  - `delete_document` — remove a document
- AI agents need to be able to read purchase orders and invoices to
  answer questions about costs, vendors, and procurement history

## Document Types

- `PURCHASE_ORDER`
- `INVOICE`
- `RECEIPT`
- `OTHER`

## Notes

- Follows the same storage pattern as the existing Image/photo system
  (S3 upload, objectKey stored in DB, public URL generation)
- Documents are primarily linked at the Kit level or Computer level
  (not packs or items)
- The mime type field allows the system to render PDFs inline or offer
  appropriate download handling
