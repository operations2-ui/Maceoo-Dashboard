import { readFileSync } from "fs";
import { join } from "path";
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

// The Sales sheet now doubles as the Discounts source: each store/day is one
// row per (user, discount-name combination) slice of that day's orders,
// instead of a single per-day total row.
const sales = parseSalesCsv(readFileSync(join(dir, "sales_sample.csv"), "utf-8"));
assert(sales.length === 5, `sales: 5 rows parsed (got ${sales.length})`);
assert(sales[0].netSales === 2000, `sales: net sales parsed (got ${sales[0].netSales})`);
assert(sales[0].userName === "Jamie Lee", `sales: user name parsed (got "${sales[0].userName}")`);
assert(sales[0].discountNames === "", `sales: empty discount combo parsed as "" (got "${sales[0].discountNames}")`);
assert(
  sales[1].discountNames === "Employee discount",
  `sales: discount combo parsed (got "${sales[1].discountNames}")`,
);
assert(sales[1].netSales === 342.5, `sales: discount-slice net sales parsed (got ${sales[1].netSales})`);
assert(
  sales[2].locationName === "Paris Store",
  `sales: blank Location Name forward-filled from prior row (got "${sales[2].locationName}")`,
);
assert(sales[3].locationName === "ARLV Store", "sales: explicit Location Name still respected after a forward-fill");
assert(sales[4].netSales === -798.88, `sales: currency-formatted negative value parsed (got ${sales[4].netSales})`);
assert(sales[4].grossSales === 0, `sales: currency-formatted zero value parsed (got ${sales[4].grossSales})`);

const stores: StoreRef[] = [
  { id: "1", name: "Paris Store", code: "PARIS" },
  { id: "2", name: "ARLV Store", code: "ARLV" },
];
assert(resolveStoreId("Paris Store", stores) === "1", "resolver: exact name match");
assert(resolveStoreId("ARLV", stores) === "2", "resolver: code match");
assert(resolveStoreId("paris", stores) === "1", "resolver: normalized match (lowercase, no 'Store' suffix)");
assert(resolveStoreId("Nowhere", stores) === null, "resolver: no match returns null");

console.log("Sales parser checks complete.");
