-- Add "Unallocated" category for kits that are empty bags with a number
INSERT INTO "Category" (name, "createdAt", "updatedAt")
VALUES ('Unallocated', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
