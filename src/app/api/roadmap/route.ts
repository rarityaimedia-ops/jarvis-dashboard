import { NextResponse } from "next/server";
import { readVaultFile } from "@/lib/vault";
import { parseMd, textOf } from "@/lib/md";

export const dynamic = "force-dynamic";

type Bucket = "now" | "next" | "later";
type Project = { project: string; now: string[]; next: string[]; later: string[] };
type RoadmapPayload = { projects: Project[] };

let lastGoodPayload: RoadmapPayload | null = null;

export async function GET() {
  try {
    const { content, stale } = await readVaultFile("00_System/ROADMAP.md");
    const ast = parseMd(content);

    const projects: Project[] = [];
    let current: Project | null = null;
    let bucket: Bucket | null = null;

    for (const node of ast.children) {
      if (node.type === "heading" && node.depth === 2) {
        current = { project: textOf(node), now: [], next: [], later: [] };
        projects.push(current);
        bucket = null;
      } else if (
        current &&
        node.type === "paragraph" &&
        node.children.length === 1 &&
        node.children[0].type === "strong"
      ) {
        const label = textOf(node).toLowerCase();
        bucket = label === "now" || label === "next" || label === "later" ? label : null;
      } else if (current && node.type === "list") {
        // A missing blank line before **Next**/**Later** makes remark fuse
        // the marker into the previous list item (lazy continuation), so
        // markers must also be detected inside items.
        for (const item of node.children) {
          const para = item.children.find((c) => c.type === "paragraph");
          const strongIdx =
            para?.children.findIndex(
              (c) =>
                c.type === "strong" &&
                ["now", "next", "later"].includes(textOf(c).toLowerCase())
            ) ?? -1;
          if (para && strongIdx >= 0) {
            const text = para.children
              .slice(0, strongIdx)
              .map(textOf)
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();
            if (bucket && text) current[bucket].push(text);
            bucket = textOf(para.children[strongIdx]).toLowerCase() as Bucket;
          } else if (bucket) {
            current[bucket].push(textOf(item));
          }
        }
      }
    }

    const payload: RoadmapPayload = { projects };
    lastGoodPayload = payload;
    return NextResponse.json({ ...payload, cached: stale });
  } catch (err) {
    console.error("[roadmap]", err);
    if (lastGoodPayload) {
      return NextResponse.json({ ...lastGoodPayload, cached: true });
    }
    return NextResponse.json({ error: "roadmap unavailable" }, { status: 503 });
  }
}
