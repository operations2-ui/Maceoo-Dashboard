import { redirect } from "next/navigation";

/** Discounts merged into the Sales page — discount usage now comes from the Sales sheet itself. */
export default async function DiscountsPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; from?: string; to?: string }>;
}) {
  const params = new URLSearchParams(await searchParams);
  const qs = params.toString();
  redirect(`/sales${qs ? `?${qs}` : ""}`);
}
