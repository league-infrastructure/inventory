import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

/** Find the running postgres container name */
async function findPgContainer(): Promise<string> {
  const { stdout } = await execAsync(
    'docker ps --filter "ancestor=postgres:16-alpine" --format "{{.Names}}"'
  );
  const name = stdout.trim().split('\n')[0];
  if (!name) throw new Error('No postgres container running');
  return name;
}

/** Build a container-internal DB URL (localhost:5432) from the host-facing DATABASE_URL */
function containerDbUrl(): string {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not configured');
  const parsed = new URL(dbUrl);
  return `postgresql://${parsed.username}:${parsed.password}@localhost:5432${parsed.pathname}`;
}

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
    const container = await findPgContainer();
    const url = containerDbUrl();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.dump`;
    const filePath = path.join(this.backupDir, filename);

    // Run pg_dump inside the postgres container, pipe stdout to local file
    await execAsync(
      `docker exec ${container} pg_dump --format=custom --no-owner --no-acl "${url}" > "${filePath}"`,
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
    const container = await findPgContainer();
    const url = containerDbUrl();

    // Sanitize filename to prevent path traversal
    const sanitized = path.basename(filename);
    const filePath = path.join(this.backupDir, sanitized);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found: ${sanitized}`);
    }

    // Pipe the local dump file into pg_restore inside the container
    await execAsync(
      `cat "${filePath}" | docker exec -i ${container} pg_restore --clean --if-exists --no-owner --no-acl --dbname="${url}"`,
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
