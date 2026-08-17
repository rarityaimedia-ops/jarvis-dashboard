import type { Health, AgentsPayload, RunsPayload } from "@/lib/store";
// Imported directly from skill-sla.ts, NOT @/lib/command-queue - this file is bundled
// client-side, and command-queue.ts throws at module load when CONDUCTOR_PATH (a
// server-only env var, always unset in the browser) is missing.
import { SKILL_SLA_HOURS } from "@/lib/skill-sla";

// The single health verdict. Pure so it can be reasoned about and forced in
// tests (V7). OPERATIONAL requires ALL of: hermes alive, graph rebuild fresh
// (<26h, surfaced as rebuild.status "ok"), every allowlisted skill that has run
// within its SLA, no job stuck in queue/running past the 10-minute timeout, and
// no error/timeout as any skill's most-recent result. Otherwise the SINGLE most
// severe reason, err tier before warn tier.

export type Verdict = { tone: "ok" | "warn" | "err" | "idle"; text: string };

const RUNNING_TIMEOUT_MS = 10 * 60 * 1000;

export function computeVerdict(
  health: Health | null,
  agents: AgentsPayload | null,
  runs: RunsPayload | null,
  now: number = Date.now()
): Verdict {
  // Not enough data yet — honest neutral, never a false OK or false DEGRADED.
  if (!health) return { tone: "idle", text: "JARVIS · SYNCING" };

  const degraded = (tone: "warn" | "err", reason: string): Verdict => ({
    tone,
    text: `JARVIS DEGRADED — ${reason}`,
  });

  // ---- err tier (most severe first) ----
  if (!health.hermes.running) return degraded("err", "HERMES OFFLINE");

  if (runs?.running.some((r) => r.ageMs > RUNNING_TIMEOUT_MS))
    return degraded("err", "JOB STALLED · watcher may be down");

  // newest terminal result per skill (runs.recent is newest-first). rejected is a
  // validation reject, not a health failure, so it never degrades the verdict.
  if (runs) {
    const seen = new Set<string>();
    for (const r of runs.recent) {
      if (seen.has(r.skill)) continue;
      seen.add(r.skill);
      if (r.status === "error")
        return degraded("err", `${r.skill.toUpperCase()} LAST RUN ERRORED`);
      if (r.status === "timeout")
        return degraded("err", `${r.skill.toUpperCase()} LAST RUN TIMED OUT`);
    }
  }

  if (health.rebuild.status === "failed")
    return degraded("err", "GRAPH REBUILD FAILED");

  // ---- warn tier ----
  if (health.rebuild.status === "stale")
    return degraded("warn", "GRAPH REBUILD STALE >26H");
  if (health.rebuild.status === "unknown")
    return degraded("warn", "GRAPH REBUILD STATUS UNKNOWN");

  // Every allowlisted skill that HAS run must be within its SLA. A never-run
  // skill is neutral (dim), not a fault — a freshly added skill isn't "broken".
  if (agents?.online) {
    for (const [skill, slaH] of Object.entries(SKILL_SLA_HOURS)) {
      const s = agents.skills.find((x) => x.name === skill);
      if (!s || !s.lastRun) continue;
      const age = now - new Date(s.lastRun).getTime();
      if (!Number.isNaN(age) && age > slaH * 3_600_000)
        return degraded("warn", `${skill.toUpperCase()} STALE >${slaH}H`);
    }
  }

  return { tone: "ok", text: "JARVIS OPERATIONAL" };
}
