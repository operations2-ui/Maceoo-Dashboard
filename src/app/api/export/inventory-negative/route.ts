import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getCurrentInventory } from "@/lib/reports";
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

  const rows = await getCurrentInventory(storeIds, date);
  const csv = toCsv(
    ["Store", "SKU", "Style", "Size", "Description", "Vendor", "On Hand"],
    rows,
    ["store_name", "sku", "style_code", "size_code", "description", "vendor", "on_hand"],
  );
  return csvResponse(`current-inventory_${date}.csv`, csv);
}
