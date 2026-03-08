import { S3Client } from '@aws-sdk/client-s3';

export const DO_SPACES_BUCKET = process.env.DO_SPACES_BUCKET || 'jtl-inventory';
export const DO_SPACES_REGION = process.env.DO_SPACES_REGION || 'sfo3';
export const DO_SPACES_ENDPOINT = process.env.DO_SPACES_ENDPOINT || `https://${DO_SPACES_REGION}.digitaloceanspaces.com`;

/** Public base URL for serving objects directly. */
export const SPACES_PUBLIC_URL = `https://${DO_SPACES_BUCKET}.${DO_SPACES_REGION}.digitaloceanspaces.com`;

export const s3Client = new S3Client({
  endpoint: DO_SPACES_ENDPOINT,
  region: DO_SPACES_REGION,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY || '',
    secretAccessKey: process.env.DO_SPACES_SECRET || '',
  },
  forcePathStyle: false,
});
