"use client";

// TRADING tab: read-only observability for the paper-trading bot.
// Thin-data discipline: render what exists, name the sample size, never
// fake or extrapolate. Brier always carries its n.

import dynamic from "next/dynamic";
import {
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useJarvis } from "@/lib/store";

const EquityChart = dynamic(() => import("@/components/equity-chart"), {
  ssr: false,
});

// chart geometry stays blue (atmosphere) — no gold in axes/series/bars, only
// the Stat KPI values above the charts are gold (key numbers)
const AXIS = { fill: "#9fb2d4", fontSize: 11, fontFamily: "var(--font-jetbrains-mono), monospace" };
const GRID_STROKE = "rgba(90, 130, 220, 0.18)";
const REF_STROKE = "rgba(90, 130, 220, 0.5)";
const SERIES_BLUE = "#6b8cff";
const TOOLTIP_STYLE = {
  background: "#0d1526",
  border: "1px solid rgba(90, 130, 220, 0.38)",
  fontFamily: "var(--font-jetbrains-mono), monospace",
  fontSize: 11,
};
const THIN_N = 30;

function fmtMoney(v: number | null, cur: string): string {
  if (v === null) return "—";
  const sym = cur === "USD" ? "$" : cur === "EUR" ? "€" : `${cur} `;
  return `${v < 0 ? "−" : ""}${sym}${Math.abs(v).toFixed(2)}`;
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="flex-1 rounded-md border border-border-dim px-4 py-3">
      <div className="panel-label">{label}</div>
      <div
        className={`mt-1 font-jetbrains-mono text-xl ${
          tone === "down" ? "text-err" : tone === "up" ? "text-ok" : "text-gold"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
          {sub}
        </div>
      )}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="cc-panel p-4">
      <h3 className="panel-label">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Thin({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-6 text-center font-jetbrains-mono text-[length:var(--fs-body)] text-text-dim">
      {children}
    </p>
  );
}

export default function TradingPanel() {
  const trading = useJarvis((s) => s.trading);
  const tradingError = useJarvis((s) => s.tradingError);

  if (!trading) {
    return (
      <section className="cc-panel flex min-h-0 flex-1 flex-col items-center justify-center p-6 font-jetbrains-mono text-[length:var(--fs-body)]">
        {tradingError ? (
          <>
            <p className="text-warn">▲ trading db unavailable</p>
            <p className="mt-2 max-w-md text-center text-text-dim">{tradingError}</p>
          </>
        ) : (
          <p className="text-text-dim">connecting to trading db…</p>
        )}
      </section>
    );
  }

  const m = trading.metrics;
  const cur = trading.currency;
  const thin = m.resolvedCount < THIN_N;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="flex items-center gap-2">
          <span className="font-rajdhani text-[length:var(--fs-body)] font-semibold uppercase tracking-[0.18em] text-text-dim">
            TRADING — {trading.strategy} · paper
          </span>
          {trading.stale && (
            <span className="rounded border border-warn/50 px-1.5 py-0.5 font-jetbrains-mono text-[length:var(--fs-meta)] text-warn">
              ▲ STALE — last good {new Date(trading.fetchedAt).toLocaleTimeString("en-GB")}
            </span>
          )}
        </h2>
        <span className="font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
          read-only · SELECT-only role
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        <Stat
          label="NET P&L"
          value={fmtMoney(m.netPnl, cur)}
          tone={m.netPnl === null ? undefined : m.netPnl >= 0 ? "up" : "down"}
          sub={`${m.resolvedCount} resolved · ${m.openCount} open`}
        />
        <Stat
          label="WIN RATE"
          value={m.winRate === null ? "—" : `${Math.round(m.winRate * 100)}%`}
          sub={`n=${m.resolvedCount}`}
        />
        <Stat
          label="BRIER"
          value={m.brier === null ? "—" : m.brier.toFixed(3)}
          sub={`n=${m.resolvedCount}${m.resolvedCount > 0 && thin ? " — low sample" : ""}`}
        />
        <Stat
          label="AI COST"
          value={fmtMoney(m.totalModelCost, m.modelCostCurrency)}
          sub="model spend, all time"
        />
      </div>

      {thin && (
        <p className="rounded-md border border-border-dim px-4 py-2 font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
          {m.resolvedCount} resolved — charts sharpen as paper trading
          accumulates.
        </p>
      )}

      <Panel title="EQUITY — cumulative P&L">
        {trading.equity.length >= 2 ? (
          <EquityChart data={trading.equity} />
        ) : (
          <Thin>
            {trading.equity.length === 1
              ? "1 resolved trade — curve starts at the second."
              : "no resolved trades yet."}
          </Thin>
        )}
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="CALIBRATION — predicted vs realized">
          {trading.calibration.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ top: 8, right: 8, bottom: 4, left: -22 }}>
                <CartesianGrid stroke={GRID_STROKE} />
                <XAxis
                  type="number"
                  dataKey="mid"
                  domain={[0, 1]}
                  ticks={[0, 0.25, 0.5, 0.75, 1]}
                  tick={AXIS}
                  stroke={GRID_STROKE}
                  name="predicted"
                />
                <YAxis
                  type="number"
                  dataKey="frequency"
                  domain={[0, 1]}
                  ticks={[0, 0.25, 0.5, 0.75, 1]}
                  tick={AXIS}
                  stroke={GRID_STROKE}
                  name="realized"
                />
                <ReferenceLine
                  segment={[
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                  ]}
                  stroke={REF_STROKE}
                  strokeDasharray="4 4"
                  ifOverflow="hidden"
                />
                <Tooltip
                  cursor={{ stroke: REF_STROKE }}
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v))}
                />
                <Scatter data={trading.calibration} fill={SERIES_BLUE} />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <Thin>no resolved predictions to calibrate yet.</Thin>
          )}
        </Panel>

        <Panel title="ROI BY CATEGORY">
          {trading.roiByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={trading.roiByCategory}
                margin={{ top: 8, right: 8, bottom: 4, left: -18 }}
              >
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="category" tick={AXIS} stroke={GRID_STROKE} />
                <YAxis
                  tick={AXIS}
                  stroke={GRID_STROKE}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                />
                <Tooltip
                  cursor={{ fill: GRID_STROKE }}
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v) =>
                    typeof v === "number" ? `${(v * 100).toFixed(1)}%` : String(v)
                  }
                />
                <Bar dataKey="roi" isAnimationActive={false}>
                  {trading.roiByCategory.map((r) => (
                    <Cell
                      key={r.category}
                      fill={(r.roi ?? 0) >= 0 ? SERIES_BLUE : "#ff4757"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Thin>no resolved trades yet — ROI appears with resolutions.</Thin>
          )}
        </Panel>
      </div>

      <Panel title={`OPEN POSITIONS — ${m.openCount}`}>
        {trading.openPositions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full font-jetbrains-mono text-[length:var(--fs-body)]">
              <thead>
                <tr className="border-b border-border-dim text-left text-text-dim">
                  <th className="py-1.5 pr-4 font-normal">market</th>
                  <th className="py-1.5 pr-4 font-normal">side</th>
                  <th className="py-1.5 pr-4 text-right font-normal">p(yes)</th>
                  <th className="py-1.5 pr-4 text-right font-normal">stake</th>
                  <th className="py-1.5 text-right font-normal">opened</th>
                </tr>
              </thead>
              <tbody>
                {trading.openPositions.map((p) => (
                  <tr key={p.label + p.createdAt} className="border-b border-border-dim/50">
                    <td
                      className="max-w-[360px] truncate py-1.5 pr-4 text-ink-cc"
                      title={p.label}
                    >
                      {p.label}
                    </td>
                    <td className="py-1.5 pr-4 uppercase text-blue-bright">{p.side ?? "—"}</td>
                    <td className="py-1.5 pr-4 text-right text-ink-cc">
                      {p.predictedProbability.toFixed(2)}
                    </td>
                    <td className="py-1.5 pr-4 text-right text-ink-cc">
                      {fmtMoney(p.stake, cur)}
                    </td>
                    <td className="py-1.5 text-right text-text-dim">
                      {new Date(p.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Thin>no open positions.</Thin>
        )}
      </Panel>
    </section>
  );
}
