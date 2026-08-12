import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasStoreAccess } from "@/lib/authz";
import { getNegativeInventory } from "@/lib/reports";
import { toCsv, csvResponse } from "@/lib/csv-export";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("store");
  const date = searchParams.get("date");
  if (!storeId || !date) return NextResponse.json({ error: "store and date are required" }, { status: 400 });
  if (!(await hasStoreAccess(user, storeId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await getNegativeInventory(storeId, date);
  const csv = toCsv(
    ["SKU", "Style", "Size", "Description", "Vendor", "On Hand"],
    rows,
    ["sku", "style_code", "size_code", "description", "vendor", "on_hand"],
  );
  return csvResponse(`negative-inventory_${date}.csv`, csv);
}
