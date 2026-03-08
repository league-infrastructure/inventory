---
status: draft
---

# Sprint 023 Use Cases

## SUC-001: Upload Image to Object Storage
Parent: UC-4.3a

- **Actor**: Quartermaster
- **Preconditions**: User is authenticated with quartermaster role
- **Main Flow**:
  1. User uploads an image via the PhotoUpload component
  2. Server receives the file, processes it with sharp (resize, WebP)
  3. Server uploads the processed image to DigitalOcean Spaces
  4. Server creates an Image record with `objectKey` (no binary in DB)
  5. Server attaches the Image to the target object (Computer/Kit/Pack)
- **Postconditions**: Image is stored in Spaces, Image record has objectKey
- **Acceptance Criteria**:
  - [ ] Uploaded images are stored in DigitalOcean Spaces
  - [ ] Image record contains objectKey, not binary data
  - [ ] Image displays correctly in the UI

## SUC-002: Serve Image from Object Storage
Parent: UC-5.1, UC-5.2

- **Actor**: Any authenticated user
- **Preconditions**: Image exists in Spaces
- **Main Flow**:
  1. Client requests `GET /api/images/:id`
  2. Server looks up Image record
  3. Server returns 302 redirect to Spaces URL
  4. Browser fetches image directly from Spaces
- **Postconditions**: Image is displayed in the browser
- **Acceptance Criteria**:
  - [ ] GET redirects to Spaces URL for S3-backed images
  - [ ] Legacy bytea images still serve correctly
  - [ ] URL-based images still redirect correctly

## SUC-003: Delete Image from Object Storage
Parent: UC-4.4

- **Actor**: Quartermaster
- **Preconditions**: Image exists in Spaces
- **Main Flow**:
  1. User clicks Remove on a photo
  2. Server deletes the S3 object
  3. Server unlinks and deletes the Image record
- **Postconditions**: Image removed from both Spaces and database
- **Acceptance Criteria**:
  - [ ] S3 object is deleted when image is removed
  - [ ] Image record is deleted from database

## SUC-004: Migrate Existing Images to Object Storage
Parent: N/A (infrastructure)

- **Actor**: System administrator
- **Preconditions**: Existing images stored as bytea in database
- **Main Flow**:
  1. Admin runs migration script
  2. Script queries images with data but no objectKey
  3. For each: uploads to Spaces, sets objectKey, clears data column
- **Postconditions**: All images moved to Spaces, data column cleared
- **Acceptance Criteria**:
  - [ ] Migration script processes all bytea images
  - [ ] Images display correctly after migration
  - [ ] Database size reduced after migration
