import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import {
  isAllowlistedSkill,
  SKILL_ALLOWLIST,
  inboxPath,
} from "@/lib/command-queue";

export const dynamic = "force-dynamic";

// POST /api/command  { skill, args } -> { job_id }
// The dashboard validates against its OWN hardcoded allowlist, generates a uuid v4, and
// writes inbox\<job_id>.json. It never executes anything. An unlisted skill is rejected
// with 400 and NO file is written.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const { skill, args } = (body ?? {}) as { skill?: unknown; args?: unknown };

  if (typeof skill !== "string" || !isAllowlistedSkill(skill)) {
    return NextResponse.json({ error: "skill not allowlisted" }, { status: 400 });
  }

  const jobArgs = args ?? {};
  if (!SKILL_ALLOWLIST[skill](jobArgs)) {
    return NextResponse.json(
      { error: "args invalid for skill" },
      { status: 400 }
    );
  }

  const job_id = randomUUID(); // uuid v4
  const job = {
    job_id,
    skill,
    args: jobArgs,
    requested_at: new Date().toISOString(),
    requested_by: "dashboard",
  };

  // Atomic write: temp then rename, so the watcher never observes a partial file.
  const dest = inboxPath(job_id);
  const tmp = `${dest}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(job, null, 2), "utf8");
  await fs.rename(tmp, dest);

  return NextResponse.json({ job_id });
}

export async function GET() {
  return NextResponse.json({ error: "method not allowed" }, { status: 405 });
}
