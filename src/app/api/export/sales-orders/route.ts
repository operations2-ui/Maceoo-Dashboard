import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getSalesOrders } from "@/lib/reports";
import { toCsv, csvResponse } from "@/lib/csv-export";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const store = searchParams.get("store");
  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");
  if (!fromDate || !toDate) return NextResponse.json({ error: "from and to are required" }, { status: 400 });

  const stores = await getAccessibleStores(user);
  const allowedIds = stores.map((s) => s.id);
  const storeIds = store && store !== "all" && allowedIds.includes(store) ? [store] : allowedIds;

  const rows = await getSalesOrders(storeIds, fromDate, toDate);
  const csv = toCsv(
    ["Date", "Store", "Order", "User", "Gross Sales", "Discounts", "Refunds", "Net Sales", "Discount %"],
    rows,
    ["day_date", "store_name", "order_name", "user_name", "gross_sales", "discounts", "refunds", "net_sales", "discount_pct"],
  );
  return csvResponse(`sales-orders_${fromDate}_to_${toDate}.csv`, csv);
}
