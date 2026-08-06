import { NextResponse } from "next/server";
import { promises as fs, realpathSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// The QUANT tab's artifact. This is a SECOND route rather than more keys in the aggregate
// conductor summary, and that is deliberate: /api/agents parses `latest_metrics` into a
// flat map rendered as "key · current (delta)" text lines, and neither a kill log with
// prose reasons nor a gate table that must show ABSENT gates fits a flat metrics map.
//
// The FILE-READING DISCIPLINE IS COPIED FROM /api/agents EXACTLY, because it is the part
// that must not drift: exactly one path, configured in .env.local, never influenced by a
// client parameter; canonicalized once at module load (parent dir realpath + basename, so
// a temporarily-missing artifact does not permanently disable the route while a directory
// symlink/junction resolving elsewhere is still rejected); re-canonicalized on every read
// to defend against a file-level symlink swap; and any failure degrades to an offline
// payload rather than a 5xx.
//
// THERE IS NO DATABASE CONNECTION HERE AND THERE MUST NEVER BE ONE. /api/trading and
// /api/costs hold a Postgres credential; that is an existing exception, not a precedent.
// The quant journal is a local DuckDB file with no server to connect to, and the dashboard
// holds zero credentials. This route reads one JSON file the conductor wrote.
const CONFIGURED = process.env.QUANT_STATS_PATH ?? "";

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

export type QuantCandidate = {
  id: string;
  familyTag: string;
  status: string;
  killGate: number | null;
  killReason: string | null;
  refusedAtGate: number | null;
  refusalReason: string | null;
  // What a 'quarantined' row carries INSTEAD of a reason string — by schema it has
  // neither a kill_reason nor a refusal_reason, and its evidence lives in the (now
  // orphaned) detector's metrics. Absent for every other status.
  noVerdictEvidence: {
    testsFired: string[];
    baseSharpe: number | null;
    peakDominance: number | null;
    peakCurvature: number | null;
  } | null;
  createdAt: string | null;
};
export type QuantGate = {
  gate: number;
  name: string;
  state: "live" | "abandoned" | "absent";
  note: string;
};
export type QuantHoldout = {
  budget: number;
  spent: number;
  remaining: number;
  psrThreshold: number;
  spentBy: { candidateId: string; passed: boolean | null; evaluatedAt: string | null }[];
};
export type QuantDefence = { name: string; note: string };
export type QuantTotals = {
  candidates: number;
  killed: number;
  quarantined: number;
  unjudgeable: number;
  promotable: number;
};
export type QuantPayload = {
  online: boolean;
  generatedAt: string | null;
  // Computed HERE rather than in the component, for the same reason /api/agents computes
  // its own: reading the clock during render is impure and React 19 rejects it outright.
  freshness: "ok" | "warn";
  schemaVersion: number | null;
  // Non-null when the SKILL itself reported it could not read the journal in full (a
  // running gauntlet holding the write lock is the live case). Distinct from online:false,
  // which means the dashboard could not read the artifact. Both are honest empties, but
  // they have different causes and the tab says which.
  degraded: { reason: string; detail: string } | null;
  candidates: QuantCandidate[];
  gates: QuantGate[];
  holdout: QuantHoldout | null;
  lookahead: { detective: QuantDefence[]; preventative: QuantDefence[]; note: string | null };
  totals: QuantTotals | null;
};

// quant-stats runs daily; SKILL_SLA_HOURS says 24h. Past that the tab's marker goes --warn.
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function freshness(generatedAt: string | null): "ok" | "warn" {
  if (!generatedAt) return "warn";
  const age = Date.now() - new Date(generatedAt).getTime();
  return Number.isNaN(age) || age > STALE_AFTER_MS ? "warn" : "ok";
}

const OFFLINE: QuantPayload = {
  online: false,
  generatedAt: null,
  freshness: "warn",
  schemaVersion: null,
  degraded: null,
  candidates: [],
  gates: [],
  // detective stays an EMPTY ARRAY rather than becoming undefined, so an offline tab and a
  // healthy one make the same claim about look-ahead: there are no detective controls.
  lookahead: { detective: [], preventative: [], note: null },
  holdout: null,
  totals: null,
};

let cache: { at: number; payload: QuantPayload } | null = null;
const TTL_MS = 5000;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function shapeGate(g: Record<string, unknown>): QuantGate {
  const state = g.state;
  return {
    gate: num(g.gate) ?? 0,
    name: str(g.name) ?? "unknown",
    // An unrecognised state degrades to "absent", the most conservative reading: it claims
    // the gate is NOT protecting anything. Defaulting to "live" would invent a defence.
    state: state === "live" || state === "abandoned" || state === "absent" ? state : "absent",
    note: str(g.note) ?? "",
  };
}

function shapeDefences(v: unknown): QuantDefence[] {
  return Array.isArray(v)
    ? v.map((d) => ({
        name: str((d as Record<string, unknown>)?.name) ?? "unknown",
        note: str((d as Record<string, unknown>)?.note) ?? "",
      }))
    : [];
}

async function readArtifact(): Promise<QuantPayload> {
  if (!CONFIGURED || !CANON) return OFFLINE;

  // Re-canonicalize the full configured path on every read. If the file is a
  // symlink/junction resolving outside the configured location, reject it.
  let realCanonical: string;
  try {
    realCanonical = realpathSync.native(CONFIGURED);
  } catch {
    return OFFLINE; // artifact missing (e.g. quant-stats has never run)
  }
  if (realCanonical.toLowerCase() !== CANON) return OFFLINE;

  const raw = await fs.readFile(realCanonical, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  const degradedRaw = parsed.degraded as Record<string, unknown> | null | undefined;
  const holdoutRaw = parsed.holdout as Record<string, unknown> | null | undefined;
  const totalsRaw = parsed.totals as Record<string, unknown> | null | undefined;
  const lookaheadRaw = (parsed.lookahead_defence ?? {}) as Record<string, unknown>;
  const generatedAt = str(parsed.generated_at);

  return {
    online: true,
    generatedAt,
    freshness: freshness(generatedAt),
    schemaVersion: num(parsed.journal_schema_version),
    degraded: degradedRaw
      ? {
          reason: str(degradedRaw.reason) ?? "unknown",
          detail: str(degradedRaw.detail) ?? "",
        }
      : null,
    candidates: Array.isArray(parsed.candidates)
      ? (parsed.candidates as Record<string, unknown>[]).map((c) => ({
          id: str(c.id) ?? "unknown",
          familyTag: str(c.family_tag) ?? "—",
          status: str(c.status) ?? "unknown",
          killGate: num(c.kill_gate),
          killReason: str(c.kill_reason),
          refusedAtGate: num(c.refused_at_gate),
          refusalReason: str(c.refusal_reason),
          noVerdictEvidence: c.no_verdict_evidence
            ? (() => {
                const e = c.no_verdict_evidence as Record<string, unknown>;
                return {
                  testsFired: Array.isArray(e.tests_fired)
                    ? e.tests_fired.filter((t): t is string => typeof t === "string")
                    : [],
                  baseSharpe: num(e.base_sharpe),
                  peakDominance: num(e.peak_dominance),
                  peakCurvature: num(e.peak_curvature),
                };
              })()
            : null,
          createdAt: str(c.created_at),
        }))
      : [],
    gates: Array.isArray(parsed.gate_coverage)
      ? (parsed.gate_coverage as Record<string, unknown>[]).map(shapeGate)
      : [],
    holdout: holdoutRaw
      ? {
          budget: num(holdoutRaw.budget) ?? 0,
          spent: num(holdoutRaw.spent) ?? 0,
          remaining: num(holdoutRaw.remaining) ?? 0,
          psrThreshold: num(holdoutRaw.psr_threshold) ?? 0,
          spentBy: Array.isArray(holdoutRaw.spent_by)
            ? (holdoutRaw.spent_by as Record<string, unknown>[]).map((s) => ({
                candidateId: str(s.candidate_id) ?? "unknown",
                passed: typeof s.passed === "boolean" ? s.passed : null,
                evaluatedAt: str(s.evaluated_at),
              }))
            : [],
        }
      : null,
    lookahead: {
      detective: shapeDefences(lookaheadRaw.detective),
      preventative: shapeDefences(lookaheadRaw.preventative),
      note: str(lookaheadRaw.note),
    },
    totals: totalsRaw
      ? {
          candidates: num(totalsRaw.candidates) ?? 0,
          killed: num(totalsRaw.killed) ?? 0,
          quarantined: num(totalsRaw.quarantined) ?? 0,
          unjudgeable: num(totalsRaw.unjudgeable) ?? 0,
          promotable: num(totalsRaw.promotable) ?? 0,
        }
      : null,
  };
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.payload);
  }
  try {
    const payload = await readArtifact();
    cache = { at: Date.now(), payload };
    return NextResponse.json(payload);
  } catch (err) {
    // malformed JSON, read race, etc. — degrade honestly, never 5xx
    console.error("[quant]", err);
    const payload = OFFLINE;
    cache = { at: Date.now(), payload };
    return NextResponse.json(payload);
  }
}
