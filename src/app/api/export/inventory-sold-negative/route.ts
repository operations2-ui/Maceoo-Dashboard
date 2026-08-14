import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getSoldNegative } from "@/lib/reports";
import { toCsv, csvResponse } from "@/lib/csv-export";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const store = searchParams.get("store");
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });

  const stores = await getAccessibleStores(user);
  const allowedIds = stores.map((s) => s.id);
  const storeIds = store && store !== "all" && allowedIds.includes(store) ? [store] : allowedIds;

  const rows = await getSoldNegative(storeIds, date);
  const csv = toCsv(
    ["Store", "SKU", "Style", "Size", "Description", "Prev On Hand", "Curr On Hand", "Items Sold"],
    rows,
    ["store_name", "sku", "style_code", "size_code", "description", "prev_on_hand", "curr_on_hand", "items_sold"],
  );
  return csvResponse(`prior-day-oversell_${date}.csv`, csv);
}
