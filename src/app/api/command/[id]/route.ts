import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { UUID_V4, resultPath, runningPath, inboxPath } from "@/lib/command-queue";

export const dynamic = "force-dynamic";

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// GET /api/command/[id] -> { status: done | running | queued | not_found }
// The id is validated against the strict UUID v4 regex BEFORE it is used in any path
// construction. On "done" the result summary is returned (all fields are guaranteed
// credential-free by the watcher). Only the queue is ever touched.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  if (!UUID_V4.test(id)) {
    return NextResponse.json(
      { status: "not_found", error: "invalid id" },
      { status: 400 }
    );
  }

  if (await exists(resultPath(id))) {
    try {
      const r = JSON.parse(await fs.readFile(resultPath(id), "utf8"));
      return NextResponse.json({
        status: "done",
        result: {
          job_id: r.job_id,
          skill: r.skill,
          status: r.status,
          output_path: r.output_path,
          error: r.error,
        },
      });
    } catch {
      return NextResponse.json({ status: "done" });
    }
  }

  if (await exists(runningPath(id))) {
    return NextResponse.json({ status: "running" });
  }
  if (await exists(inboxPath(id))) {
    return NextResponse.json({ status: "queued" });
  }
  return NextResponse.json({ status: "not_found" }, { status: 404 });
}
