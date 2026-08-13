import { config } from "dotenv";
import { join } from "path";
config({ path: join(__dirname, "..", ".env.local") });

/**
 * One-off full backfill: runs runSync() in a loop until the inventory phase
 * reports no more work left. Bypasses the app's own per-invocation time
 * budget entirely (runs directly against RDS/Drive from this process, not
 * through a Next.js route or Vercel function), so there's no 40s/60s ceiling
 * — just the real time it takes to catch up all 10 stores.
 *
 * `runSync` is imported dynamically, AFTER dotenv config() runs above: static
 * ES imports are hoisted and evaluate before this file's own top-level code,
 * so a static import here would read process.env.SYNC_TIME_BUDGET_MS before
 * dotenv had set it, silently falling back to sync.ts's 40s default.
 */
async function main() {
  const { runSync } = await import("../src/lib/sync");
  let round = 1;
  const start = Date.now();

  while (true) {
    console.log(`\n=== Round ${round} (${((Date.now() - start) / 1000).toFixed(0)}s elapsed) ===`);
    const summary = await runSync((msg) => console.log(`  ${msg}`));

    console.log(`  Imported ${summary.inventory.length} file(s) this round.`);
    if (summary.inventoryUnmatchedFolders.length > 0) {
      console.log(`  Unmatched folders: ${summary.inventoryUnmatchedFolders.join(", ")}`);
    }
    if (summary.inventoryErrors.length > 0) {
      console.log(`  Errors: ${JSON.stringify(summary.inventoryErrors)}`);
    }
    if (summary.errors.length > 0) {
      console.log(`  Sync errors: ${summary.errors.join("; ")}`);
    }

    if (!summary.inventoryStoppedEarly) {
      console.log(`\nDone — inventory fully caught up after ${round} round(s), ${((Date.now() - start) / 1000).toFixed(0)}s total.`);
      break;
    }
    round++;
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
