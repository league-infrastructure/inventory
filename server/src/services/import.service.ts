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
