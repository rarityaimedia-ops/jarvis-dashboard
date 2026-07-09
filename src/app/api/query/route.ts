import { spawn } from "child_process";
import { VAULT } from "@/lib/vault";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 120_000;

/**
 * Defense-in-depth deny-list: strip shell metacharacters but preserve
 * unicode letters (Slovenian č/š/ž must survive). The real injection
 * defense is spawn-without-shell below.
 */
function sanitize(q: string): string {
  return q.slice(0, 300).replace(/[`;&|<>$^%!"'\\]/g, "").trim();
}

export async function POST(req: Request) {
  let body: { question?: unknown; engine?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const engine = body.engine;
  if (engine !== "graphify" && engine !== "claude") {
    return Response.json({ error: "engine must be graphify|claude" }, { status: 400 });
  }
  const question = sanitize(String(body.question ?? ""));
  if (!question) {
    return Response.json({ error: "empty question" }, { status: 400 });
  }

  const [cmd, args] =
    engine === "graphify"
      ? (["graphify", ["query", question]] as const)
      : ([
          "claude",
          ["-p", question, "--allowedTools", "Read,Grep,Glob", "--max-turns", "6"],
        ] as const);

  // spawn without shell — cwd=VAULT so vault CLAUDE.md rules apply
  const child = spawn(cmd, args, { cwd: VAULT, windowsHide: true });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let sentAny = false;
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      const timer = setTimeout(() => {
        child.kill();
        try {
          controller.enqueue(
            new TextEncoder().encode("\n[query timed out after 120s]")
          );
        } catch {
          /* stream gone */
        }
      }, TIMEOUT_MS);

      req.signal.addEventListener("abort", () => {
        child.kill();
        close();
      });

      child.stdout.on("data", (d: Buffer) => {
        sentAny = true;
        try {
          controller.enqueue(new Uint8Array(d));
        } catch {
          child.kill();
        }
      });
      child.stderr.on("data", (d: Buffer) => {
        console.error(`[query:${engine}]`, d.toString());
      });
      child.on("error", (err) => {
        console.error(`[query:${engine}] spawn failed:`, err);
        try {
          controller.enqueue(
            new TextEncoder().encode(`[${engine} could not be started]`)
          );
        } catch {
          /* stream gone */
        }
        close();
      });
      child.on("close", (code) => {
        if (code !== 0 && !sentAny) {
          try {
            controller.enqueue(
              new TextEncoder().encode(
                `[${engine} exited with code ${code} and no output]`
              )
            );
          } catch {
            /* stream gone */
          }
        }
        close();
      });
    },
    cancel() {
      child.kill();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
