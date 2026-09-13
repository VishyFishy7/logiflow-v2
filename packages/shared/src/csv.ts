/**
 * CSV export helpers — PRD §9.8. Values that begin with `=`, `+`, `-` or `@`
 * are escaped so a spreadsheet cannot interpret an exported field as a formula
 * (formula injection). Everything is quoted per RFC 4180.
 */

const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (text.length > 0 && FORMULA_PREFIXES.includes(text[0] as string)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export interface CsvColumn<T> {
  id: string;
  header: string;
  value: (row: T) => unknown;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const head = columns.map((column) => escapeCsvCell(column.header)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvCell(column.value(row))).join(","),
  );
  return [head, ...body].join("\r\n");
}

/** JSON Lines — used by `/audit/export.json` for compliance handoff. */
export function toJsonLines(rows: readonly unknown[]): string {
  return rows.map((row) => JSON.stringify(row)).join("\n");
}

/** `filename="logiflow-shipments-2026-09-13.csv"` for a Content-Disposition. */
export function exportFilename(prefix: string, now = Date.now()): string {
  const date = new Date(now).toISOString().slice(0, 10);
  return `${prefix}-${date}`;
}
