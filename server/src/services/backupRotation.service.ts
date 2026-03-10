import { ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, DO_SPACES_BUCKET } from './s3';
import { BackupService, DOW_NAMES, dateStamp, getAppVersion, getEnvLabel, extractSeqNumber } from './backup.service';

export class BackupRotationService {
  private backupService: BackupService;

  constructor(backupService: BackupService) {
    this.backupService = backupService;
  }

  /**
   * Daily rotation: creates daily-<dow>-<YYYYMMDD>-<env>-v<version>.dump.
   * Overwrites the previous backup with the same day-of-week.
   */
  async runDaily(): Promise<void> {
    const now = new Date();
    const dow = DOW_NAMES[now.getDay()];
    const filename = `daily-${dow}-${dateStamp(now)}-${getEnvLabel()}-v${getAppVersion()}.dump`;

    // Delete any existing backup with the same day-of-week prefix
    await this.deleteS3ByPrefix(`backups/daily-${dow}-`);

    await this.backupService.createBackup(filename);
    console.log(`Daily backup created: ${filename}`);
  }

  /**
   * Weekly rotation: creates weekly-<seq>-<YYYYMMDD>-<env>-v<version>.dump.
   * Keeps the 4 most recent weekly backups, deletes older ones.
   */
  async runWeekly(): Promise<void> {
    const now = new Date();
    const nextSeq = await this.nextWeeklySeq();
    const filename = `weekly-${nextSeq}-${dateStamp(now)}-${getEnvLabel()}-v${getAppVersion()}.dump`;

    await this.backupService.createBackup(filename);
    console.log(`Weekly backup created: ${filename}`);

    // Trim to 4 weekly backups
    await this.trimWeeklyBackups(4);
  }

  private async nextWeeklySeq(): Promise<number> {
    try {
      const resp = await s3Client.send(new ListObjectsV2Command({
        Bucket: DO_SPACES_BUCKET,
        Prefix: 'backups/weekly-',
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

  private async deleteS3ByPrefix(prefix: string): Promise<void> {
    try {
      const resp = await s3Client.send(new ListObjectsV2Command({
        Bucket: DO_SPACES_BUCKET,
        Prefix: prefix,
      }));
      for (const obj of resp.Contents || []) {
        if (obj.Key) {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: DO_SPACES_BUCKET,
            Key: obj.Key,
          }));
        }
      }
    } catch {
      // Best-effort S3 cleanup
    }
  }

  private async trimWeeklyBackups(keep: number): Promise<void> {
    try {
      const resp = await s3Client.send(new ListObjectsV2Command({
        Bucket: DO_SPACES_BUCKET,
        Prefix: 'backups/weekly-',
      }));
      const objects = (resp.Contents || [])
        .filter(obj => obj.Key?.endsWith('.dump'))
        .sort((a, b) => {
          // Sort by sequential number descending (newest first)
          const aName = a.Key?.replace('backups/', '') || '';
          const bName = b.Key?.replace('backups/', '') || '';
          return extractSeqNumber(bName) - extractSeqNumber(aName);
        });

      // Delete anything beyond the retention count
      for (const obj of objects.slice(keep)) {
        if (obj.Key) {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: DO_SPACES_BUCKET,
            Key: obj.Key,
          }));
          console.log(`Trimmed old weekly backup: ${obj.Key}`);
        }
      }
    } catch {
      // Best-effort trim
    }
  }
}
