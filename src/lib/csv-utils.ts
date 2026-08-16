import Papa from "papaparse";

export function parseRawCsv(csvText: string): string[][] {
  const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: false });
  return parsed.data;
}

/** Finds the first row containing a cell matching `mustInclude` (case-insensitive, trimmed). */
export function findHeaderRowIndex(rows: string[][], mustInclude: string): number {
  const target = mustInclude.trim().toLowerCase();
  return rows.findIndex((row) => row.some((cell) => (cell ?? "").trim().toLowerCase() === target));
}

/** Maps lowercased/trimmed header name -> column index. */
export function buildHeaderIndex(headerRow: string[]): Record<string, number> {
  const index: Record<string, number> = {};
  headerRow.forEach((cell, i) => {
    const key = (cell ?? "").trim().toLowerCase();
    if (key) index[key] = i;
  });
  return index;
}

export function cell(row: string[], headerIndex: Record<string, number>, name: string): string {
  const i = headerIndex[name.trim().toLowerCase()];
  return i === undefined ? "" : (row[i] ?? "").trim();
}

/** Parses numbers that may be formatted as currency, e.g. "$1,234.56" or "-$798.88". */
export function numOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const cleaned = trimmed.replace(/[$,\s]/g, "");
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

export function intOrNull(value: string): number | null {
  const n = numOrNull(value);
  return n === null ? null : Math.trunc(n);
}

/**
 * Serializes a 2D array (e.g. from the Sheets API, or rows destined for
 * `COPY ... WITH (FORMAT csv)`) back to CSV text, so it can reuse the CSV
 * parsers. Empty strings are always quoted (`""`) rather than left bare,
 * since Postgres COPY treats an unquoted empty field as SQL NULL rather than
 * an empty string — quoting keeps "no value" and "empty string" distinct.
 */
export function rowsToCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cellValue) => {
          const s = cellValue ?? "";
          return s === "" || /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
}

/**
 * Like rowsToCsv, but for COPY-loading tables with nullable numeric/date
 * columns. rowsToCsv always quotes blanks as `""`, which COPY reads as the
 * literal empty string — invalid for a numeric/date column. Here, null
 * becomes a genuinely empty (unquoted) field, which COPY's CSV format reads
 * as SQL NULL — while an empty *string* value (as opposed to null) is always
 * quoted as `""` so it round-trips as an empty string, not NULL. Getting
 * this distinction wrong silently turns "" into NULL for every column,
 * which only surfaces as an error on a NOT NULL text column (e.g.
 * sales_by_user.user_name) — other nullable text columns would accept it
 * silently and just be wrong.
 */
export function rowsToCsvNullable(rows: (string | number | null)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cellValue) => {
          if (cellValue === null || cellValue === undefined) return "";
          if (typeof cellValue === "number") return String(cellValue);
          return `"${cellValue.replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");
}
