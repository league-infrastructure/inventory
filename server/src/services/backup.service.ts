import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface BackupInfo {
  filename: string;
  size: number;
  createdAt: string;
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
    return {
      filename,
      size: stats.size,
      createdAt: stats.mtime.toISOString(),
    };
  }

  async listBackups(): Promise<BackupInfo[]> {
    this.ensureDir();
    const files = fs.readdirSync(this.backupDir)
      .filter((f) => f.endsWith('.dump'))
      .sort()
      .reverse();

    return files.map((filename) => {
      const stats = fs.statSync(path.join(this.backupDir, filename));
      return {
        filename,
        size: stats.size,
        createdAt: stats.mtime.toISOString(),
      };
    });
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
    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found: ${sanitized}`);
    }
    fs.unlinkSync(filePath);
  }
}
