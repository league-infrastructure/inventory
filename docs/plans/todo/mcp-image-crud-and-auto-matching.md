---
status: pending
---

# MCP Image CRUD and Auto-Matching by Serial Number

## Summary

Add full CRUD MCP tools for images and the ability to attach/detach
images to Computers, Kits, and Packs. Also add a `fileName` field to
the Image model and implement auto-matching: when a computer is created
with a serial number, look up images whose fileName contains that serial
number and automatically attach the match.

## MCP Tools Needed

- `create_image` — upload/create an image record (accepts binary or URL)
- `list_images` — list image records with optional filters
- `get_image` — get image metadata by ID
- `delete_image` — delete an image record (does NOT cascade-delete
  linked computers/kits/packs — only removes the image)
- `attach_image` — attach an image to a Computer, Kit, or Pack
  (set the object's imageId)
- `detach_image` — remove the image link from a Computer, Kit, or Pack
  (set imageId to null)

## Schema Changes

- Add `fileName String?` to the Image model (stores the original
  upload filename)

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

## Deletion Semantics

- Deleting a Computer/Kit/Pack that has an image: delete the object,
  keep the image (set imageId to null on the object before delete, or
  just let the FK go — image stays)
- Deleting an image: remove the image record; null out imageId on any
  linked objects
