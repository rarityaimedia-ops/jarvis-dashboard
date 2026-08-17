import "server-only";
import postgres from "postgres";

// Read-only Supabase role (dashboard_ro). Singleton across dev HMR reloads
// so we never leak connections past the pool cap.
const globalRef = globalThis as { __tradingSql?: ReturnType<typeof postgres> };

export function tradingSql() {
  if (!process.env.TRADING_DB_URL) {
    throw new Error("TRADING_DB_URL missing from .env.local");
  }
  globalRef.__tradingSql ??= postgres(process.env.TRADING_DB_URL, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    // Supabase transaction pooler does not support prepared statements
    prepare: false,
  });
  return globalRef.__tradingSql;
}
