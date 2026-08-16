import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

// Lazily constructed: standalone scripts load env vars (dotenv) at runtime,
// after this module's static imports have already been hoisted and evaluated,
// so DATABASE_URL must be read on first real use, not at module-eval time.
function getPool(): Pool {
  if (!global._pgPool) {
    const connectionString = process.env.DATABASE_URL;
    // Managed Postgres hosts (RDS, Supabase, etc) sign with a CA Node doesn't
    // trust by default ("self-signed certificate in certificate chain").
    // Connections still authenticate with the real username/password and are
    // encrypted in transit; this just skips chain validation against Node's
    // bundled CA list. Local dev (localhost) needs no TLS at all.
    const isLocal = connectionString?.includes("localhost") || connectionString?.includes("127.0.0.1");
    global._pgPool = new Pool({
      connectionString,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
      // pg's default (10) isn't enough: several report pages fan out one
      // query per store (e.g. getMissingSizes), and with 15 stores that
      // alone can need more simultaneous connections than the default pool
      // has — the rest queue for a connection, and once enough of them queue
      // long enough, they blow past connectionTimeoutMillis below ("timeout
      // exceeded when trying to connect") or even statement_timeout, despite
      // each individual query running in well under a second on its own.
      max: 20,
      // Postgres statement_timeout covers time spent waiting on a lock, not
      // just execution — without it, one stuck/aborted sync leaving a lock
      // held can silently hang every later query that touches the same rows.
      statement_timeout: 30_000,
      // node-postgres has NO default timeout for establishing a brand-new
      // connection — if the TCP handshake to RDS stalls (flaky network path,
      // as this instance has had before), pool.connect() hangs forever with
      // nothing to show in pg_stat_activity, since no connection ever formed.
      connectionTimeoutMillis: 15_000,
    });
  }
  return global._pgPool;
}

export const pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getPool(), prop, receiver);
    return typeof value === "function" ? value.bind(getPool()) : value;
  },
});
