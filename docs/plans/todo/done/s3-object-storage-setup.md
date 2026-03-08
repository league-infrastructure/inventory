---
status: pending
---

# Set Up S3-Compatible Object Storage (DigitalOcean Spaces)

Move image storage from PostgreSQL bytea columns to DigitalOcean Spaces
(S3-compatible object storage). This will reduce database size and improve
image serving performance.

## Scope

- Configure DigitalOcean Spaces bucket and access credentials
- Add S3-compatible client (e.g., `@aws-sdk/client-s3`) to the server
- Update `ImageService` to upload processed images to Spaces instead of
  storing binary data in the `Image.data` column
- Store the Spaces object key in the Image record instead of raw bytes
- Update `GET /api/images/:id` to proxy or redirect to the Spaces URL
- Add Spaces credentials (`DO_SPACES_KEY`, `DO_SPACES_SECRET`,
  `DO_SPACES_BUCKET`, `DO_SPACES_REGION`, `DO_SPACES_ENDPOINT`) to
  SOPS secrets for .env and .env.template; ( we'll encrypt to secrets/* later)
- Add corresponding Docker Swarm secrets for production
- Migrate any existing bytea images to Spaces (one-time script)
- Keep URL-based image support as-is (no change needed)

The S3 endpoint is https://jtl-inventory.sfo3.digitaloceanspaces.com
