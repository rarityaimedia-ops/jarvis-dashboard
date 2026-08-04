import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { RUNNING, DONE, UUID_V4 } from "@/lib/command-queue";

export const dynamic = "force-dynamic";

// Read-only view of the command bus: in-flight jobs (queue/running) and the
// newest terminal results (queue/done, which the Wave 1A watcher prunes to 200).
// Reuses the ONE queue-root + its confinement from command-queue.ts — RUNNING and
// DONE are fixed constants, no client input ever reaches a path here. Filenames
// come from readdir and are gated on the strict UUID regex before any read.

type RunStatus = "ok" | "error" | "timeout" | "rejected";
type RunEntry = {
  job_id: string;
  skill: string;
  status: RunStatus;
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
  output_path: string | null;
};
type RunsPayload = {
  running: { job_id: string; ageMs: number }[];
  recent: RunEntry[];
};

const RECENT_LIMIT = 50;
const TTL_MS = 3000;
let cache: { at: number; payload: RunsPayload } | null = null;

async function listRunning(): Promise<RunsPayload["running"]> {
  let names: string[];
  try {
    names = await fs.readdir(RUNNING);
  } catch {
    return [];
  }
  const out: RunsPayload["running"] = [];
  for (const n of names) {
    if (!n.endsWith(".json")) continue;
    const id = n.slice(0, -".json".length);
    if (!UUID_V4.test(id)) continue;
    try {
      const st = await fs.stat(path.join(RUNNING, n));
      out.push({ job_id: id, ageMs: Date.now() - st.mtimeMs });
    } catch {
      // vanished mid-listing (claimed/finished) — skip
    }
  }
  return out;
}

async function listRecent(): Promise<RunEntry[]> {
  let names: string[];
  try {
    names = await fs.readdir(DONE);
  } catch {
    return [];
  }
  const results = names.filter((n) => {
    if (!n.endsWith(".result.json")) return false;
    return UUID_V4.test(n.slice(0, -".result.json".length));
  });
  // newest first by mtime
  const stated: { n: string; mtime: number }[] = [];
  for (const n of results) {
    try {
      const st = await fs.stat(path.join(DONE, n));
      stated.push({ n, mtime: st.mtimeMs });
    } catch {
      // skip
    }
  }
  stated.sort((a, b) => b.mtime - a.mtime);

  const recent: RunEntry[] = [];
  for (const { n } of stated.slice(0, RECENT_LIMIT)) {
    try {
      const r = JSON.parse(await fs.readFile(path.join(DONE, n), "utf8"));
      recent.push({
        job_id: typeof r.job_id === "string" ? r.job_id : "",
        skill: typeof r.skill === "string" ? r.skill : "unknown",
        status: r.status as RunStatus,
        started_at: typeof r.started_at === "string" ? r.started_at : null,
        finished_at: typeof r.finished_at === "string" ? r.finished_at : null,
        exit_code: typeof r.exit_code === "number" ? r.exit_code : null,
        output_path: typeof r.output_path === "string" ? r.output_path : null,
      });
    } catch {
      // malformed result file — skip, never 5xx
    }
  }
  return recent;
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.payload);
  }
  try {
    const [running, recent] = await Promise.all([listRunning(), listRecent()]);
    const payload: RunsPayload = { running, recent };
    cache = { at: Date.now(), payload };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[runs]", err);
    const payload: RunsPayload = { running: [], recent: [] };
    cache = { at: Date.now(), payload };
    return NextResponse.json(payload);
  }
}
