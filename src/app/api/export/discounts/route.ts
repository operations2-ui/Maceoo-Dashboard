import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getDiscounts } from "@/lib/reports";
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

  const rows = await getDiscounts(storeIds, fromDate, toDate);
  const csv = toCsv(
    ["Date", "Store", "User", "Discount", "Amount", "Orders"],
    rows,
    ["day_date", "store_name", "user_name", "discount_name", "total_discounts", "total_orders"],
  );
  return csvResponse(`discounts_${fromDate}_to_${toDate}.csv`, csv);
}
