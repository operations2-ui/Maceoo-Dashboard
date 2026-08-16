/** Parses a date cell that may be ISO (2026-08-06) or a human format (Aug 6, 2026) into YYYY-MM-DD. */
export function parseFlexibleDate(raw: string): string {
  const trimmed = raw.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Could not parse date "${raw}"`);
  }
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parses a date cell shaped "A-B-YYYY" into YYYY-MM-DD. Distinct from
 * parseFlexibleDate, which assumes ISO or US (MM/DD/YYYY) input. Most values
 * in this sheet are day-first (e.g. "27-01-2025", "24-02-2026" — a first
 * segment >12 rules out a month-first reading) but some rows are genuinely
 * month-first (e.g. a raw "02-25-2026", where 25 can only be a day) — the
 * source mixes both, not something fixable by picking one fixed format,
 * so whichever segment is unambiguously >12 is treated as the day; when
 * both segments are <=12 (genuinely ambiguous), defaults to day-first to
 * match the majority of observed values. Returns null for a blank cell,
 * an unparseable one, or a formula-error artifact like "#VALUE!" (this
 * sheet has some) rather than throwing — one bad row shouldn't abort
 * importing the rest.
 */
export function parseDDMMYYYY(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const match = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!match) return null;
  const [, aStr, bStr, y] = match;
  const a = Number(aStr);
  const b = Number(bStr);
  // Default day-first (a, b); swap when only the month-first reading is valid.
  const [day, month] = a <= 12 && b > 12 ? [b, a] : [a, b];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
