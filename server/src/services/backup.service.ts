import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execFileAsync = promisify(execFile);

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

    await execFileAsync('pg_dump', [
      '--format=custom',
      '--no-owner',
      '--no-acl',
      `--file=${filePath}`,
      dbUrl,
    ]);

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

    await execFileAsync('pg_restore', [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-acl',
      `--dbname=${dbUrl}`,
      filePath,
    ]);
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
