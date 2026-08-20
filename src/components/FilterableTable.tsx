"use client";

import { useMemo, useState } from "react";
import DataTable, { type Column } from "./DataTable";

export interface SelectFilter<T> {
  type: "select";
  key: string;
  label: string;
  value: (row: T) => string;
}
export interface NumberFilter<T> {
  type: "numberMin" | "numberMax";
  key: string;
  label: string;
  value: (row: T) => number;
}
export type FilterConfig<T> = SelectFilter<T> | NumberFilter<T>;

export default function FilterableTable<T extends Record<string, unknown>>({
  rows,
  columns,
  searchKeys,
  searchPlaceholder = "Search...",
  filters = [],
  emptyMessage,
  totals,
}: {
  rows: T[];
  columns: Column<T>[];
  searchKeys: (keyof T & string)[];
  searchPlaceholder?: string;
  filters?: FilterConfig<T>[];
  emptyMessage?: string;
  /** Computes the pinned totals row from whatever's currently visible (after search/filters), so it tracks them. */
  totals?: (visibleRows: T[]) => Record<string, React.ReactNode>;
}) {
  const [search, setSearch] = useState("");
  const [selectValues, setSelectValues] = useState<Record<string, string>>({});
  const [numberValues, setNumberValues] = useState<Record<string, string>>({});

  const selectOptions = useMemo(() => {
    const opts: Record<string, string[]> = {};
    for (const f of filters) {
      if (f.type === "select") {
        opts[f.key] = [...new Set(rows.map((r) => f.value(r)).filter((v) => v !== "" && v != null))].sort();
      }
    }
    return opts;
  }, [rows, filters]);

  const filteredRows = useMemo(() => {
    let result = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((r) => searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q)));
    }
    for (const f of filters) {
      if (f.type === "select") {
        const val = selectValues[f.key];
        if (val) result = result.filter((r) => f.value(r) === val);
      } else if (f.type === "numberMin") {
        const val = numberValues[f.key];
        if (val !== undefined && val !== "") result = result.filter((r) => f.value(r) >= Number(val));
      } else if (f.type === "numberMax") {
        const val = numberValues[f.key];
        if (val !== undefined && val !== "") result = result.filter((r) => f.value(r) <= Number(val));
      }
    }
    return result;
  }, [rows, search, filters, selectValues, numberValues]);

  const hasActiveFilters = search !== "" || Object.values(selectValues).some(Boolean) || Object.values(numberValues).some((v) => v !== undefined && v !== "");

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 text-sm w-56"
          />
        </div>
        {filters.map((f) =>
          f.type === "select" ? (
            <div key={f.key}>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{f.label}</label>
              <select
                value={selectValues[f.key] ?? ""}
                onChange={(e) => setSelectValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-2 py-1.5 text-sm"
              >
                <option value="">All</option>
                {(selectOptions[f.key] ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div key={f.key}>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{f.label}</label>
              <input
                type="number"
                value={numberValues[f.key] ?? ""}
                onChange={(e) => setNumberValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-2 py-1.5 text-sm w-28"
              />
            </div>
          ),
        )}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setSelectValues({});
              setNumberValues({});
            }}
            className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline"
          >
            Clear filters
          </button>
        )}
        <span className="text-sm text-slate-500 dark:text-slate-400 w-full sm:w-auto sm:ml-auto">
          {hasActiveFilters ? (
            <>
              {filteredRows.length.toLocaleString("en-US")} of {rows.length.toLocaleString("en-US")} rows
            </>
          ) : (
            <>{rows.length.toLocaleString("en-US")} rows</>
          )}
        </span>
      </div>
      <DataTable
        rows={filteredRows}
        columns={columns}
        emptyMessage={emptyMessage}
        totals={totals ? totals(filteredRows) : undefined}
      />
    </div>
  );
}
