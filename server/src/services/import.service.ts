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

export interface ComputerCsvDiffField {
  field: string;
  dbValue: string;
  csvValue: string;
  changed: boolean;
}

export interface ComputerCsvDiffRow {
  csvRowIndex: number;
  matchedId: number | null;
  hostName: string;
  serialNumber: string;
  action: 'create' | 'update' | 'skip';
  fields: ComputerCsvDiffField[];
  error?: string;
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

  private static readonly REQUIRED_HEADERS = ['Host Name', 'Serial Number', 'Disposition'];

  private parseCsvRows(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new ValidationError('CSV must have a header row and at least one data row');

    // Find the header row — scan for a line containing known column names
    let headerIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const cells = this.parseCsvLine(lines[i]).map(c => c.trim());
      if (ImportService.REQUIRED_HEADERS.every(h => cells.includes(h))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      throw new ValidationError(
        'Could not find header row. CSV must contain columns: ' +
        ImportService.REQUIRED_HEADERS.join(', ')
      );
    }

    const headers = this.parseCsvLine(lines[headerIdx]).map(h => h.trim());
    const rows: Record<string, string>[] = [];

    // Parse all non-header lines (before and after the header row)
    for (let i = 0; i < lines.length; i++) {
      if (i === headerIdx) continue;
      const values = this.parseCsvLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim(); });
      // Skip rows that look empty (no host name and no serial number)
      if (!row['Host Name'] && !row['Serial Number'] && !row['ID']) continue;
      rows.push(row);
    }
    return { headers, rows };
  }

  private async buildLookupMaps() {
    const [sites, kits, osList, users, categories] = await Promise.all([
      this.prisma.site.findMany({ select: { id: true, name: true } }),
      this.prisma.kit.findMany({ select: { id: true, number: true, name: true } }),
      this.prisma.operatingSystem.findMany({ select: { id: true, name: true } }),
      this.prisma.user.findMany({ select: { id: true, displayName: true } }),
      this.prisma.category.findMany({ select: { id: true, name: true } }),
    ]);
    return {
      siteByName: new Map(sites.map(s => [s.name.toLowerCase(), s.id])),
      siteById: new Map(sites.map(s => [s.id, s.name])),
      kitByNumber: new Map(kits.map(k => [k.number, k])),
      kitById: new Map(kits.map(k => [k.id, k])),
      osByName: new Map(osList.map(o => [o.name.toLowerCase(), o.id])),
      osById: new Map(osList.map(o => [o.id, o.name])),
      userByName: new Map(users.map(u => [u.displayName.toLowerCase(), u.id])),
      userById: new Map(users.map(u => [u.id, u.displayName])),
      categoryByName: new Map(categories.map(c => [c.name.toLowerCase(), c.id])),
      categoryById: new Map(categories.map(c => [c.id, c.name])),
    };
  }

  // Display fields shown in the diff (CSV column name → how to read from DB record)
  private static readonly DISPLAY_FIELDS: { csvCol: string; dbKey: string }[] = [
    { csvCol: 'Manufacturer', dbKey: 'manufacturer' },
    { csvCol: 'Model', dbKey: 'model' },
    { csvCol: 'Model Number', dbKey: 'modelNumber' },
    { csvCol: 'Operating System', dbKey: '_os' },
    { csvCol: 'Manufactured Year', dbKey: 'manufacturedYear' },
    { csvCol: 'Serial Number', dbKey: 'serialNumber' },
    { csvCol: 'Service Tag', dbKey: 'serviceTag' },
    { csvCol: 'Disposition', dbKey: 'disposition' },
    { csvCol: 'Site', dbKey: '_site' },
    { csvCol: 'Kit', dbKey: '_kit' },
    { csvCol: 'Custodian', dbKey: '_custodian' },
    { csvCol: 'Category', dbKey: '_category' },
    { csvCol: 'Admin Username', dbKey: 'adminUsername' },
    { csvCol: 'Admin Password', dbKey: 'adminPassword' },
    { csvCol: 'Student Username', dbKey: 'studentUsername' },
    { csvCol: 'Student Password', dbKey: 'studentPassword' },
    { csvCol: 'Date Received', dbKey: 'dateReceived' },
    { csvCol: 'Notes', dbKey: 'notes' },
  ];

  async previewComputersCsv(csvText: string, matchBy: 'hostName' | 'serialNumber'): Promise<ComputerCsvDiffRow[]> {
    const { rows } = this.parseCsvRows(csvText);
    const lookups = await this.buildLookupMaps();

    // Load all computers with relations for display
    const allComputers = await this.prisma.computer.findMany({
      include: {
        hostName: { select: { name: true } },
        site: { select: { id: true, name: true } },
        kit: { select: { id: true, number: true, name: true } },
        os: { select: { id: true, name: true } },
        custodian: { select: { id: true, displayName: true } },
        category: { select: { id: true, name: true } },
      },
    });

    const computerByHostName = new Map(
      allComputers.filter(c => c.hostName?.name).map(c => [c.hostName!.name.toLowerCase(), c])
    );
    const computerBySerial = new Map(
      allComputers.filter(c => c.serialNumber).map(c => [c.serialNumber!.toLowerCase(), c])
    );

    const diffs: ComputerCsvDiffRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const csvHostName = row['Host Name'] || '';
      const csvSerial = row['Serial Number'] || '';

      // Find matching DB record
      let matched: typeof allComputers[0] | undefined;
      if (matchBy === 'hostName' && csvHostName) {
        matched = computerByHostName.get(csvHostName.toLowerCase());
      } else if (matchBy === 'serialNumber' && csvSerial) {
        matched = computerBySerial.get(csvSerial.toLowerCase());
      }

      const diff: ComputerCsvDiffRow = {
        csvRowIndex: i,
        matchedId: matched?.id ?? null,
        hostName: csvHostName,
        serialNumber: csvSerial,
        action: matched ? 'update' : 'create',
        fields: [],
      };

      // Build field-by-field diff
      for (const { csvCol, dbKey } of ImportService.DISPLAY_FIELDS) {
        const csvVal = row[csvCol] || '';
        let dbVal = '';
        if (matched) {
          if (dbKey === '_site') dbVal = matched.site?.name || '';
          else if (dbKey === '_kit') dbVal = matched.kit ? `#${matched.kit.number} ${matched.kit.name}` : '';
          else if (dbKey === '_os') dbVal = matched.os?.name || '';
          else if (dbKey === '_custodian') dbVal = matched.custodian?.displayName || '';
          else if (dbKey === '_category') dbVal = matched.category?.name || '';
          else if (dbKey === 'dateReceived') dbVal = matched.dateReceived ? matched.dateReceived.toISOString().split('T')[0] : '';
          else if (dbKey === 'manufacturedYear') dbVal = matched.manufacturedYear != null ? String(matched.manufacturedYear) : '';
          else dbVal = (matched as any)[dbKey] || '';
        }
        diff.fields.push({
          field: csvCol,
          dbValue: dbVal,
          csvValue: csvVal,
          changed: csvVal !== '' && csvVal !== dbVal,
        });
      }

      diffs.push(diff);
    }

    return diffs;
  }

  async applyComputersCsv(csvText: string, matchBy: 'hostName' | 'serialNumber', userId: number): Promise<ImportResult> {
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
    const { rows } = this.parseCsvRows(csvText);
    const lookups = await this.buildLookupMaps();

    const hostNames = await this.prisma.hostName.findMany({ select: { id: true, name: true, computerId: true } });
    const hostNameByName = new Map(hostNames.map(h => [h.name.toLowerCase(), h]));

    const allComputers = await this.prisma.computer.findMany({
      include: {
        hostName: { select: { name: true } },
      },
    });
    const computerByHostName = new Map(
      allComputers.filter(c => c.hostName?.name).map(c => [c.hostName!.name.toLowerCase(), c])
    );
    const computerBySerial = new Map(
      allComputers.filter(c => c.serialNumber).map(c => [c.serialNumber!.toLowerCase(), c])
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const csvHostName = row['Host Name'] || '';
      const csvSerial = row['Serial Number'] || '';
      const rowLabel = csvHostName || csvSerial || `row ${i + 2}`;

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

        if (row['Manufactured Year']) {
          const yr = parseInt(row['Manufactured Year'], 10);
          if (!isNaN(yr)) data.manufacturedYear = yr;
        }
        if (row['Date Received']) data.dateReceived = new Date(row['Date Received']);
        if (row['Last Inventoried']) data.lastInventoried = new Date(row['Last Inventoried']);

        // Resolve names → IDs
        if (row['Site']) {
          const siteId = lookups.siteByName.get(row['Site'].toLowerCase());
          if (siteId) data.siteId = siteId;
          else result.errors.push(`${rowLabel}: unknown site "${row['Site']}"`);
        }
        if (row['Kit']) {
          const kitMatch = row['Kit'].match(/^#?(\d+)/);
          if (kitMatch) {
            const kit = lookups.kitByNumber.get(parseInt(kitMatch[1], 10));
            if (kit) data.kitId = kit.id;
            else result.errors.push(`${rowLabel}: unknown kit "${row['Kit']}"`);
          }
        }
        if (row['Operating System']) {
          const osId = lookups.osByName.get(row['Operating System'].toLowerCase());
          if (osId) data.osId = osId;
          else result.errors.push(`${rowLabel}: unknown OS "${row['Operating System']}"`);
        }
        if (row['Custodian']) {
          const custId = lookups.userByName.get(row['Custodian'].toLowerCase());
          if (custId) data.custodianId = custId;
          else result.errors.push(`${rowLabel}: unknown custodian "${row['Custodian']}"`);
        }
        if (row['Category']) {
          const catId = lookups.categoryByName.get(row['Category'].toLowerCase());
          if (catId) data.categoryId = catId;
          else result.errors.push(`${rowLabel}: unknown category "${row['Category']}"`);
        }
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

        // Match existing computer
        let matched: typeof allComputers[0] | undefined;
        if (matchBy === 'hostName' && csvHostName) {
          matched = computerByHostName.get(csvHostName.toLowerCase());
        } else if (matchBy === 'serialNumber' && csvSerial) {
          matched = computerBySerial.get(csvSerial.toLowerCase());
        }

        if (matched) {
          // Update — convert FK fields to relation syntax
          const updateData: any = { ...data };
          const fkToRelation: Record<string, string> = {
            siteId: 'site', kitId: 'kit', osId: 'os',
            custodianId: 'custodian', categoryId: 'category', hostNameId: 'hostName',
          };
          for (const [fk, rel] of Object.entries(fkToRelation)) {
            if (fk in updateData) {
              const val = updateData[fk];
              delete updateData[fk];
              updateData[rel] = val != null ? { connect: { id: val } } : { disconnect: true };
            }
          }
          await this.prisma.computer.update({ where: { id: matched.id }, data: updateData });
          await this.audit.write({
            userId, objectType: 'Computer', objectId: matched.id,
            field: 'csv-import', oldValue: null, newValue: JSON.stringify(data),
          });
          result.updated++;
        } else {
          // Create — convert FK fields to relation syntax
          const createData: any = { ...data };
          const fkToRelation: Record<string, string> = {
            siteId: 'site', kitId: 'kit', osId: 'os',
            custodianId: 'custodian', categoryId: 'category', hostNameId: 'hostName',
          };
          for (const [fk, rel] of Object.entries(fkToRelation)) {
            if (fk in createData) {
              const val = createData[fk];
              delete createData[fk];
              if (val != null) createData[rel] = { connect: { id: val } };
            }
          }
          const computer = await this.prisma.computer.create({ data: createData });
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
