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
