import { readVaultFile } from "@/lib/vault";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { content } = await readVaultFile("graphify-out/graph.html");
    return new Response(content, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[graph-html]", err);
    return new Response(
      "<!doctype html><body style='background:#0a0a0a;color:#8a8578;font-family:sans-serif;display:grid;place-items:center;height:100vh'>graph.html unavailable</body>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}
