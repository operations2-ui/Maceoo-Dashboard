import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getRetailAuditDetail } from "@/lib/reports";
import { sendPhysicalStockCountRequest } from "@/lib/email";
import { resolveStoreId } from "@/lib/store-resolver";
import { pool } from "@/lib/db";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { poNumber } = await request.json();
  if (typeof poNumber !== "string" || !poNumber) {
    return NextResponse.json({ error: "poNumber is required" }, { status: 400 });
  }

  const { rows: poRows } = await pool.query(
    "select vendor_name from retail_audit_dashboard where po_number = $1",
    [poNumber],
  );
  if (poRows.length === 0) {
    return NextResponse.json({ error: `PO ${poNumber} not found` }, { status: 404 });
  }
  const vendorName: string = poRows[0].vendor_name;

  const [{ rows: stores }, { rows: aliases }] = await Promise.all([
    pool.query("select id, name, code, to_email, cc_email from stores"),
    pool.query("select store_id, source, alias_name from store_aliases where source = 'vendor'"),
  ]);
  const storeId = resolveStoreId(vendorName, stores, aliases, "vendor");
  if (!storeId) {
    return NextResponse.json(
      { error: `No store mapped to vendor "${vendorName}" — add a Vendor Name (NetSuite) alias in Store Master.` },
      { status: 400 },
    );
  }
  const store = stores.find((s) => s.id === storeId)!;
  if (!store.to_email) {
    return NextResponse.json({ error: `${store.name} has no To Email set in Store Master.` }, { status: 400 });
  }

  const detail = await getRetailAuditDetail(poNumber);
  const discrepancies = detail.filter(
    (d) => d.quantity_shipped != null && d.quantity_received != null && Number(d.diff_shipped_received) > 0,
  );
  if (discrepancies.length === 0) {
    return NextResponse.json({ error: "No shipped/received discrepancies found for this PO." }, { status: 400 });
  }

  await sendPhysicalStockCountRequest({
    to: store.to_email,
    cc: store.cc_email,
    storeName: store.name,
    poNumber,
    rows: discrepancies,
  });

  return NextResponse.json({ ok: true, sentTo: store.to_email, storeName: store.name, count: discrepancies.length });
}
