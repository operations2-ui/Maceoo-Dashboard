import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getSales, getDiscounts, getInventoryAlertSummary, type SalesRow, type DiscountRow } from "@/lib/reports";
import StatTile from "@/components/StatTile";
import SalesByStoreBar from "@/components/SalesByStoreBar";
import OverviewSalesTrend from "@/components/OverviewSalesTrend";
import LeagueTable from "@/components/LeagueTable";

const PERIOD_DAYS = 30;
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

function sumSales(rows: SalesRow[]) {
  return rows.reduce(
    (acc, r) => ({
      orders: acc.orders + (r.total_orders ?? 0),
      netSales: acc.netSales + Number(r.net_sales ?? 0),
      grossMargin: acc.grossMargin + Number(r.gross_margin ?? 0),
    }),
    { orders: 0, netSales: 0, grossMargin: 0 },
  );
}

const sumDiscounts = (rows: DiscountRow[]) => rows.reduce((sum, r) => sum + Number(r.total_discounts ?? 0), 0);

/** % change vs the previous equal-length period; null when there's no baseline to compare against. */
function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export default async function Home() {
  const user = await getCurrentUser();
  const stores = await getAccessibleStores(user);
  const storeIds = stores.map((s) => s.id);

  // Ends at yesterday, not today — today's sync hasn't necessarily run yet,
  // so a "through today" window would silently under-report its own last day.
  const anchor = new Date(Date.now() - dayMs);
  const toDate = isoDate(anchor);
  const fromDate = isoDate(new Date(anchor.getTime() - PERIOD_DAYS * dayMs));
  const prevToDate = isoDate(new Date(anchor.getTime() - (PERIOD_DAYS + 1) * dayMs));
  const prevFromDate = isoDate(new Date(anchor.getTime() - PERIOD_DAYS * 2 * dayMs));

  const [salesRows, discountRows, prevSalesRows, prevDiscountRows, alerts] = await Promise.all([
    getSales(storeIds, fromDate, toDate),
    getDiscounts(storeIds, fromDate, toDate),
    getSales(storeIds, prevFromDate, prevToDate),
    getDiscounts(storeIds, prevFromDate, prevToDate),
    getInventoryAlertSummary(storeIds),
  ]);

  const totals = sumSales(salesRows);
  const prevTotals = sumSales(prevSalesRows);
  const totalDiscounts = sumDiscounts(discountRows);
  const prevTotalDiscounts = sumDiscounts(prevDiscountRows);
  const avgOrderValue = totals.orders > 0 ? totals.netSales / totals.orders : 0;
  const prevAvgOrderValue = prevTotals.orders > 0 ? prevTotals.netSales / prevTotals.orders : 0;

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
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Overview</h1>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {formatDateRange(fromDate, toDate)}
        </span>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Last {PERIOD_DAYS} days across {stores.length} store{stores.length === 1 ? "" : "s"}.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <StatTile
          label="Net sales"
          value={money(totals.netSales)}
          deltaPct={pctDelta(totals.netSales, prevTotals.netSales)}
          comparisonLabel={comparisonLabel}
        />
        <StatTile
          label="Total orders"
          value={totals.orders.toLocaleString("en-US")}
          deltaPct={pctDelta(totals.orders, prevTotals.orders)}
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
          value={alerts.negativeCount.toLocaleString("en-US")}
          tone={alerts.negativeCount > 0 ? "critical" : "default"}
          href="/inventory/negative"
        />
        <StatTile
          label="Missing size styles"
          value={alerts.missingSizeStyleCount.toLocaleString("en-US")}
          tone={alerts.missingSizeStyleCount > 0 ? "warning" : "default"}
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
