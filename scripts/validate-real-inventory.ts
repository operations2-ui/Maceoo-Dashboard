import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { parseInventoryCsv } from "../src/lib/inventory-parser";

const root = join(__dirname, "..", "data", "inventory");
const storeFolders = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());

let totalFiles = 0;
let totalRows = 0;
let errorCount = 0;
const nonNumericSizeCodes = new Set<string>();

for (const folder of storeFolders) {
  const folderPath = join(root, folder.name);
  const files = readdirSync(folderPath).filter((f) => f.endsWith(".csv"));
  let folderRows = 0;
  let folderErrors = 0;

  for (const file of files) {
    totalFiles++;
    const text = readFileSync(join(folderPath, file), "utf-8");
    try {
      const rows = parseInventoryCsv(text);
      folderRows += rows.length;
      for (const r of rows) {
        if (!/^[0-9]+$/.test(r.sizeCode)) nonNumericSizeCodes.add(r.sizeCode);
      }
    } catch (e) {
      folderErrors++;
      errorCount++;
      console.error(`ERROR in ${folder.name}/${file}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  totalRows += folderRows;
  console.log(`${folder.name}: ${files.length} files, ${folderRows} variant rows, ${folderErrors} errors`);
}

console.log(`\nTotal: ${totalFiles} files, ${totalRows} variant rows, ${errorCount} errors`);
console.log(`Distinct non-numeric size codes seen (sample): ${[...nonNumericSizeCodes].slice(0, 30).join(", ")}`);
console.log(`Non-numeric size code count: ${nonNumericSizeCodes.size}`);
