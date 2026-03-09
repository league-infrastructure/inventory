---
id: "017"
title: "Image auto-matching by serial number and search UI"
status: todo
use-cases: []
depends-on: []
---

# Image auto-matching by serial number and search UI

## Description

When a Computer is created with a serial number, automatically search
existing Image records where `fileName` contains the serial number and
link them. Also add a UI for searching/browsing images and attaching
them to objects.

1. **Auto-matching** — In `ComputerService.create()`, after creating
   the computer, query images where fileName contains the serial number.
   If found, set the computer's imageId.
2. **Image search API** — Add query parameters to `GET /api/images`
   for searching by fileName.
3. **Image browser UI** — Add a search/browse component showing image
   thumbnails with fileName search. Allow attaching an image to a
   Computer, Kit, or Pack from their detail pages.

## Acceptance Criteria

- [ ] Creating a Computer with serial number auto-links matching images
- [ ] `GET /api/images?search=<term>` filters by fileName
- [ ] UI component allows searching and browsing existing images
- [ ] Users can attach an existing image to a Computer/Kit/Pack
- [ ] Existing photo upload flow still works unchanged

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: Test auto-matching logic in ComputerService
- **Verification**: Upload an image with serial number in filename, create computer with that serial, verify auto-link
