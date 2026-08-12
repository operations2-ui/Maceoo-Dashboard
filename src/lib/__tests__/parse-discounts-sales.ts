import { readFileSync } from "fs";
import { join } from "path";
import { parseDiscountsCsv } from "../discounts-parser";
import { parseSalesCsv } from "../sales-parser";
import { resolveStoreId, type StoreRef } from "../store-resolver";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${msg}`);
  }
}

const dir = join(__dirname, "..", "__fixtures__");

const discounts = parseDiscountsCsv(readFileSync(join(dir, "discounts_sample.csv"), "utf-8"));
assert(discounts.length === 3, `discounts: 3 rows parsed (got ${discounts.length})`);
assert(discounts[0].dayDate === "2026-08-06", `discounts: date parsed (got ${discounts[0].dayDate})`);
assert(discounts[0].totalDiscounts === 15.5, `discounts: amount parsed (got ${discounts[0].totalDiscounts})`);
assert(discounts[1].posFlag === "Non-POS", `discounts: pos flag parsed (got ${discounts[1].posFlag})`);

const sales = parseSalesCsv(readFileSync(join(dir, "sales_sample.csv"), "utf-8"));
assert(sales.length === 4, `sales: 4 rows parsed (got ${sales.length})`);
assert(sales[0].netSales === 2342.5, `sales: net sales parsed (got ${sales[0].netSales})`);
assert(sales[0].grossMargin === 1442.5, `sales: gross margin parsed (got ${sales[0].grossMargin})`);
assert(
  sales[1].locationName === "Paris Store",
  `sales: blank Location Name forward-filled from prior row (got "${sales[1].locationName}")`,
);
assert(sales[2].locationName === "ARLV Store", "sales: explicit Location Name still respected after a forward-fill");
assert(sales[3].netSales === -798.88, `sales: currency-formatted negative value parsed (got ${sales[3].netSales})`);
assert(sales[3].grossSales === 0, `sales: currency-formatted zero value parsed (got ${sales[3].grossSales})`);

const stores: StoreRef[] = [
  { id: "1", name: "Paris Store", code: "PARIS" },
  { id: "2", name: "ARLV Store", code: "ARLV" },
];
assert(resolveStoreId("Paris Store", stores) === "1", "resolver: exact name match");
assert(resolveStoreId("ARLV", stores) === "2", "resolver: code match");
assert(resolveStoreId("paris", stores) === "1", "resolver: normalized match (lowercase, no 'Store' suffix)");
assert(resolveStoreId("Nowhere", stores) === null, "resolver: no match returns null");

console.log("Discounts/Sales parser checks complete.");
