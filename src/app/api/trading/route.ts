import { NextRequest, NextResponse } from "next/server";
import { tradingSql } from "@/lib/trading-db";
import { ADAPTERS, fetchSnapshot } from "@/lib/strategy-adapters";
import { cached } from "@/lib/route-cache";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const strategy = req.nextUrl.searchParams.get("strategy") ?? "polymarket";
  const adapter = ADAPTERS[strategy];
  if (!adapter) {
    return NextResponse.json(
      { error: `unknown strategy: ${strategy}` },
      { status: 400 }
    );
  }
  const result = await cached(`trading:${strategy}`, () =>
    fetchSnapshot(tradingSql(), adapter)
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: "trading db unavailable", detail: result.error },
      { status: 502 }
    );
  }
  return NextResponse.json({
    ...result.data,
    stale: result.stale,
    fetchedAt: result.fetchedAt,
  });
}
