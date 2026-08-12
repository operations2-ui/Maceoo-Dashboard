import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasStoreAccess } from "@/lib/authz";
import { getMissingSizes } from "@/lib/reports";
import { toCsv, csvResponse } from "@/lib/csv-export";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("store");
  const date = searchParams.get("date");
  if (!storeId || !date) return NextResponse.json({ error: "store and date are required" }, { status: 400 });
  if (!(await hasStoreAccess(user, storeId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await getMissingSizes(storeId, date);
  const csv = toCsv(
    ["Style", "Min Size", "Max Size", "Present Sizes", "Missing Sizes"],
    rows.map((r) => ({
      ...r,
      present_sizes: r.present_sizes.join(", "),
      missing_sizes: (r.missing_sizes ?? []).join(", "),
    })),
    ["style_code", "min_size", "max_size", "present_sizes", "missing_sizes"],
  );
  return csvResponse(`missing-sizes_${date}.csv`, csv);
}
