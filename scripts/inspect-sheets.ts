import { config } from "dotenv";
import { join } from "path";
config({ path: join(__dirname, "..", ".env.local") });

import { getSheetsClient } from "../src/lib/google-clients";

async function main() {
  const sheets = getSheetsClient();

  const salesRes = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SALES_SHEET_ID!,
    range: process.env.SALES_SHEET_RANGE || "A:Z",
  });
  console.log("=== SALES raw header + first 3 data rows ===");
  console.log(JSON.stringify((salesRes.data.values ?? []).slice(0, 4), null, 2));

  const discRes = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.DISCOUNTS_SHEET_ID!,
    range: process.env.DISCOUNTS_SHEET_RANGE || "A:Z",
  });
  console.log("\n=== DISCOUNTS raw header + first 6 rows ===");
  console.log(JSON.stringify((discRes.data.values ?? []).slice(0, 7), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
