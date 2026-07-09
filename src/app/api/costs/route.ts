import { NextResponse } from "next/server";
import { readVaultFile } from "@/lib/vault";
import { tradingSql } from "@/lib/trading-db";
import {
  ADAPTERS,
  fetchMonthlyModelCosts,
  fetchResolvedCount,
} from "@/lib/strategy-adapters";
import { cached } from "@/lib/route-cache";

export const dynamic = "force-dynamic";

type FixedCost = { name: string; eur: number; TODO?: boolean };

// Fixed costs are EUR (vault costs.json), variable model costs are USD
// (bot api_costs). No FX conversion — the two are reported side by side.
async function fetchCosts() {
  const { content } = await readVaultFile("00_System/costs.json");
  const parsed = JSON.parse(content) as {
    fixed_monthly: FixedCost[];
    currency: string;
  };
  const fixed = parsed.fixed_monthly ?? [];
  const fixedTotalEur = fixed.reduce((s, c) => s + (c.eur || 0), 0);
  const needsSetup = fixed.some((c) => c.TODO);

  const sql = tradingSql();
  const adapter = ADAPTERS.polymarket;
  const monthly = await fetchMonthlyModelCosts(sql, adapter);
  const resolvedCount = await fetchResolvedCount(sql, adapter);
  const totalModelCostUsd = monthly.reduce((s, m) => s + m.cost, 0);

  return {
    fixed,
    fixedTotalEur,
    fixedCurrency: parsed.currency ?? "EUR",
    needsSetup,
    monthlyModelCosts: monthly, // USD
    totalModelCostUsd,
    resolvedCount,
    costPerResolvedUsd:
      resolvedCount > 0 ? totalModelCostUsd / resolvedCount : null,
  };
}

export async function GET() {
  const result = await cached("costs", fetchCosts);
  if (!result.ok) {
    return NextResponse.json(
      { error: "costs unavailable", detail: result.error },
      { status: 502 }
    );
  }
  return NextResponse.json({
    ...result.data,
    stale: result.stale,
    fetchedAt: result.fetchedAt,
  });
}
