import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

/** Canonical template headers (BR-B1), in order. */
export const TEMPLATE_HEADERS = [
  'external_row_id',
  'name',
  'rating_system_slug',
  'membership_level',
  'building_type',
  'number_of_units',
  'gross_area',
  'target_certification_level',
  'owner_name',
  'owner_email',
  'owner_phone',
  'owner_organization',
  'address_line1',
  'address_line2',
  'city',
  'region',
  'postal_code',
  'country',
  'latitude',
  'longitude',
  'payment_choice',
] as const;

export type TemplateHeader = (typeof TEMPLATE_HEADERS)[number];

const REQUIRED_HEADERS: TemplateHeader[] = [
  'external_row_id',
  'name',
  'rating_system_slug',
  'membership_level',
  'building_type',
  'gross_area',
  'owner_name',
  'owner_email',
  'address_line1',
  'city',
  'region',
  'postal_code',
  'country',
  'payment_choice',
];

export type ParsedRow = Record<TemplateHeader, string>;

/**
 * Pure-ish Excel parser (BR-B5). Reads an in-memory buffer via exceljs and
 * returns normalized rows. Header issues throw BadRequestException.
 */
export class BulkRegistrationParser {
  static async parseRows(buffer: Buffer): Promise<ParsedRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('The uploaded file has no worksheet');

    const headerRow = sheet.getRow(1);
    const headerMap = new Map<TemplateHeader, number>();
    headerRow.eachCell((cell, colNumber) => {
      const key = String(cell.value ?? '').trim().toLowerCase();
      if ((TEMPLATE_HEADERS as readonly string[]).includes(key)) {
        headerMap.set(key as TemplateHeader, colNumber);
      }
    });

    const missing = REQUIRED_HEADERS.filter((h) => !headerMap.has(h));
    if (missing.length > 0) {
      throw new BadRequestException(`Missing required columns: ${missing.join(', ')}`);
    }

    const rows: ParsedRow[] = [];
    for (let r = 2; r <= sheet.rowCount; r += 1) {
      const row = sheet.getRow(r);
      const parsed = BulkRegistrationParser.emptyRow();
      let hasAny = false;
      for (const header of TEMPLATE_HEADERS) {
        const col = headerMap.get(header);
        if (col === undefined) continue;
        const raw = row.getCell(col).value;
        const value = BulkRegistrationParser.cellToString(raw);
        parsed[header] = value;
        if (value.length > 0) hasAny = true;
      }
      if (hasAny) rows.push(BulkRegistrationParser.canonicalizeRow(parsed));
    }
    return rows;
  }

  /** Canonicalization used by the FL-2 round-trip property: trim + normalize enums. */
  static canonicalizeRow(row: ParsedRow): ParsedRow {
    const out = { ...row };
    for (const header of TEMPLATE_HEADERS) {
      out[header] = (out[header] ?? '').trim();
    }
    out.membership_level = out.membership_level.toUpperCase();
    out.building_type = out.building_type.toUpperCase();
    out.payment_choice = out.payment_choice.toUpperCase();
    out.country = out.country.toUpperCase();
    return out;
  }

  private static emptyRow(): ParsedRow {
    const row = {} as ParsedRow;
    for (const header of TEMPLATE_HEADERS) row[header] = '';
    return row;
  }

  private static cellToString(value: ExcelJS.CellValue): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') {
      const asRich = value as { text?: string; result?: unknown };
      if (typeof asRich.text === 'string') return asRich.text.trim();
      if (asRich.result !== undefined) return String(asRich.result).trim();
      return String(value).trim();
    }
    return String(value).trim();
  }
}
