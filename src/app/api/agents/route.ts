import { NextResponse } from "next/server";
import { promises as fs, realpathSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// The route reads EXACTLY ONE file: the path configured in .env.local. No
// client parameter ever influences the filesystem path. The configured path
// is canonicalized once at module load (parent dir realpath + basename, so a
// temporarily-missing summary file doesn't permanently disable the route and
// a directory symlink/junction that resolves elsewhere is rejected), then
// re-canonicalized on every read to defend against a file-level symlink swap.
const CONFIGURED = process.env.CONDUCTOR_SUMMARY_PATH ?? "";

const CANON: string | null = (() => {
  if (!CONFIGURED) return null;
  try {
    const abs = path.resolve(CONFIGURED);
    const dirReal = realpathSync.native(path.dirname(abs));
    return path.join(dirReal, path.basename(abs)).toLowerCase();
  } catch {
    return null; // parent dir missing → route stays offline (misconfigured)
  }
})();

const STALE_AFTER_MS = 26 * 60 * 60 * 1000; // nightly cadence + slack

type AgentMetric = {
  key: string;
  current: number;
  delta: number | null;
  baselineStatus: "VALID" | "NO_BASELINE";
};
type AgentSkill = {
  name: string;
  lastRun: string | null;
  freshness: "ok" | "warn" | "err";
  metrics: AgentMetric[];
  anomalies: string[];
  digestDate: string | null;
};
type AgentsPayload = {
  online: boolean;
  // Distinguishes "the env var is unset" from "the var is set but the file is missing" -
  // these are different facts (misconfigured vs. conductor-not-running) and the Wave 1
  // design language requires absence to be distinguishable.
  configured: boolean;
  generatedAt: string | null;
  skills: AgentSkill[];
};

const NOT_CONFIGURED: AgentsPayload = {
  online: false,
  configured: false,
  generatedAt: null,
  skills: [],
};
const OFFLINE: AgentsPayload = {
  online: false,
  configured: true,
  generatedAt: null,
  skills: [],
};

let cache: { at: number; payload: AgentsPayload } | null = null;
const TTL_MS = 5000;

type RawSkill = {
  name?: unknown;
  last_run?: unknown;
  status?: unknown;
  latest_metrics?: Record<
    string,
    { current?: unknown; delta?: unknown; baseline_status?: unknown }
  >;
  anomalies?: unknown;
  digest_date?: unknown;
};

function freshness(status: unknown, lastRun: string | null): AgentSkill["freshness"] {
  if (status !== "ok") return "err";
  if (!lastRun) return "warn";
  const age = Date.now() - new Date(lastRun).getTime();
  return Number.isNaN(age) || age > STALE_AFTER_MS ? "warn" : "ok";
}

function shapeSkill(s: RawSkill): AgentSkill {
  const lastRun = typeof s.last_run === "string" ? s.last_run : null;
  const metrics: AgentMetric[] = Object.entries(s.latest_metrics ?? {}).map(
    ([key, v]) => {
      // NO_BASELINE (or an explicit null delta) means "there was no prior window
      // to compare against" → delta is null, NEVER coerced to 0. Conflating the
      // two is the exact Wave 1A Part 7 bug class the schema fix exists to prevent.
      const noBaseline = v?.baseline_status === "NO_BASELINE";
      return {
        key,
        current: Number(v?.current ?? 0),
        delta: noBaseline || v?.delta == null ? null : Number(v.delta),
        baselineStatus: noBaseline ? "NO_BASELINE" : "VALID",
      };
    }
  );
  return {
    name: typeof s.name === "string" ? s.name : "unknown",
    lastRun,
    freshness: freshness(s.status, lastRun),
    metrics,
    anomalies: Array.isArray(s.anomalies)
      ? s.anomalies.filter((a): a is string => typeof a === "string")
      : [],
    digestDate: typeof s.digest_date === "string" ? s.digest_date : null,
  };
}

async function readSummary(): Promise<AgentsPayload> {
  if (!CONFIGURED) return NOT_CONFIGURED;
  if (!CANON) return OFFLINE;

  // Re-canonicalize the full configured path on every read. If the file is a
  // symlink/junction resolving outside the configured location, reject it.
  let realCanonical: string;
  try {
    realCanonical = realpathSync.native(CONFIGURED);
  } catch {
    return OFFLINE; // file missing (e.g. conductor not running)
  }
  if (realCanonical.toLowerCase() !== CANON) return OFFLINE;

  const raw = await fs.readFile(realCanonical, "utf8");
  const parsed = JSON.parse(raw) as {
    generated_at?: unknown;
    skills?: unknown;
  };
  const skills = Array.isArray(parsed.skills)
    ? (parsed.skills as RawSkill[]).map(shapeSkill)
    : [];
  return {
    online: true,
    configured: true,
    generatedAt:
      typeof parsed.generated_at === "string" ? parsed.generated_at : null,
    skills,
  };
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.payload);
  }
  try {
    const payload = await readSummary();
    cache = { at: Date.now(), payload };
    return NextResponse.json(payload);
  } catch (err) {
    // malformed JSON, read race, etc. — degrade honestly, never 5xx
    console.error("[agents]", err);
    const payload = OFFLINE;
    cache = { at: Date.now(), payload };
    return NextResponse.json(payload);
  }
}
