import { run } from "@/lib/vault";

/** Parse `schtasks /query /fo CSV /nh /tn <task>`: "name","next run","status" */
function parseTaskCsv(stdout: string): { next: string; status: string } | null {
  const fields = stdout.match(/"([^"]*)"/g)?.map((f) => f.slice(1, -1));
  if (!fields || fields.length < 3) return null;
  return { next: fields[1].trim(), status: fields[2].trim() };
}

/** Read-only status query for a Windows scheduled task (spawn-based, no shell). */
export async function queryTask(
  taskName: string
): Promise<{ next: string; status: string } | null> {
  const result = await run("schtasks", ["/query", "/fo", "CSV", "/nh", "/tn", taskName]);
  return result.code === 0 ? parseTaskCsv(result.stdout) : null;
}
