// Shared cache discipline for DB-backed routes: TTL 60s so the UI can poll
// every 15s while the DB sees max one query burst per minute. On error the
// last-good payload is served with a stale flag.

type Entry<T> = { data: T; at: number };
const store = new Map<string, Entry<unknown>>();
const TTL_MS = 60_000;

export type CachedResult<T> =
  | { ok: true; data: T; stale: boolean; fetchedAt: number }
  | { ok: false; error: string };

export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<CachedResult<T>> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.at < TTL_MS) {
    return { ok: true, data: hit.data, stale: false, fetchedAt: hit.at };
  }
  try {
    process.stderr.write(`[${new Date().toISOString()}] db refresh: ${key}\n`);
    const data = await fetcher();
    const entry = { data, at: Date.now() };
    store.set(key, entry);
    return { ok: true, data, stale: false, fetchedAt: entry.at };
  } catch (err) {
    process.stderr.write(`db refresh failed: ${key}: ${String(err)}\n`);
    if (hit) {
      // last-good, flagged stale
      return { ok: true, data: hit.data, stale: true, fetchedAt: hit.at };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
