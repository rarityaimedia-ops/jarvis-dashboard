import { NextResponse } from "next/server";
import { readVaultFile } from "@/lib/vault";
import { parseMd, textOf } from "@/lib/md";
import type { Table, List, ListItem } from "mdast";

export const dynamic = "force-dynamic";

type HubPayload = {
  portfolio: { product: string; status: string; index: string }[];
  checklist: { text: string; checked: boolean }[];
};

let lastGoodPayload: HubPayload | null = null;

export async function GET() {
  try {
    const { content, stale } = await readVaultFile("00_System/rarity-hub.md");
    const ast = parseMd(content);
    const kids = ast.children;

    const payload: HubPayload = { portfolio: [], checklist: [] };

    for (let i = 0; i < kids.length; i++) {
      const node = kids[i];
      if (node.type !== "heading") continue;
      const title = textOf(node).toLowerCase();

      if (title === "portfolio") {
        const table = kids
          .slice(i + 1)
          .find((n) => n.type === "table") as Table | undefined;
        if (table) {
          payload.portfolio = table.children.slice(1).map((row) => {
            const cells = row.children.map((c) => textOf(c));
            return {
              product: cells[0] ?? "",
              status: cells[1] ?? "",
              index: (cells[2] ?? "").replace(/\[\[|\]\]/g, ""),
            };
          });
        }
      }

      if (title.startsWith("weekly review")) {
        const list = kids
          .slice(i + 1)
          .find((n) => n.type === "list") as List | undefined;
        if (list) {
          payload.checklist = list.children.map((item: ListItem) => ({
            text: textOf(item),
            checked: item.checked === true,
          }));
        }
      }
    }

    lastGoodPayload = payload;
    return NextResponse.json({ ...payload, cached: stale });
  } catch (err) {
    console.error("[hub]", err);
    if (lastGoodPayload) {
      return NextResponse.json({ ...lastGoodPayload, cached: true });
    }
    return NextResponse.json({ error: "hub unavailable" }, { status: 503 });
  }
}
