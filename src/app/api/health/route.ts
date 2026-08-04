import { NextResponse } from "next/server";
import { readVaultFile, tailLines, run, VAULT } from "@/lib/vault";
import { queryTask } from "@/lib/schtasks";

export const dynamic = "force-dynamic";

const REBUILD_TASK = "claude-brain-nightly-graph-rebuild";
const HERMES_TASK = "claude-hermes-daemon";
const STALE_AFTER_MS = 26 * 60 * 60 * 1000; // nightly job + slack

type HealthPayload = {
  rebuild: {
    status: "ok" | "stale" | "failed" | "unknown";
    lastRun: string | null;
    stale: boolean;
  };
  hermes: { running: boolean; jobs: number; stale: boolean };
  weeklyReview: { lastLine: string | null; stale: boolean };
  git: { uncommitted: number | null };
  nextJob: { name: string; time: string | null };
  ticker: string[];
};

let lastGoodPayload: HealthPayload | null = null;

export async function GET() {
  try {
    const ticker: string[] = [];
    // Rebuild log — last line looks like "2026-07-05 22:16:48 rebuild ok"
    const rebuild: HealthPayload["rebuild"] = {
      status: "unknown",
      lastRun: null,
      stale: false,
    };
    try {
      const { content, stale } = await readVaultFile(
        "00_System/logs/graph-rebuild.log"
      );
      rebuild.stale = stale;
      const line = tailLines(content, 50)
        .reverse()
        .find((l) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\s+rebuild\s+/.test(l));
      if (line) {
        const m = line.match(
          /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+rebuild\s+(\S+)/
        )!;
        rebuild.lastRun = m[1];
        const age = Date.now() - new Date(m[1].replace(" ", "T")).getTime();
        rebuild.status =
          m[2] !== "ok" ? "failed" : age > STALE_AFTER_MS ? "stale" : "ok";
      }
      ticker.push(
        ...tailLines(content, 3).map((l) => `rebuild · ${l.trim()}`)
      );
    } catch (err) {
      console.error("[health] rebuild log:", err);
    }

    // Hermes log — count completed jobs this session
    const hermes: HealthPayload["hermes"] = {
      running: false,
      jobs: 0,
      stale: false,
    };
    try {
      const { content, stale } = await readVaultFile(
        "00_System/logs/hermes-daemon.log"
      );
      hermes.stale = stale;
      hermes.jobs = content
        .split(/\r?\n/)
        .filter((l) => l.includes("Done:")).length;
      ticker.push(
        ...tailLines(content, 3).map((l) => `hermes · ${l.trim().slice(0, 120)}`)
      );
    } catch (err) {
      console.error("[health] hermes log:", err);
    }

    // Weekly review log — not present in every vault
    const weeklyReview: HealthPayload["weeklyReview"] = {
      lastLine: null,
      stale: false,
    };
    try {
      const { content, stale } = await readVaultFile(
        "00_System/logs/weekly-review.log"
      );
      weeklyReview.stale = stale;
      weeklyReview.lastLine = tailLines(content, 1)[0] ?? null;
    } catch {
      // file absent — chip simply won't render a line
    }

    // Git + scheduled tasks, in parallel
    const [git, rebuildInfo, hermesInfo] = await Promise.all([
      run("git", ["-C", VAULT, "status", "--porcelain"]),
      queryTask(REBUILD_TASK),
      queryTask(HERMES_TASK),
    ]);

    const uncommitted =
      git.code === 0
        ? git.stdout.split(/\r?\n/).filter((l) => l.trim()).length
        : null;

    hermes.running = hermesInfo?.status.toLowerCase() === "running";

    if (git.code === 0) {
      ticker.push(
        ...git.stdout
          .split(/\r?\n/)
          .filter((l) => l.trim())
          .slice(0, 5)
          .map((l) => `git · ${l.trim()}`)
      );
    }
    if (rebuildInfo?.next) {
      ticker.push(`next · nightly graph rebuild ${rebuildInfo.next}`);
    }

    const payload: HealthPayload = {
      rebuild,
      hermes,
      weeklyReview,
      git: { uncommitted },
      nextJob: {
        name: "nightly graph rebuild",
        time: rebuildInfo?.next || null,
      },
      ticker,
    };
    lastGoodPayload = payload;
    return NextResponse.json({ ...payload, cached: false });
  } catch (err) {
    console.error("[health]", err);
    if (lastGoodPayload) {
      return NextResponse.json({ ...lastGoodPayload, cached: true });
    }
    return NextResponse.json({ error: "health unavailable" }, { status: 503 });
  }
}
