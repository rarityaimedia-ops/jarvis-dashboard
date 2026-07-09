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

const AXIS = { fill: "#8A8578", fontSize: 10, fontFamily: "monospace" };
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
    <div className="flex-1 border border-hairline px-4 py-3">
      <div className="font-mono text-[10px] tracking-[0.25em] text-muted">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-xl ${
          tone === "down" ? "text-failure" : tone === "up" ? "text-emerald" : "text-gold"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 font-mono text-[10px] text-muted">{sub}</div>}
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
    <div className="hud-panel p-4">
      <h3 className="font-mono text-[10px] tracking-[0.25em] text-muted">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Thin({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center font-mono text-xs text-muted">{children}</p>;
}

export default function TradingPanel() {
  const trading = useJarvis((s) => s.trading);
  const tradingError = useJarvis((s) => s.tradingError);

  if (!trading) {
    return (
      <section className="hud-panel flex min-h-0 flex-1 flex-col items-center justify-center p-6 font-mono text-xs">
        {tradingError ? (
          <>
            <p className="text-warning">trading db unavailable</p>
            <p className="mt-2 max-w-md text-center text-muted">{tradingError}</p>
          </>
        ) : (
          <p className="text-muted">connecting to trading db…</p>
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
        <h2 className="font-mono text-xs tracking-widest text-muted">
          TRADING — {trading.strategy} · paper
          {trading.stale && (
            <span className="ml-2 border border-warning/60 px-1.5 py-0.5 text-[10px] text-warning">
              STALE — last good {new Date(trading.fetchedAt).toLocaleTimeString("en-GB")}
            </span>
          )}
        </h2>
        <span className="font-mono text-[10px] text-muted">
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
        <p className="border border-hairline px-4 py-2 font-mono text-[11px] text-muted">
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
                <CartesianGrid stroke="#24211B" />
                <XAxis
                  type="number"
                  dataKey="mid"
                  domain={[0, 1]}
                  ticks={[0, 0.25, 0.5, 0.75, 1]}
                  tick={AXIS}
                  stroke="#24211B"
                  name="predicted"
                />
                <YAxis
                  type="number"
                  dataKey="frequency"
                  domain={[0, 1]}
                  ticks={[0, 0.25, 0.5, 0.75, 1]}
                  tick={AXIS}
                  stroke="#24211B"
                  name="realized"
                />
                <ReferenceLine
                  segment={[
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                  ]}
                  stroke="#4A3F1E"
                  strokeDasharray="4 4"
                  ifOverflow="hidden"
                />
                <Tooltip
                  cursor={{ stroke: "#4A3F1E" }}
                  contentStyle={{
                    background: "#141210",
                    border: "1px solid #24211B",
                    fontFamily: "monospace",
                    fontSize: 11,
                  }}
                  formatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v))}
                />
                <Scatter data={trading.calibration} fill="#D4AF37" />
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
                <CartesianGrid stroke="#24211B" vertical={false} />
                <XAxis dataKey="category" tick={AXIS} stroke="#24211B" />
                <YAxis
                  tick={AXIS}
                  stroke="#24211B"
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                />
                <Tooltip
                  cursor={{ fill: "#24211B" }}
                  contentStyle={{
                    background: "#141210",
                    border: "1px solid #24211B",
                    fontFamily: "monospace",
                    fontSize: 11,
                  }}
                  formatter={(v) =>
                    typeof v === "number" ? `${(v * 100).toFixed(1)}%` : String(v)
                  }
                />
                <Bar dataKey="roi" isAnimationActive={false}>
                  {trading.roiByCategory.map((r) => (
                    <Cell
                      key={r.category}
                      fill={(r.roi ?? 0) >= 0 ? "#D4AF37" : "#F87171"}
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
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr className="border-b border-hairline text-left text-muted">
                  <th className="py-1.5 pr-4 font-normal">market</th>
                  <th className="py-1.5 pr-4 font-normal">side</th>
                  <th className="py-1.5 pr-4 text-right font-normal">p(yes)</th>
                  <th className="py-1.5 pr-4 text-right font-normal">stake</th>
                  <th className="py-1.5 text-right font-normal">opened</th>
                </tr>
              </thead>
              <tbody>
                {trading.openPositions.map((p) => (
                  <tr key={p.label + p.createdAt} className="border-b border-hairline/50">
                    <td className="max-w-[360px] truncate py-1.5 pr-4 text-ink" title={p.label}>
                      {p.label}
                    </td>
                    <td className="py-1.5 pr-4 uppercase text-gold">{p.side ?? "—"}</td>
                    <td className="py-1.5 pr-4 text-right text-ink">
                      {p.predictedProbability.toFixed(2)}
                    </td>
                    <td className="py-1.5 pr-4 text-right text-ink">
                      {fmtMoney(p.stake, cur)}
                    </td>
                    <td className="py-1.5 text-right text-muted">
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
