import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccessibleStores } from "@/lib/authz";
import { getMissingSizes } from "@/lib/reports";
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

  const rows = await getMissingSizes(storeIds, date);
  const csv = toCsv(
    ["Store", "Style", "Min Size", "Max Size", "Present Sizes", "Missing Sizes"],
    rows.map((r) => ({
      ...r,
      present_sizes: r.present_sizes.join(", "),
      missing_sizes: (r.missing_sizes ?? []).join(", "),
    })),
    ["store_name", "style_code", "min_size", "max_size", "present_sizes", "missing_sizes"],
  );
  return csvResponse(`missing-sizes_${date}.csv`, csv);
}
