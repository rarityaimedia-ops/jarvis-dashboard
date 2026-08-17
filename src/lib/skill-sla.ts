// Pure data - no fs/path/crypto - safe to import from client code. Kept out of
// command-queue.ts so importing it (verdict.ts, bundled client-side) never runs that
// module's CONDUCTOR_PATH guard, which throws when the var is unset - and on the client
// it always looks unset, since server-only env vars are never inlined into the browser
// bundle.
//
// The dashboard's OWN SLA table (its own copy - it never reads the conductor's, same
// double-allowlist discipline as SKILL_ALLOWLIST in command-queue.ts). Freshness dots and
// the health verdict use this. Adding a skill's SLA is ONE line here.
export const SKILL_SLA_HOURS: Record<string, number> = {
  "intake-stats": 24,
  "quant-stats": 24,
};
