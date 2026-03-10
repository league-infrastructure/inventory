import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, DO_SPACES_BUCKET } from './s3';

const execAsync = promisify(exec);

async function hasPgDump(): Promise<boolean> {
  try {
    await execAsync('which pg_dump');
    return true;
  } catch {
    return false;
  }
}

export const DOW_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function getAppVersion(): string {
  const candidates = [
    path.join(__dirname, '..', '..', 'package.json'),
    path.join(process.cwd(), 'package.json'),
  ];
  for (const p of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (pkg.version) return pkg.version;
    } catch { /* try next */ }
  }
  return 'unknown';
}

export function getEnvLabel(): string {
  return process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
}

export function dateStamp(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/** Extract the sequential number from a filename like "weekly-5-..." or "adhoc-12-..." */
export function extractSeqNumber(filename: string): number {
  const match = filename.match(/^\w+-(\d+)-/);
  return match ? parseInt(match[1], 10) : 0;
}

export interface BackupInfo {
  filename: string;
  size: number;
  createdAt: string;
  location: 'local' | 's3' | 'both';
}

export class BackupService {
  private backupDir: string;

  constructor() {
    this.backupDir = process.env.BACKUP_PATH || path.join(process.cwd(), 'backups');
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async createBackup(filename?: string): Promise<BackupInfo> {
    this.ensureDir();
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL not configured');

    if (!filename) {
      // Adhoc backup: find next sequential number from existing adhoc files
      const nextSeq = await this.nextAdhocSeq();
      filename = `adhoc-${nextSeq}-${dateStamp()}-${getEnvLabel()}-v${getAppVersion()}.dump`;
    }
    const filePath = path.join(this.backupDir, filename);

    if (await hasPgDump()) {
      // Direct pg_dump — available in the production container
      await execAsync(
        `pg_dump --format=custom --no-owner --no-acl "${dbUrl}" > "${filePath}"`,
        { maxBuffer: 50 * 1024 * 1024 },
      );
    } else {
      // Local dev fallback: run pg_dump inside the Docker db container
      const projectRoot = path.resolve(__dirname, '..', '..', '..');
      const composeFile = process.env.COMPOSE_FILE || path.join(projectRoot, 'docker-compose.dev.yml');
      await execAsync(
        `docker compose -f "${composeFile}" exec -T db pg_dump --format=custom --no-owner --no-acl -U app app > "${filePath}"`,
        { maxBuffer: 50 * 1024 * 1024 },
      );
    }

    const stats = fs.statSync(filePath);

    // Upload to S3 (DigitalOcean Spaces) under backups/ — best-effort
    let location: 'local' | 's3' | 'both' = 'local';
    try {
      await this.uploadToS3(filePath, filename);
      location = 'both';
    } catch (err: any) {
      console.error(`S3 upload failed for ${filename}: ${err.message}. Backup saved locally only.`);
    }

    return {
      filename,
      size: stats.size,
      createdAt: stats.mtime.toISOString(),
      location,
    };
  }

  private async nextAdhocSeq(): Promise<number> {
    try {
      const resp = await s3Client.send(new ListObjectsV2Command({
        Bucket: DO_SPACES_BUCKET,
        Prefix: 'backups/adhoc-',
      }));
      let max = 0;
      for (const obj of resp.Contents || []) {
        const name = obj.Key?.replace('backups/', '') || '';
        const n = extractSeqNumber(name);
        if (n > max) max = n;
      }
      return max + 1;
    } catch {
      return 1;
    }
  }

  private async uploadToS3(filePath: string, filename: string): Promise<void> {
    const body = fs.readFileSync(filePath);
    await s3Client.send(new PutObjectCommand({
      Bucket: DO_SPACES_BUCKET,
      Key: `backups/${filename}`,
      Body: body,
      ContentType: 'application/octet-stream',
    }));
  }

  async listBackups(): Promise<BackupInfo[]> {
    this.ensureDir();

    // Local backups
    const localMap = new Map<string, BackupInfo>();
    for (const f of fs.readdirSync(this.backupDir).filter((f) => f.endsWith('.dump'))) {
      const stats = fs.statSync(path.join(this.backupDir, f));
      localMap.set(f, {
        filename: f,
        size: stats.size,
        createdAt: stats.mtime.toISOString(),
        location: 'local',
      });
    }

    // S3 backups
    try {
      const resp = await s3Client.send(new ListObjectsV2Command({
        Bucket: DO_SPACES_BUCKET,
        Prefix: 'backups/',
      }));
      for (const obj of resp.Contents || []) {
        const filename = obj.Key?.replace('backups/', '') || '';
        if (!filename || !filename.endsWith('.dump')) continue;
        if (localMap.has(filename)) {
          localMap.get(filename)!.location = 'both';
        } else {
          localMap.set(filename, {
            filename,
            size: obj.Size || 0,
            createdAt: obj.LastModified?.toISOString() || '',
            location: 's3',
          });
        }
      }
    } catch {
      // If S3 is unreachable, just show local backups
    }

    return Array.from(localMap.values()).sort((a, b) => b.filename.localeCompare(a.filename));
  }

  private async downloadFromS3(filename: string, filePath: string): Promise<void> {
    const resp = await s3Client.send(new GetObjectCommand({
      Bucket: DO_SPACES_BUCKET,
      Key: `backups/${filename}`,
    }));
    const body = resp.Body;
    if (!body) throw new Error('Empty response from S3');
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    fs.writeFileSync(filePath, Buffer.concat(chunks));
  }

  async restoreBackup(filename: string): Promise<void> {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL not configured');

    // Sanitize filename to prevent path traversal
    const sanitized = path.basename(filename);
    const filePath = path.join(this.backupDir, sanitized);

    // If file doesn't exist locally, try downloading from S3
    if (!fs.existsSync(filePath)) {
      this.ensureDir();
      try {
        await this.downloadFromS3(sanitized, filePath);
      } catch (err: any) {
        throw new Error(`Backup file not found locally or in S3: ${sanitized}`);
      }
    }

    if (await hasPgDump()) {
      // Direct pg_restore — available in the production container
      await execAsync(
        `pg_restore --clean --if-exists --no-owner --no-acl --dbname="${dbUrl}" "${filePath}"`,
        { maxBuffer: 50 * 1024 * 1024 },
      );
    } else {
      // Local dev fallback: pipe dump into the Docker db container
      const projectRoot = path.resolve(__dirname, '..', '..', '..');
      const composeFile = process.env.COMPOSE_FILE || path.join(projectRoot, 'docker-compose.dev.yml');
      await execAsync(
        `cat "${filePath}" | docker compose -f "${composeFile}" exec -T db pg_restore --clean --if-exists --no-owner --no-acl --dbname=app`,
        { maxBuffer: 50 * 1024 * 1024 },
      );
    }
  }

  async deleteBackup(filename: string): Promise<void> {
    const sanitized = path.basename(filename);
    const filePath = path.join(this.backupDir, sanitized);

    // Delete locally if present
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from S3
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: DO_SPACES_BUCKET,
        Key: `backups/${sanitized}`,
      }));
    } catch {
      // S3 delete is best-effort
    }
  }
}
