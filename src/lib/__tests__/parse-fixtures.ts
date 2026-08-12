import { readFileSync } from "fs";
import { join } from "path";
import { parseInventoryCsv, dateFromFilename } from "../inventory-parser";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${msg}`);
  }
}

const dir = join(__dirname, "..", "__fixtures__");
const day1 = parseInventoryCsv(readFileSync(join(dir, "paris_2026-08-06_report.csv"), "utf-8"));
const day2 = parseInventoryCsv(readFileSync(join(dir, "paris_2026-08-07_report.csv"), "utf-8"));

assert(day1.length === 10, `day1 has 10 variant rows (got ${day1.length})`);
assert(day2.length === 10, `day2 has 10 variant rows (got ${day2.length})`);

const oneSize = day1.find((r) => r.sku === "100000071063")!;
assert(oneSize.styleCode === "10000007106", `one-size style code derived correctly (got ${oneSize.styleCode})`);
assert(oneSize.sizeCode === "3", `one-size size code derived correctly (got ${oneSize.sizeCode})`);

const twoDigit = day2.find((r) => r.sku === "1000000740010")!;
assert(twoDigit.styleCode === "10000007400", `two-digit-size SKU style code correct (got ${twoDigit.styleCode})`);
assert(twoDigit.sizeCode === "10", `two-digit-size SKU size code correct (got ${twoDigit.sizeCode})`);
assert(twoDigit.onHand === 0, "two-digit-size on_hand parsed as 0");

assert(dateFromFilename("2026-08-08_report.csv") === "2026-08-08", "date extracted from filename");

console.log("Parser fixture checks complete.");
