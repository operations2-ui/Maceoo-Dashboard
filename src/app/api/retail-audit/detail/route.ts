import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getRetailAuditDetail } from "@/lib/reports";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const po = searchParams.get("po");
  if (!po) return NextResponse.json({ error: "po is required" }, { status: 400 });

  const rows = await getRetailAuditDetail(po);
  return NextResponse.json({ rows });
}
