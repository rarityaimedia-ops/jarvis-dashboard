import { NextResponse } from "next/server";
import { promises as fs, realpathSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Reads the watcher-computed verdict from conductor/state/verdict.json. The watcher
// is the sole source of truth (Wave 1E Phase 4) — this route is a read-only mirror,
// same pattern as /api/agents: canonicalize once at module load, re-canonicalize on
// every read to reject a symlink swap, degrade to an honest "unknown" shape on any
// failure instead of ever 5xx-ing.
const CONFIGURED = process.env.CONDUCTOR_PATH
  ? path.join(process.env.CONDUCTOR_PATH, "state", "verdict.json")
  : "";

const CANON: string | null = (() => {
  if (!CONFIGURED) return null;
  try {
    const dirReal = realpathSync.native(path.dirname(CONFIGURED));
    return path.join(dirReal, path.basename(CONFIGURED)).toLowerCase();
  } catch {
    return null; // parent dir missing → route stays unknown (conductor not present)
  }
})();

export type VerdictPayload = {
  status: "OPERATIONAL" | "DEGRADED" | "UNKNOWN";
  tone: "ok" | "warn" | "err";
  text: string;
  reason: string | null;
  evaluatedAt: string | null;
};

const UNKNOWN: VerdictPayload = {
  status: "UNKNOWN",
  tone: "warn",
  text: "JARVIS VERDICT UNKNOWN",
  reason: "watcher not reporting",
  evaluatedAt: null,
};

let cache: { at: number; payload: VerdictPayload } | null = null;
const TTL_MS = 3000;

async function readVerdict(): Promise<VerdictPayload> {
  if (!CANON) return UNKNOWN;

  let realCanonical: string;
  try {
    realCanonical = realpathSync.native(CONFIGURED);
  } catch {
    return UNKNOWN; // file missing (e.g. watcher has never run)
  }
  if (realCanonical.toLowerCase() !== CANON) return UNKNOWN;

  const raw = await fs.readFile(realCanonical, "utf8");
  const parsed = JSON.parse(raw) as {
    status?: unknown;
    tone?: unknown;
    text?: unknown;
    reason?: unknown;
    evaluated_at?: unknown;
  };
  const status = parsed.status === "DEGRADED" ? "DEGRADED" : "OPERATIONAL";
  const tone = parsed.tone === "warn" || parsed.tone === "err" ? parsed.tone : "ok";
  return {
    status,
    tone,
    text: typeof parsed.text === "string" ? parsed.text : UNKNOWN.text,
    reason: typeof parsed.reason === "string" ? parsed.reason : null,
    evaluatedAt: typeof parsed.evaluated_at === "string" ? parsed.evaluated_at : null,
  };
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.payload);
  }
  try {
    const payload = await readVerdict();
    cache = { at: Date.now(), payload };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[verdict]", err);
    const payload = UNKNOWN;
    cache = { at: Date.now(), payload };
    return NextResponse.json(payload);
  }
}
