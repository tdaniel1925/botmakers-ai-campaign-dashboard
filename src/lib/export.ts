/**
 * Export utilities for CSV and Excel
 */

interface ExportColumn<T> {
  header: string;
  accessor: keyof T | ((row: T) => string | number | boolean | null | undefined);
  format?: (value: unknown) => string;
}

/**
 * Convert data to CSV format
 */
export function toCSV<T>(
  data: T[],
  columns: ExportColumn<T>[]
): string {
  if (data.length === 0) return "";

  // Create header row
  const headers = columns.map((col) => escapeCSVField(col.header));
  const headerRow = headers.join(",");

  // Create data rows
  const dataRows = data.map((row) => {
    return columns
      .map((col) => {
        let value: unknown;

        if (typeof col.accessor === "function") {
          value = col.accessor(row);
        } else {
          value = row[col.accessor];
        }

        if (col.format) {
          value = col.format(value);
        }

        return escapeCSVField(String(value ?? ""));
      })
      .join(",");
  });

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Escape CSV field (handle quotes and commas)
 */
function escapeCSVField(field: string): string {
  // If field contains comma, newline, or quote, wrap in quotes and escape quotes
  if (field.includes(",") || field.includes("\n") || field.includes('"')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Download data as CSV file
 */
export function downloadCSV<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
): void {
  const csv = toCSV(data, columns);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Convert data to Excel-compatible XML format (simple XLSX alternative)
 */
export function toExcelXML<T>(
  data: T[],
  columns: ExportColumn<T>[],
  sheetName: string = "Sheet1"
): string {
  const headers = columns.map((col) => col.header);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#f3f4f6" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Date">
   <NumberFormat ss:Format="Short Date"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXML(sheetName)}">
  <Table>`;

  // Header row
  xml += `\n   <Row ss:StyleID="Header">`;
  for (const header of headers) {
    xml += `\n    <Cell><Data ss:Type="String">${escapeXML(header)}</Data></Cell>`;
  }
  xml += `\n   </Row>`;

  // Data rows
  for (const row of data) {
    xml += `\n   <Row>`;
    for (const col of columns) {
      let value: unknown;

      if (typeof col.accessor === "function") {
        value = col.accessor(row);
      } else {
        value = row[col.accessor];
      }

      if (col.format) {
        value = col.format(value);
      }

      const type = getExcelType(value);
      const displayValue = value ?? "";

      xml += `\n    <Cell><Data ss:Type="${type}">${escapeXML(String(displayValue))}</Data></Cell>`;
    }
    xml += `\n   </Row>`;
  }

  xml += `\n  </Table>
 </Worksheet>
</Workbook>`;

  return xml;
}

/**
 * Get Excel data type for a value
 */
function getExcelType(value: unknown): string {
  if (typeof value === "number") return "Number";
  if (typeof value === "boolean") return "Boolean";
  if (value instanceof Date) return "DateTime";
  return "String";
}

/**
 * Escape XML special characters
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Download data as Excel file (XML format, opens in Excel)
 */
export function downloadExcel<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
  sheetName?: string
): void {
  const xml = toExcelXML(data, columns, sheetName);
  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  downloadBlob(blob, `${filename}.xls`);
}

/**
 * Download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format date for export
 */
export function formatDateForExport(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

/**
 * Format datetime for export
 */
export function formatDateTimeForExport(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().replace("T", " ").slice(0, 19);
}

/**
 * Format currency for export
 */
export function formatCurrencyForExport(
  amount: number | null | undefined,
  currency: string = "USD"
): string {
  if (amount === null || amount === undefined) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Format duration (seconds) for export
 */
export function formatDurationForExport(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Common export column helpers
export const exportHelpers = {
  date: (accessor: string) => ({
    accessor: (row: Record<string, unknown>) => row[accessor],
    format: (value: unknown) => formatDateForExport(value as Date | string),
  }),
  datetime: (accessor: string) => ({
    accessor: (row: Record<string, unknown>) => row[accessor],
    format: (value: unknown) => formatDateTimeForExport(value as Date | string),
  }),
  currency: (accessor: string, currency?: string) => ({
    accessor: (row: Record<string, unknown>) => row[accessor],
    format: (value: unknown) => formatCurrencyForExport(value as number, currency),
  }),
  duration: (accessor: string) => ({
    accessor: (row: Record<string, unknown>) => row[accessor],
    format: (value: unknown) => formatDurationForExport(value as number),
  }),
  boolean: (accessor: string, trueLabel = "Yes", falseLabel = "No") => ({
    accessor: (row: Record<string, unknown>) => row[accessor],
    format: (value: unknown) => (value ? trueLabel : falseLabel),
  }),
};
