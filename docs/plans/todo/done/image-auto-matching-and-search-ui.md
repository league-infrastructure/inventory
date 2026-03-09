---
status: done
sprint: '025'
tickets:
- '017'
---

# Image Auto-Matching by Serial Number and Search UI

## Auto-Matching Behavior

- When a Computer is created with a serial number, query Image records
  where `fileName` contains the serial number
- If a match is found, automatically set the Computer's `imageId`
- This supports the workflow: upload photos of serial number labels
  first, then create Computer records — the system links them
  automatically

## UI: Image Search and Attach

- Add a search/browse interface for images (search by fileName, view
  thumbnails)
- From a Computer, Kit, or Pack detail page, allow searching existing
  images and attaching one (in addition to the existing upload flow)
- This supports workflows where images are uploaded in bulk first
  and then attached to objects later
