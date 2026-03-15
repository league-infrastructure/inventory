import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { AuditService } from './audit.service';
import { ValidationError } from './errors';

export interface ImportDiffRow {
  sheet: string;
  id: number | null;
  action: 'create' | 'update' | 'skip';
  fields: { field: string; oldValue: string | null; newValue: string | null }[];
  name: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export class ImportService {
  constructor(private prisma: PrismaClient, private audit: AuditService) {}

  async parseAndDiff(buffer: Buffer): Promise<ImportDiffRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const diffs: ImportDiffRow[] = [];

    // Process Kits sheet
    const kitsSheet = workbook.getWorksheet('Kits');
    if (kitsSheet) {
      const headers = this.getHeaders(kitsSheet);
      kitsSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowData = this.rowToObject(row, headers);
        if (!rowData.Name) return;

        const diff: ImportDiffRow = {
          sheet: 'Kits',
          id: rowData.ID ? parseInt(rowData.ID, 10) : null,
          action: rowData.ID ? 'update' : 'create',
          name: rowData.Name || '',
          fields: [],
        };

        if (rowData.Name) diff.fields.push({ field: 'name', oldValue: null, newValue: rowData.Name });
        if (rowData.Description) diff.fields.push({ field: 'description', oldValue: null, newValue: rowData.Description });
        if (rowData['Container Type']) diff.fields.push({ field: 'containerType', oldValue: null, newValue: rowData['Container Type'] });

        if (diff.fields.length > 0) diffs.push(diff);
      });
    }

    // Process Items sheet
    const itemsSheet = workbook.getWorksheet('Items');
    if (itemsSheet) {
      const headers = this.getHeaders(itemsSheet);
      itemsSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowData = this.rowToObject(row, headers);
        if (!rowData.Name) return;

        const diff: ImportDiffRow = {
          sheet: 'Items',
          id: rowData.ID ? parseInt(rowData.ID, 10) : null,
          action: rowData.ID ? 'update' : 'create',
          name: rowData.Name || '',
          fields: [],
        };

        if (rowData.Name) diff.fields.push({ field: 'name', oldValue: null, newValue: rowData.Name });
        if (rowData.Type) diff.fields.push({ field: 'type', oldValue: null, newValue: rowData.Type });
        if (rowData['Expected Quantity']) diff.fields.push({ field: 'expectedQuantity', oldValue: null, newValue: rowData['Expected Quantity'] });

        if (diff.fields.length > 0) diffs.push(diff);
      });
    }

    return diffs;
  }

  async applyImport(diffs: ImportDiffRow[], userId: number): Promise<ImportResult> {
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (const diff of diffs) {
      try {
        if (diff.action === 'skip') {
          result.skipped++;
          continue;
        }

        if (diff.sheet === 'Kits' && diff.action === 'update' && diff.id) {
          const data: any = {};
          for (const f of diff.fields) {
            if (f.newValue !== null) data[f.field] = f.newValue;
          }
          await this.prisma.kit.update({ where: { id: diff.id }, data });
          await this.audit.write({
            userId,
            objectType: 'Kit',
            objectId: diff.id,
            field: 'import',
            oldValue: null,
            newValue: JSON.stringify(data),
          });
          result.updated++;
        } else if (diff.sheet === 'Items' && diff.action === 'update' && diff.id) {
          const data: any = {};
          for (const f of diff.fields) {
            if (f.field === 'expectedQuantity' && f.newValue) {
              data[f.field] = parseInt(f.newValue, 10);
            } else if (f.newValue !== null) {
              data[f.field] = f.newValue;
            }
          }
          await this.prisma.item.update({ where: { id: diff.id }, data });
          await this.audit.write({
            userId,
            objectType: 'Item',
            objectId: diff.id,
            field: 'import',
            oldValue: null,
            newValue: JSON.stringify(data),
          });
          result.updated++;
        } else {
          result.skipped++;
        }
      } catch (e: any) {
        result.errors.push(`${diff.sheet} ${diff.name}: ${e.message}`);
      }
    }

    return result;
  }

  async importComputersCsv(csvText: string, userId: number): Promise<ImportResult> {
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new ValidationError('CSV must have a header row and at least one data row');

    const headers = this.parseCsvLine(lines[0]);

    // Build lookup maps for resolving names to IDs
    const [sites, kits, hostNames, osList, users, categories] = await Promise.all([
      this.prisma.site.findMany({ select: { id: true, name: true } }),
      this.prisma.kit.findMany({ select: { id: true, number: true, name: true } }),
      this.prisma.hostName.findMany({ select: { id: true, name: true, computerId: true } }),
      this.prisma.operatingSystem.findMany({ select: { id: true, name: true } }),
      this.prisma.user.findMany({ select: { id: true, displayName: true } }),
      this.prisma.category.findMany({ select: { id: true, name: true } }),
    ]);

    const siteByName = new Map(sites.map(s => [s.name.toLowerCase(), s.id]));
    const kitByNumber = new Map(kits.map(k => [k.number, k.id]));
    const hostNameByName = new Map(hostNames.map(h => [h.name.toLowerCase(), h]));
    const osByName = new Map(osList.map(o => [o.name.toLowerCase(), o.id]));
    const userByName = new Map(users.map(u => [u.displayName.toLowerCase(), u.id]));
    const categoryByName = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h.trim()] = (values[idx] || '').trim(); });

      const rowLabel = row['Host Name'] || row['Serial Number'] || `row ${i + 1}`;

      try {
        const data: any = {};

        // Direct string fields
        if (row['Manufacturer']) data.manufacturer = row['Manufacturer'];
        if (row['Model']) data.model = row['Model'];
        if (row['Model Number']) data.modelNumber = row['Model Number'];
        if (row['Serial Number']) data.serialNumber = row['Serial Number'];
        if (row['Service Tag']) data.serviceTag = row['Service Tag'];
        if (row['Disposition']) data.disposition = row['Disposition'];
        if (row['Admin Username']) data.adminUsername = row['Admin Username'];
        if (row['Admin Password']) data.adminPassword = row['Admin Password'];
        if (row['Student Username']) data.studentUsername = row['Student Username'];
        if (row['Student Password']) data.studentPassword = row['Student Password'];
        if (row['Notes']) data.notes = row['Notes'];

        // Integer fields
        if (row['Manufactured Year']) {
          const yr = parseInt(row['Manufactured Year'], 10);
          if (!isNaN(yr)) data.manufacturedYear = yr;
        }

        // Date fields
        if (row['Date Received']) data.dateReceived = new Date(row['Date Received']);
        if (row['Last Inventoried']) data.lastInventoried = new Date(row['Last Inventoried']);

        // Resolve names → IDs
        if (row['Site']) {
          const siteId = siteByName.get(row['Site'].toLowerCase());
          if (siteId) data.siteId = siteId;
          else result.errors.push(`${rowLabel}: unknown site "${row['Site']}"`);
        }

        if (row['Kit']) {
          // Kit column is formatted as "#17 Kit Name" — extract the number
          const kitMatch = row['Kit'].match(/^#?(\d+)/);
          if (kitMatch) {
            const kitId = kitByNumber.get(parseInt(kitMatch[1], 10));
            if (kitId) data.kitId = kitId;
            else result.errors.push(`${rowLabel}: unknown kit "${row['Kit']}"`);
          }
        }

        if (row['Operating System']) {
          const osId = osByName.get(row['Operating System'].toLowerCase());
          if (osId) data.osId = osId;
          else result.errors.push(`${rowLabel}: unknown OS "${row['Operating System']}"`);
        }

        if (row['Custodian']) {
          const custId = userByName.get(row['Custodian'].toLowerCase());
          if (custId) data.custodianId = custId;
          else result.errors.push(`${rowLabel}: unknown custodian "${row['Custodian']}"`);
        }

        if (row['Category']) {
          const catId = categoryByName.get(row['Category'].toLowerCase());
          if (catId) data.categoryId = catId;
          else result.errors.push(`${rowLabel}: unknown category "${row['Category']}"`);
        }

        // Host Name — resolve or create
        if (row['Host Name']) {
          const existing = hostNameByName.get(row['Host Name'].toLowerCase());
          if (existing) {
            data.hostNameId = existing.id;
          } else {
            const created = await this.prisma.hostName.create({ data: { name: row['Host Name'] } });
            data.hostNameId = created.id;
            hostNameByName.set(row['Host Name'].toLowerCase(), { ...created, computerId: null });
          }
        }

        const existingId = row['ID'] ? parseInt(row['ID'], 10) : null;

        if (existingId && !isNaN(existingId)) {
          // Update existing computer
          const existing = await this.prisma.computer.findUnique({ where: { id: existingId } });
          if (!existing) {
            result.errors.push(`${rowLabel}: computer ID ${existingId} not found, skipping`);
            result.skipped++;
            continue;
          }
          await this.prisma.computer.update({ where: { id: existingId }, data });
          if (data.hostNameId) {
            await this.prisma.hostName.update({ where: { id: data.hostNameId }, data: { computerId: existingId } });
          }
          await this.audit.write({
            userId, objectType: 'Computer', objectId: existingId,
            field: 'csv-import', oldValue: null, newValue: JSON.stringify(data),
          });
          result.updated++;
        } else {
          // Create new computer
          const computer = await this.prisma.computer.create({ data });
          if (data.hostNameId) {
            await this.prisma.hostName.update({ where: { id: data.hostNameId }, data: { computerId: computer.id } });
          }
          await this.audit.write({
            userId, objectType: 'Computer', objectId: computer.id,
            field: 'csv-import', oldValue: null, newValue: JSON.stringify(data),
          });
          result.created++;
        }
      } catch (e: any) {
        result.errors.push(`${rowLabel}: ${e.message}`);
      }
    }

    return result;
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current);
    return result;
  }

  private getHeaders(sheet: ExcelJS.Worksheet): string[] {
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = String(cell.value || '');
    });
    return headers;
  }

  private rowToObject(row: ExcelJS.Row, headers: string[]): Record<string, string> {
    const obj: Record<string, string> = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        obj[header] = cell.value != null ? String(cell.value) : '';
      }
    });
    return obj;
  }
}
