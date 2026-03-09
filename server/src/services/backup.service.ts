import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, DO_SPACES_BUCKET } from './s3';

const execAsync = promisify(exec);

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

  async createBackup(): Promise<BackupInfo> {
    this.ensureDir();
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL not configured');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.dump`;
    const filePath = path.join(this.backupDir, filename);

    // Run pg_dump directly — postgresql-client is installed in the container
    await execAsync(
      `pg_dump --format=custom --no-owner --no-acl "${dbUrl}" > "${filePath}"`,
      { maxBuffer: 50 * 1024 * 1024 },
    );

    const stats = fs.statSync(filePath);

    // Upload to S3 (DigitalOcean Spaces) under backups/
    await this.uploadToS3(filePath, filename);

    return {
      filename,
      size: stats.size,
      createdAt: stats.mtime.toISOString(),
      location: 'both',
    };
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

  async restoreBackup(filename: string): Promise<void> {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL not configured');

    // Sanitize filename to prevent path traversal
    const sanitized = path.basename(filename);
    const filePath = path.join(this.backupDir, sanitized);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found: ${sanitized}`);
    }

    // Run pg_restore directly — postgresql-client is installed in the container
    await execAsync(
      `pg_restore --clean --if-exists --no-owner --no-acl --dbname="${dbUrl}" "${filePath}"`,
      { maxBuffer: 50 * 1024 * 1024 },
    );
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
