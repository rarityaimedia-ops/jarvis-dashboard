import "server-only";
import path from "path";

// Command-bus queue access. The dashboard NEVER holds a credential and never executes a
// skill: it only writes a job-request file into the conductor's queue and reads status
// back. Path confinement here is the dashboard's half of the "neither side trusts the
// other" contract.

// The ONE queue-root constant. Every queue path is path.join'd from this, resolved, and
// verified to still live under it before any fs call. CONDUCTOR_PATH is a path only - no
// credential is ever involved (mirrors the existing VAULT_PATH pattern).
//
// Unset must throw, not degrade: `?? ""` would resolve to the dashboard's own cwd, and a
// queue that silently accepts and drops jobs has no honest offline state (mirrors the
// explicit-throw discipline in trading-db.ts).
if (!process.env.CONDUCTOR_PATH) {
  throw new Error(
    "CONDUCTOR_PATH missing from .env.local - must point at the conductor root directory"
  );
}
const CONDUCTOR = path.resolve(process.env.CONDUCTOR_PATH);
export const QUEUE_ROOT = path.join(CONDUCTOR, "queue");

const INBOX = path.join(QUEUE_ROOT, "inbox");
// Exported for read-only directory listing by /api/runs. These are fixed
// constants derived from QUEUE_ROOT — no client input ever reaches them.
export const RUNNING = path.join(QUEUE_ROOT, "running");
export const DONE = path.join(QUEUE_ROOT, "done");

// Strict UUID v4 - byte-for-byte identical to the watcher's regex.
export const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// The dashboard's OWN allowlist (its own copy - it never reads the conductor's). Maps a
// skill to an args validator. This is a first-line gate; the watcher validates again and
// independently. Prototype keys are excluded via isAllowlistedSkill().
export const SKILL_ALLOWLIST: Record<string, (args: unknown) => boolean> = {
  // intake-stats: empty-object-only args schema.
  "intake-stats": (args) =>
    typeof args === "object" &&
    args !== null &&
    !Array.isArray(args) &&
    Object.keys(args as object).length === 0,
  // quant-stats: empty-object-only. It reads one local DuckDB journal whose path it
  // derives itself and holds no credential, so there is nothing a job may pass.
  "quant-stats": (args) =>
    typeof args === "object" &&
    args !== null &&
    !Array.isArray(args) &&
    Object.keys(args as object).length === 0,
};

export function isAllowlistedSkill(skill: string): boolean {
  return Object.prototype.hasOwnProperty.call(SKILL_ALLOWLIST, skill);
}

// SKILL_SLA_HOURS moved to skill-sla.ts (pure data, no fs/path/crypto) so client code
// (verdict.ts) can import it directly without pulling in this file's "server-only" guard.

/** Confine a path to QUEUE_ROOT; throws if it escapes. Mirrors vault.ts#vaultPath. */
function confineToQueue(p: string): string {
  const resolved = path.resolve(p);
  if (resolved !== QUEUE_ROOT && !resolved.startsWith(QUEUE_ROOT + path.sep)) {
    throw new Error("path escapes queue root");
  }
  return resolved;
}

// Path builders accept a caller-validated UUID only (the strict regex makes slashes, dots
// and traversal impossible); confineToQueue is the second, independent guard.
export function inboxPath(id: string): string {
  return confineToQueue(path.join(INBOX, `${id}.json`));
}
export function runningPath(id: string): string {
  return confineToQueue(path.join(RUNNING, `${id}.json`));
}
export function resultPath(id: string): string {
  return confineToQueue(path.join(DONE, `${id}.result.json`));
}
