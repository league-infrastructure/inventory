---
id: '015'
title: Photo-Based Computer Onboarding
status: planning
branch: sprint/015-photo-based-computer-onboarding
use-cases:
- UC-4.3a
---

# Sprint 015: Photo-Based Computer Onboarding

## Goals

Implement photo-based Computer record creation: camera capture of a serial
number tag, OCR text extraction, model lookup, and pre-filled form.

## Problem

Entering serial numbers, service tags, and model information by hand is
tedious and error-prone. These numbers are printed on labels that are easy
to photograph.

## Solution

- Add a "Scan from photo" option to the Computer creation flow.
- Open the phone camera, capture a photo of the serial number tag.
- Upload the photo to the server for OCR text extraction.
- Parse extracted text for serial number, service tag, and model identifier.
- Use the model identifier to look up device specifications (manufacturer,
  model name, form factor) via web search or a device database.
- Present a pre-filled Computer creation form for review and correction.
- Store the original photo as an attachment on the Computer record.

## Success Criteria

- Quartermaster can photograph a serial number tag and get a pre-filled
  form.
- OCR correctly extracts serial number and service tag from common label
  formats (Dell, Lenovo, HP, Apple).
- Model lookup returns manufacturer and model name for recognized devices.
- The original photo is stored and viewable on the Computer record.
- Manual entry (UC-4.3) remains available as a fallback.
- Quartermaster can correct any OCR errors before saving.

## Scope

### In Scope

- Camera capture UI (mobile-optimized)
- Photo upload endpoint
- OCR text extraction (e.g., Tesseract or cloud vision API)
- Serial number / service tag parsing
- Model lookup (web search or device database API)
- Pre-filled form with extracted data
- Photo storage as Computer attachment
- Fallback to manual entry

### Out of Scope

- Batch photo processing (one Computer at a time)
- Training custom OCR models
- Automatic device type detection from photos (beyond label text)

## Test Strategy

- Backend API tests: photo upload, OCR extraction (with sample label
  images), model lookup, form pre-fill response.
- Frontend tests: camera capture UI, photo preview, pre-filled form
  rendering, correction and save flow.
- Manual testing with real device labels from the LAP inventory.

## Architecture Notes

- OCR can be done server-side with Tesseract (self-hosted) or via a cloud
  API (Google Cloud Vision, AWS Textract). Decision depends on cost and
  accuracy trade-offs.
- Photos are stored in the filesystem or a blob store, with a reference
  in the Computer record.
- Model lookup could use a manufacturer API, a device database, or a
  web search API. Start simple (web search) and refine.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
