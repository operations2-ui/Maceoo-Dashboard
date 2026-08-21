import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import {
  getSales,
  getDiscounts,
  getInventoryAlertSummary,
  getDistinctOrderCount,
  type SalesRow,
  type DiscountRow,
} from "@/lib/reports";
import { StoreDateRangeFilter } from "@/components/FilterForm";
import StatTile from "@/components/StatTile";
import SalesByStoreBar from "@/components/SalesByStoreBar";
import OverviewSalesTrend from "@/components/OverviewSalesTrend";
import LeagueTable from "@/components/LeagueTable";

const DEFAULT_PERIOD_DAYS = 30;
const dayMs = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const money = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

/** "Jul 14 – Aug 13, 2026" (year on the end date only, unless the range crosses a year boundary). */
function formatDateRange(fromIso: string, toIso: string): string {
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  const sameYear = from.getFullYear() === to.getFullYear();
  const fromLabel = from.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  const toLabel = to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fromLabel} – ${toLabel}`;
}

/**
 * Same month/day, `delta` calendar years away — used to get "same period
 * last year" rather than a fixed -365 days (which would drift across a leap
 * year). Built entirely from UTC date parts (Date.UTC + setUTCFullYear):
 * parsing "YYYY-MM-DDT00:00:00" without a zone reads as local time, and
 * re-serializing via toISOString() converts back through UTC — on a
 * non-UTC host that silently shifts the result a day. This function never
 * touches local time at all.
 */
function shiftYear(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCFullYear(date.getUTCFullYear() + delta);
  return date.toISOString().slice(0, 10);
}

// Deliberately excludes total_orders — sales_daily.total_orders is a
// correct distinct-order count for a single day, but summing it across
// multiple days over-counts any order whose lines land on different days
// within the period (e.g. sold one day, refunded a later one). Period-level
// order counts come from getDistinctOrderCount (sales_orders) instead.
function sumSales(rows: SalesRow[]) {
  return rows.reduce(
    (acc, r) => ({
      netSales: acc.netSales + Number(r.net_sales ?? 0),
      grossMargin: acc.grossMargin + Number(r.gross_margin ?? 0),
    }),
    { netSales: 0, grossMargin: 0 },
  );
}

const sumDiscounts = (rows: DiscountRow[]) => rows.reduce((sum, r) => sum + Number(r.total_discounts ?? 0), 0);

/** % change vs the same period last year; null when there's no baseline to compare against. */
function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; from?: string; to?: string }>;
}) {
  const { store, from, to } = await searchParams;
  const user = await getCurrentUser();
  const stores = await getAccessibleStores(user);
  const allowedIds = stores.map((s) => s.id);
  const storeIds = store && store !== "all" && allowedIds.includes(store) ? [store] : allowedIds;

  // Ends at yesterday, not today — today's sync hasn't necessarily run yet,
  // so a "through today" window would silently under-report its own last day.
  const yesterday = isoDate(new Date(Date.now() - dayMs));
  const defaultFrom = isoDate(new Date(Date.now() - (DEFAULT_PERIOD_DAYS + 1) * dayMs));
  const fromDate = from ?? defaultFrom;
  const toDate = to ?? yesterday;

  // Same period, one calendar year earlier — more useful for retail
  // seasonality than the immediately-preceding period would be.
  const prevFromDate = shiftYear(fromDate, -1);
  const prevToDate = shiftYear(toDate, -1);

  const [salesRows, discountRows, prevSalesRows, prevDiscountRows, alerts, orderCount, prevOrderCount] =
    await Promise.all([
      getSales(storeIds, fromDate, toDate),
      getDiscounts(storeIds, fromDate, toDate),
      getSales(storeIds, prevFromDate, prevToDate),
      getDiscounts(storeIds, prevFromDate, prevToDate),
      getInventoryAlertSummary(storeIds),
      getDistinctOrderCount(storeIds, fromDate, toDate),
      getDistinctOrderCount(storeIds, prevFromDate, prevToDate),
    ]);

  const totals = sumSales(salesRows);
  const prevTotals = sumSales(prevSalesRows);
  const totalDiscounts = sumDiscounts(discountRows);
  const prevTotalDiscounts = sumDiscounts(prevDiscountRows);
  const avgOrderValue = orderCount > 0 ? totals.netSales / orderCount : 0;
  const prevAvgOrderValue = prevOrderCount > 0 ? prevTotals.netSales / prevOrderCount : 0;

  const byStore = new Map<string, number>();
  for (const r of salesRows) byStore.set(r.store_name, (byStore.get(r.store_name) ?? 0) + Number(r.net_sales ?? 0));
  const salesByStore = [...byStore.entries()].map(([store, value]) => ({ store, value }));

  const byDate = new Map<string, number>();
  for (const r of salesRows) byDate.set(r.order_date, (byDate.get(r.order_date) ?? 0) + Number(r.net_sales ?? 0));
  const trend = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date: date.slice(5), value }));

  const leagueRows = [...byStore.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([store, value], i) => ({ rank: i + 1, label: store, value: money(value) }));

  const comparisonLabel = formatDateRange(prevFromDate, prevToDate);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">Overview</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Compared to the same period last year, {formatDateRange(prevFromDate, prevToDate)}.
      </p>
      <StoreDateRangeFilter stores={stores} store={store} from={fromDate} to={toDate} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <StatTile
          label="Net sales"
          value={money(totals.netSales)}
          deltaPct={pctDelta(totals.netSales, prevTotals.netSales)}
          comparisonLabel={comparisonLabel}
        />
        <StatTile
          label="Total orders"
          value={orderCount.toLocaleString("en-US")}
          deltaPct={pctDelta(orderCount, prevOrderCount)}
          comparisonLabel={comparisonLabel}
        />
        <StatTile
          label="Gross margin"
          value={money(totals.grossMargin)}
          deltaPct={pctDelta(totals.grossMargin, prevTotals.grossMargin)}
          comparisonLabel={comparisonLabel}
        />
        <StatTile
          label="Average order value"
          value={money(avgOrderValue)}
          deltaPct={pctDelta(avgOrderValue, prevAvgOrderValue)}
          comparisonLabel={comparisonLabel}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatTile
          label="Discounts given"
          value={money(totalDiscounts)}
          deltaPct={pctDelta(totalDiscounts, prevTotalDiscounts)}
          comparisonLabel={comparisonLabel}
          deltaGoodDirection="down"
          href="/sales"
        />
        <StatTile
          label="Negative inventory"
          value={alerts.negativeCount == null ? "—" : alerts.negativeCount.toLocaleString("en-US")}
          tone={alerts.negativeCount != null && alerts.negativeCount > 0 ? "critical" : "default"}
          href="/inventory/negative"
        />
        <StatTile
          label="Missing size styles"
          value={alerts.missingSizeStyleCount == null ? "—" : alerts.missingSizeStyleCount.toLocaleString("en-US")}
          tone={alerts.missingSizeStyleCount != null && alerts.missingSizeStyleCount > 0 ? "warning" : "default"}
          href="/inventory/missing-sizes"
        />
        <StatTile
          label="Inventory as of"
          value={alerts.latestDate ?? "—"}
          href="/inventory/sold-negative"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <OverviewSalesTrend rows={trend} />
          <SalesByStoreBar rows={salesByStore} />
        </div>
        <div>
          <LeagueTable title="Top stores by net sales" rows={leagueRows} />
        </div>
      </div>
    </div>
  );
}
