import { NextResponse } from "next/server";
import { readVaultFile } from "@/lib/vault";

export const dynamic = "force-dynamic";

type RawNode = {
  id: string;
  label: string;
  community?: number;
  source_file?: string;
};
type RawLink = { source: string; target: string };

type GraphPayload = {
  nodes: {
    id: string;
    label: string;
    community: number;
    degree: number;
    filePath: string;
  }[];
  links: { source: string; target: string }[];
};

let lastGoodPayload: GraphPayload | null = null;

export async function GET() {
  try {
    const { content, stale } = await readVaultFile("graphify-out/graph.json");
    // graph.json may be mid-write by the nightly rebuild — parse failure
    // falls through to the last-good payload below.
    const raw = JSON.parse(content) as { nodes: RawNode[]; links: RawLink[] };

    const degree = new Map<string, number>();
    const ids = new Set(raw.nodes.map((n) => n.id));
    const links = raw.links
      .filter((l) => ids.has(l.source) && ids.has(l.target))
      .map((l) => {
        degree.set(l.source, (degree.get(l.source) ?? 0) + 1);
        degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
        return { source: l.source, target: l.target };
      });

    const payload: GraphPayload = {
      nodes: raw.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        community: n.community ?? 0,
        degree: degree.get(n.id) ?? 0,
        filePath: n.source_file ?? "",
      })),
      links,
    };
    lastGoodPayload = payload;
    return NextResponse.json({ ...payload, cached: stale });
  } catch (err) {
    console.error("[graph]", err);
    if (lastGoodPayload) {
      return NextResponse.json({ ...lastGoodPayload, cached: true });
    }
    return NextResponse.json({ error: "graph unavailable" }, { status: 503 });
  }
}
