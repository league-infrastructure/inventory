import { S3Client } from '@aws-sdk/client-s3';

export const DO_SPACES_BUCKET = process.env.DO_SPACES_BUCKET || 'jtl-inventory';
export const DO_SPACES_REGION = process.env.DO_SPACES_REGION || 'sfo3';

/** Public base URL for serving objects directly. */
export const SPACES_PUBLIC_URL = `https://${DO_SPACES_BUCKET}.${DO_SPACES_REGION}.digitaloceanspaces.com`;

let _client: S3Client | null = null;

/**
 * Lazy-initialized S3 client.
 *
 * Created on first call rather than at module scope so that env vars
 * loaded by dotenv.config() in index.ts are available. Module-scope
 * initialization captures empty credentials because TypeScript/CJS
 * hoists imports above runtime code.
 */
export function getS3Client(): S3Client {
  if (!_client) {
    const region = process.env.DO_SPACES_REGION || DO_SPACES_REGION;
    const endpoint = process.env.DO_SPACES_ENDPOINT || `https://${region}.digitaloceanspaces.com`;
    _client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: process.env.DO_SPACES_KEY || '',
        secretAccessKey: process.env.DO_SPACES_SECRET || '',
      },
      forcePathStyle: false,
    });
  }
  return _client;
}

/** @deprecated Use getS3Client() instead — kept for backwards compat during migration */
export const s3Client = {
  send: (...args: Parameters<S3Client['send']>) => getS3Client().send(...args),
} as S3Client;
