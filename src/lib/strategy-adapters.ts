import type { Sql } from "postgres";

// Per-strategy config mapping REAL columns onto the generic shape the UI
// consumes. All expressions below are compile-time constants (never user
// input) interpolated via sql.unsafe; every dynamic value stays a bind
// parameter. A future adapter = one more entry in ADAPTERS, zero UI changes.

type AdapterConfig = {
  key: string;
  /** currency of stake/pnl/model-cost values */
  currency: string;
  trades: {
    table: string;
    /** SQL exprs over the real table, aliased to the generic shape */
    predictedProbability: string;
    resolvedOutcome: string; // 0/1/null
    stake: string;
    pnl: string;
    /** null = strategy has no category dimension */
    category: string | null;
    createdAt: string;
    resolvedAt: string;
    isResolved: string; // predicate
    isOpen: string; // predicate
    label: string;
    side: string | null;
  };
  modelCosts: { table: string; cost: string; createdAt: string } | null;
};

// Column semantics verified against the bot's own code (models.py,
// agents/executor.py, agents/post_mortem.py) + live information_schema:
// - predicted_prob is always P(YES); executor stores 1-confidence for "no"
// - pnl is DERIVED with the bot's own paper-trading formula (post_mortem):
//   yes -> size*(actual - predicted), no -> size*(predicted - actual)
// - there is no category column; api_costs has no per-trade link
const polymarket: AdapterConfig = {
  key: "polymarket",
  currency: "USD",
  trades: {
    table: "trade_calibration",
    predictedProbability: "predicted_prob",
    resolvedOutcome: "actual_outcome",
    stake: "position_size",
    pnl: `CASE
      WHEN direction = 'yes' THEN position_size * (actual_outcome - predicted_prob)
      WHEN direction = 'no' THEN position_size * (predicted_prob - actual_outcome)
      ELSE 0 END`,
    category: null,
    createdAt: "created_at",
    resolvedAt: "resolved_at",
    isResolved: "status = 'resolved' AND actual_outcome IS NOT NULL",
    isOpen: "status = 'open'",
    label: "market_id",
    side: "direction",
  },
  modelCosts: { table: "api_costs", cost: "cost_usd", createdAt: "created_at" },
};

export const ADAPTERS: Record<string, AdapterConfig> = { polymarket };

// ---------- generic shape returned to the UI ----------

export type TradingSnapshot = {
  strategy: string;
  currency: string;
  metrics: {
    resolvedCount: number;
    openCount: number;
    winRate: number | null; // fraction of resolved trades with pnl > 0
    netPnl: number | null;
    brier: number | null;
    totalModelCost: number | null;
    modelCostCurrency: string;
  };
  equity: { t: string; equity: number }[];
  calibration: { mid: number; frequency: number; count: number }[];
  roiByCategory: {
    category: string;
    roi: number | null;
    pnl: number;
    stake: number;
    count: number;
  }[];
  openPositions: {
    label: string;
    side: string | null;
    predictedProbability: number;
    stake: number;
    createdAt: string;
  }[];
  lastResolved: {
    label: string;
    outcome: number;
    pnl: number;
    resolvedAt: string;
  } | null;
};

export type MonthlyModelCost = { month: string; cost: number };

// ---------- generic queries built from adapter config ----------
// All aggregates computed IN SQL; connection role is read-only.

export async function fetchSnapshot(
  sql: Sql,
  adapter: AdapterConfig
): Promise<TradingSnapshot> {
  const t = adapter.trades;
  const u = (s: string) => sql.unsafe(s); // static config fragments only

  const [metricsRow] = await sql`
    SELECT
      count(*) FILTER (WHERE ${u(t.isResolved)})::int AS resolved_count,
      count(*) FILTER (WHERE ${u(t.isOpen)})::int AS open_count,
      avg(CASE WHEN ${u(t.pnl)} > 0 THEN 1.0 ELSE 0.0 END)
        FILTER (WHERE ${u(t.isResolved)}) AS win_rate,
      sum(${u(t.pnl)}) FILTER (WHERE ${u(t.isResolved)}) AS net_pnl,
      avg(POWER(${u(t.predictedProbability)} - ${u(t.resolvedOutcome)}, 2))
        FILTER (WHERE ${u(t.isResolved)}) AS brier
    FROM ${u(t.table)}`;

  const equity = await sql`
    SELECT ${u(t.resolvedAt)} AS t,
           sum(${u(t.pnl)}) OVER (ORDER BY ${u(t.resolvedAt)}) AS equity
    FROM ${u(t.table)}
    WHERE ${u(t.isResolved)} AND ${u(t.resolvedAt)} IS NOT NULL
    ORDER BY ${u(t.resolvedAt)}`;

  const calibration = await sql`
    SELECT width_bucket(${u(t.predictedProbability)}, 0, 1.0001, 10) AS bin,
           avg(${u(t.resolvedOutcome)}::float) AS frequency,
           count(*)::int AS count
    FROM ${u(t.table)}
    WHERE ${u(t.isResolved)}
    GROUP BY bin ORDER BY bin`;

  const roi = await sql`
    SELECT coalesce(${u(t.category ?? "NULL::text")}, 'all') AS category,
           sum(${u(t.pnl)}) AS pnl,
           sum(${u(t.stake)}) AS stake,
           count(*)::int AS count,
           CASE WHEN sum(${u(t.stake)}) > 0
                THEN sum(${u(t.pnl)}) / sum(${u(t.stake)}) END AS roi
    FROM ${u(t.table)}
    WHERE ${u(t.isResolved)}
    GROUP BY 1 ORDER BY pnl DESC`;

  const open = await sql`
    SELECT ${u(t.label)} AS label,
           ${u(t.side ?? "NULL::text")} AS side,
           ${u(t.predictedProbability)} AS predicted_probability,
           ${u(t.stake)} AS stake,
           ${u(t.createdAt)} AS created_at
    FROM ${u(t.table)}
    WHERE ${u(t.isOpen)}
    ORDER BY ${u(t.createdAt)} DESC
    LIMIT 50`;

  const lastResolvedRows = await sql`
    SELECT ${u(t.label)} AS label,
           ${u(t.resolvedOutcome)} AS outcome,
           ${u(t.pnl)} AS pnl,
           ${u(t.resolvedAt)} AS resolved_at
    FROM ${u(t.table)}
    WHERE ${u(t.isResolved)} AND ${u(t.resolvedAt)} IS NOT NULL
    ORDER BY ${u(t.resolvedAt)} DESC
    LIMIT 1`;

  let totalModelCost: number | null = null;
  if (adapter.modelCosts) {
    const m = adapter.modelCosts;
    const [row] = await sql`
      SELECT sum(${u(m.cost)}) AS total FROM ${u(m.table)}`;
    totalModelCost = row.total === null ? 0 : Number(row.total);
  }

  return {
    strategy: adapter.key,
    currency: adapter.currency,
    metrics: {
      resolvedCount: metricsRow.resolved_count,
      openCount: metricsRow.open_count,
      winRate: metricsRow.win_rate === null ? null : Number(metricsRow.win_rate),
      netPnl: metricsRow.net_pnl === null ? null : Number(metricsRow.net_pnl),
      brier: metricsRow.brier === null ? null : Number(metricsRow.brier),
      totalModelCost,
      modelCostCurrency: adapter.currency,
    },
    equity: equity.map((r) => ({
      t: new Date(r.t as string).toISOString(),
      equity: Number(r.equity),
    })),
    calibration: calibration.map((r) => ({
      mid: (Number(r.bin) - 0.5) / 10,
      frequency: Number(r.frequency),
      count: Number(r.count),
    })),
    roiByCategory: roi.map((r) => ({
      category: String(r.category),
      roi: r.roi === null ? null : Number(r.roi),
      pnl: Number(r.pnl),
      stake: Number(r.stake),
      count: Number(r.count),
    })),
    openPositions: open.map((r) => ({
      label: String(r.label),
      side: r.side === null ? null : String(r.side),
      predictedProbability: Number(r.predicted_probability),
      stake: Number(r.stake),
      createdAt: new Date(r.created_at as string).toISOString(),
    })),
    lastResolved: lastResolvedRows[0]
      ? {
          label: String(lastResolvedRows[0].label),
          outcome: Number(lastResolvedRows[0].outcome),
          pnl: Number(lastResolvedRows[0].pnl),
          resolvedAt: new Date(
            lastResolvedRows[0].resolved_at as string
          ).toISOString(),
        }
      : null,
  };
}

export async function fetchResolvedCount(
  sql: Sql,
  adapter: AdapterConfig
): Promise<number> {
  const t = adapter.trades;
  const u = (s: string) => sql.unsafe(s);
  const [row] = await sql`
    SELECT count(*) FILTER (WHERE ${u(t.isResolved)})::int AS n
    FROM ${u(t.table)}`;
  return Number(row.n);
}

export async function fetchMonthlyModelCosts(
  sql: Sql,
  adapter: AdapterConfig
): Promise<MonthlyModelCost[]> {
  if (!adapter.modelCosts) return [];
  const m = adapter.modelCosts;
  const u = (s: string) => sql.unsafe(s);
  const rows = await sql`
    SELECT date_trunc('month', ${u(m.createdAt)}) AS month,
           sum(${u(m.cost)}) AS cost
    FROM ${u(m.table)}
    GROUP BY 1 ORDER BY 1`;
  return rows.map((r) => ({
    month: new Date(r.month as string).toISOString().slice(0, 7),
    cost: Number(r.cost),
  }));
}
