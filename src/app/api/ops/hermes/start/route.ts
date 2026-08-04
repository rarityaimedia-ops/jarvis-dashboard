import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { queryTask } from "@/lib/schtasks";

export const dynamic = "force-dynamic";

// The dashboard's only execute-capable route. See DESIGN.md "Execute
// routes" for the full security rationale — in short: the command and task
// name are a hardcoded constant, POST() takes no request parameter (it is
// structurally impossible for a body/query/header to reach execFile), and
// the server only ever binds 127.0.0.1.
const HERMES_TASK = "claude-hermes-daemon";
const DEBOUNCE_MS = 10_000;
const POLL_TIMEOUT_MS = 8_000;
const POLL_INTERVAL_MS = 500;

let lastTriggerAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isRunning(): Promise<boolean> {
  const info = await queryTask(HERMES_TASK);
  return info?.status.toLowerCase() === "running";
}

function runTask(): Promise<void> {
  return new Promise((resolve) => {
    execFile(
      "schtasks",
      ["/Run", "/TN", HERMES_TASK],
      { windowsHide: true, timeout: 10_000 },
      (err) => {
        if (err) console.error("[hermes/start] schtasks /Run failed:", err);
        resolve();
      }
    );
  });
}

export async function POST() {
  // Claim the debounce window synchronously, before any `await`, so two
  // requests racing in the same tick can't both slip past this check and
  // both call execFile — that's the actual "exactly one execution"
  // guarantee. If it turns out nothing needed executing (already running),
  // the claim is refunded below.
  const now = Date.now();
  if (now - lastTriggerAt < DEBOUNCE_MS) {
    return NextResponse.json(
      { error: "hermes start already triggered — retry in a few seconds" },
      { status: 429 }
    );
  }
  lastTriggerAt = now;

  // truth first: if it's already running, say so, refund the claim, and
  // touch nothing
  if (await isRunning()) {
    lastTriggerAt = 0;
    return NextResponse.json({ triggered: false, online: true });
  }

  await runTask();

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let online = false;
  while (Date.now() < deadline) {
    if (await isRunning()) {
      online = true;
      break;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  return NextResponse.json({ triggered: true, online });
}

export async function GET() {
  return NextResponse.json({ error: "method not allowed" }, { status: 405 });
}
