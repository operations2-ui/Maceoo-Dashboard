import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBuyPlanTransferSuggestions } from "@/lib/reports";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const variantSku = searchParams.get("variantSku");
  const storeId = searchParams.get("storeId");
  if (!variantSku || !storeId) {
    return NextResponse.json({ error: "variantSku and storeId are required" }, { status: 400 });
  }

  const rows = await getBuyPlanTransferSuggestions(variantSku, storeId);
  return NextResponse.json({ rows });
}
