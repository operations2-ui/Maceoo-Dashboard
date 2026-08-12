import { config } from "dotenv";
import { join } from "path";
config({ path: join(__dirname, "..", ".env.local") });

import { pool } from "../src/lib/db";
import { runSync } from "../src/lib/sync";

async function main() {
  const { rows } = await pool.query(
    "insert into sync_runs (status) values ('running') returning id",
  );
  const runId = rows[0].id;

  try {
    const summary = await runSync();
    const status = summary.errors.length > 0 ? "error" : "success";
    await pool.query(
      "update sync_runs set finished_at = now(), status = $1, summary = $2 where id = $3",
      [status, JSON.stringify(summary), runId],
    );
    console.log(JSON.stringify(summary, null, 2));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await pool.query(
      "update sync_runs set finished_at = now(), status = 'error', error_message = $1 where id = $2",
      [message, runId],
    );
    console.error(message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
