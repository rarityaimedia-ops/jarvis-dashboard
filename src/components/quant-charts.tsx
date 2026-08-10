"use client";

// QUANT — POST-MORTEM CHARTS. Four views of candidates that are already dead.
//
// THE FRAMING IS THE FEATURE, not decoration around it. Every series here belongs to a
// REJECTED hypothesis. Nothing on this screen holds a position, nothing is trading, and no
// agent is deciding anything — that is Phase 5, if it arrives. A chart of a dead
// candidate's equity curve looks exactly like a chart of a live one, so the tab says which
// it is in words rather than trusting the reader to remember.
//
// The charts sit BELOW the kill log and are deliberately quieter than it. §9 of the plan:
// the UI must make the kill rate feel like success, and a screen that celebrates survivors
// teaches the operator to manufacture them. So there is NO GOLD in this file. Gold is the
// kill log's, reserved for the promotable count — the number the system is trying to keep
// at zero. A gold KPI over a rising equity curve is exactly the wrong lesson.
//
// WHY NOT src/components/equity-chart.tsx, which already draws an equity curve:
//   - it is lightweight-charts; this phase is recharts (already a dependency, used by
//     trading.tsx), and running two chart libraries on one tab is worse than either.
//   - it renders exactly ONE series with no way to overlay a comparator, and 4d is
//     candidate-against-SPY by definition.
//   - it has no scatter, so the parameter cliff cannot be drawn with it at all.
//   - it takes {t, equity}[] objects and imperatively owns a chart instance through a ref;
//     this data arrives as parallel arrays from a JSON artifact.
// Four mismatches, three of them structural. Forking it would have meant rewriting all of
// it, so it is left alone for the trading tab and this uses the recharts patterns already
// established in trading.tsx.

import { useState } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Panel, EmptyNote } from "@/components/command-center";
import type {
  QuantPayload,
  QuantCandidate,
  QuantSeries,
  QuantSpy,
} from "@/app/api/quant/route";

/* Chart geometry stays atmosphere-blue, matching trading.tsx. recharts needs literal
   colours for SVG strokes, so these mirror the tokens rather than replacing them:
   SERIES = --blue-bright, DIM = --text-dim, WARN = --warn, OK = --ok. 11px is the type
   floor and the axes sit exactly on it. */
const SERIES = "#6b8cff";
const DIM = "#9fb2d4";
const WARN = "#ff8c42";
const OK = "#34d399";
const GRID_STROKE = "rgba(90, 130, 220, 0.18)";
const REF_STROKE = "rgba(159, 178, 212, 0.55)";
const AXIS = {
  fill: DIM,
  fontSize: 11,
  fontFamily: "var(--font-jetbrains-mono), monospace",
};
const TOOLTIP_STYLE = {
  background: "#0d1526",
  border: "1px solid rgba(90, 130, 220, 0.38)",
  fontFamily: "var(--font-jetbrains-mono), monospace",
  fontSize: 11,
};
/* MASTER-DETAIL, not a 2x2 grid. A quarter of the region gave every chart too little room
   to read: the cliff's three points against its binding bar and the underwater series'
   shape are only legible at full width. One chart is expanded at roughly the height the
   whole 2x2 block used to occupy; the other three sit beneath it as shapes. */
const CHART_H = 420;
const THUMB_H = 44;
const THUMB_MARGIN = { top: 2, right: 2, bottom: 2, left: 2 };

function sharpe(v: number | null | undefined): string {
  return v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(4)}`;
}
function pct(v: number | null | undefined, dp = 2): string {
  return v == null ? "—" : `${v >= 0 ? "" : "−"}${Math.abs(v).toFixed(dp)}%`;
}
function year(d: string): string {
  return d.slice(0, 4);
}
/* recharts types a tooltip value as ValueType | undefined (it can be an array for stacked
   series), so formatters take `unknown` and narrow. Accepting the wider type is what makes
   them assignable to recharts' Formatter — and it means a non-numeric value renders as an
   em dash instead of "NaN%". */
function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/* One caption component, because every panel here needs the same thing: a sentence saying
   what the chart shows and what it does NOT license the reader to conclude. */
function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 max-w-[78ch] font-jetbrains-mono text-[length:var(--fs-meta)] leading-[var(--lh-tight)] text-text-dim">
      {children}
    </p>
  );
}

/* ---------- 4a · equity curve ---------- */

function EquityPanel({ c, q }: { c: QuantCandidate; q: QuantPayload }) {
  const s = c.returns.series;
  const b = q.benchmark;
  return (
    <Panel
      area="equity"
      title="Equity Curve"
      right={
        <span className="font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
          cumulative return
        </span>
      }
    >
      {!s ? (
        <EmptyNote text="no return series" sub={c.returns.reason ?? undefined} />
      ) : (
        <>
          <div style={{ height: CHART_H }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={s.dates.map((d, i) => ({ date: d, equity: s.equityPct[i] }))}
                margin={{ top: 4, right: 8, bottom: 0, left: -8 }}
              >
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="date" tickFormatter={year} tick={AXIS} minTickGap={28} stroke={GRID_STROKE} />
                <YAxis tick={AXIS} stroke={GRID_STROKE} tickFormatter={(v) => `${v}%`} width={52} />
                {/* Zero is the line that matters — above it the candidate made money. */}
                <ReferenceLine y={0} stroke={REF_STROKE} strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: DIM }}
                  formatter={(v: unknown) => [pct(asNum(v)), "cumulative"] as [string, string]}
                />
                <Line type="monotone" dataKey="equity" stroke={SERIES} strokeWidth={1.6} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* THE BENCHMARK IS A NUMBER, NOT A LINE, AND THE CAPTION SAYS SO. Drawing a
              straight line from 0 to the benchmark's total return would imply it grew
              smoothly, which is an invented shape. */}
          <Caption>
            Candidate cumulative return, {s.dates[0]} to {s.dates[s.dates.length - 1]}.
            Benchmark {sharpe(b?.sharpeExcess)} excess Sharpe.{" "}
            {b?.uiNote ??
              "The bar shows the benchmark's final Sharpe. The PATH is unavailable, so where the candidate gained or lost relative to the benchmark cannot be read from this chart."}
          </Caption>
        </>
      )}
    </Panel>
  );
}

/* ---------- 4b · underwater ---------- */

function UnderwaterPanel({ c }: { c: QuantCandidate }) {
  const s = c.returns.series;
  const st = c.returns.stats;
  return (
    <Panel
      area="underwater"
      title="Underwater"
      right={
        <span className="font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
          below running peak
        </span>
      }
    >
      {!s ? (
        <EmptyNote text="no return series" sub={c.returns.reason ?? undefined} />
      ) : (
        <>
          <div style={{ height: CHART_H }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={s.dates.map((d, i) => ({ date: d, uw: s.underwaterPct[i] }))}
                margin={{ top: 4, right: 8, bottom: 0, left: -8 }}
              >
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="date" tickFormatter={year} tick={AXIS} minTickGap={28} stroke={GRID_STROKE} />
                <YAxis tick={AXIS} stroke={GRID_STROKE} tickFormatter={(v) => `${v}%`} width={52} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: DIM }}
                  formatter={(v: unknown) => [pct(asNum(v)), "below peak"] as [string, string]}
                />
                {/* The max drawdown gets a labelled line: the trough is the number the
                    caption quotes, and a reader should be able to see where it sits. */}
                {st?.maxDrawdownPct != null && (
                  <ReferenceLine
                    y={st.maxDrawdownPct}
                    stroke={WARN}
                    strokeDasharray="4 3"
                    label={{
                      value: `max ${pct(st.maxDrawdownPct)}`,
                      position: "insideBottomRight",
                      fill: WARN,
                      fontSize: 11,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                    }}
                  />
                )}
                <Area type="monotone" dataKey="uw" stroke={SERIES} strokeWidth={1.4} fill={SERIES} fillOpacity={0.16} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <Caption>
            Max drawdown {pct(st?.maxDrawdownPct)} over{" "}
            {st?.maxDrawdownDurationBars ?? "—"} bars, both computed on all {st?.bars ?? "—"}{" "}
            bars rather than the plotted series. A healthy strategy sits near 0% most of the
            period.
          </Caption>
          {/* 4b GETS NO BENCHMARK SCALAR FALLBACK. There is no benchmark drawdown anywhere
              in the journal — not even a scalar — so unlike the equity panel there is
              nothing honest to quote. Saying so beats an empty half-comparison. */}
          <p className="mt-1.5 max-w-[78ch] font-jetbrains-mono text-[length:var(--fs-meta)] leading-[var(--lh-tight)] text-warn">
            NO BENCHMARK COMPARISON IS AVAILABLE. The benchmark&rsquo;s drawdown was never
            journalled — not as a series and not as a scalar — so there is nothing to
            compare this against. None has been invented.
          </p>
        </>
      )}
    </Panel>
  );
}

/* ---------- 4c · parameter cliff ---------- */

function CliffPanel({ c }: { c: QuantCandidate }) {
  const g = c.gate4;
  const points = g.neighbours;
  return (
    <Panel
      area="cliff"
      title="Parameter Cliff"
      right={
        <span className="font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
          gate 4 · {g.parameter ?? "—"}
        </span>
      }
    >
      {!points || points.length === 0 ? (
        // V7: a candidate that never reached gate 4 names the gate it DID die at. A blank
        // panel would read as "gate 4 found nothing", which is a different claim.
        <EmptyNote
          text="never reached gate 4"
          sub={g.reason ?? "no gate 4 result recorded for this candidate"}
        />
      ) : (
        <>
          <div style={{ height: CHART_H }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid stroke={GRID_STROKE} />
                <XAxis
                  type="number"
                  dataKey="value"
                  name={g.parameter ?? "parameter"}
                  tick={AXIS}
                  stroke={GRID_STROKE}
                  domain={["dataMin - 20", "dataMax + 20"]}
                />
                <YAxis
                  type="number"
                  dataKey="sharpe"
                  tick={AXIS}
                  stroke={GRID_STROKE}
                  width={52}
                  tickFormatter={(v: number) => v.toFixed(2)}
                  domain={["dataMin - 0.05", "dataMax + 0.05"]}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: DIM }}
                  cursor={{ stroke: REF_STROKE }}
                  formatter={(v: unknown, n: unknown) =>
                    (n === "sharpe"
                      ? [sharpe(asNum(v)), "excess Sharpe"]
                      : [String(v), g.parameter ?? "value"]) as [string, string]
                  }
                />
                {/* THE BAR IS THE CHART'S POINT. Everything below this line failed. */}
                {g.bindingBar != null && (
                  <ReferenceLine
                    y={g.bindingBar}
                    stroke={WARN}
                    strokeDasharray="4 3"
                    label={{
                      value: `binding bar ${sharpe(g.bindingBar)}`,
                      position: "insideTopRight",
                      fill: WARN,
                      fontSize: 11,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                    }}
                  />
                )}
                <Scatter
                  data={points.map((p) => ({
                    value: p.value,
                    sharpe: p.sharpeExcess,
                    passed: p.passed,
                    isBase: p.isBase,
                  }))}
                  line={{ stroke: DIM, strokeWidth: 1 }}
                  shape="circle"
                >
                  {points.map((p, i) => (
                    <Cell
                      key={i}
                      // The base is the candidate itself and was never judged as a
                      // neighbour, so it is drawn in the candidate's own blue rather than
                      // pass-green or fail-orange, which would assert a verdict it has not.
                      fill={p.isBase ? SERIES : p.passed === false ? WARN : OK}
                      r={p.isBase ? 6 : 5}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <Caption>
            Each point is one neighbour&rsquo;s excess Sharpe at a perturbed{" "}
            {g.parameter ?? "parameter"}; the larger blue point is the submitted candidate
            at {sharpe(g.baseSharpeExcess)}. Anything below the bar failed{" "}
            {g.bindingCondition ?? "the binding condition"} — which is what killed this
            candidate. The edge is a knife edge, not a plateau.
          </Caption>
        </>
      )}
    </Panel>
  );
}

/* ---------- 4d · beta overlay ---------- */

/* The reading the number licenses. A trend follower ON SPY that rises and falls with SPY
   is a long position with extra steps, and it is far better to learn that from a chart
   than from a live account. The thresholds are stated so the wording cannot drift from the
   number it is describing. */
function correlationReading(r: number): string {
  const a = Math.abs(r);
  if (a >= 0.7) {
    return "This is very close to a long position with extra steps: it rises when SPY rises and falls when it falls. The strategy is mostly market exposure wearing a rulebook.";
  }
  if (a >= 0.4) {
    return "A substantial share of this candidate's movement is just SPY's. Some of what looks like edge is market exposure.";
  }
  return "The candidate moves largely independently of SPY on a daily basis, so its returns are not simply market exposure re-labelled. That is a point in its favour — and it still died at its gate.";
}

// Merged BY DATE rather than by index. Both series are thinned from the same grid with the
// same factor so the indices do line up today, but a lookup cannot silently shift a curve
// sideways if that ever stops being true. Shared with the beta thumbnail so the shape a
// reader clicks is the shape they get.
function betaData(s: QuantSeries, spy: NonNullable<QuantSpy>) {
  const spyBy = new Map(spy.dates.map((d, i) => [d, spy.equityPct[i]]));
  return s.dates.map((d, i) => ({
    date: d,
    candidate: s.equityPct[i],
    spy: spyBy.get(d) ?? null,
  }));
}

function BetaPanel({ c, q }: { c: QuantCandidate; q: QuantPayload }) {
  const s = c.returns.series;
  const spy = q.spy.series;
  const r = c.returns.spyCorrelation;

  if (!s) {
    return (
      <Panel area="beta" title="Beta Overlay">
        <EmptyNote text="no return series" sub={c.returns.reason ?? undefined} />
      </Panel>
    );
  }
  if (!spy) {
    return (
      <Panel area="beta" title="Beta Overlay">
        <EmptyNote text="no SPY series" sub={q.spy.reason ?? undefined} />
      </Panel>
    );
  }

  const data = betaData(s, spy);

  return (
    <Panel
      area="beta"
      title="Beta Overlay"
      right={
        <span className="font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
          vs SPY
        </span>
      }
    >
      <div className="flex min-h-0 gap-3">
        <div className="min-w-0 flex-1" style={{ height: CHART_H }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="date" tickFormatter={year} tick={AXIS} minTickGap={28} stroke={GRID_STROKE} />
              <YAxis tick={AXIS} stroke={GRID_STROKE} tickFormatter={(v) => `${v}%`} width={52} />
              <ReferenceLine y={0} stroke={REF_STROKE} strokeDasharray="3 3" />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: DIM }}
                formatter={(v: unknown, n: unknown) =>
                  [pct(asNum(v)), n === "spy" ? "SPY" : "candidate"] as [string, string]
                }
              />
              {/* SPY dim and behind, candidate in blue on top: the candidate is the subject
                  and SPY is the thing it is being tested against. */}
              <Line type="monotone" dataKey="spy" stroke={DIM} strokeWidth={1.2} dot={false} strokeDasharray="4 3" />
              <Line type="monotone" dataKey="candidate" stroke={SERIES} strokeWidth={1.6} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* The number beside the chart. NOT gold — see the file header; nothing on this
            screen is a KPI to be maximised. */}
        <div className="w-[13ch] shrink-0 self-center border-l border-border-dim/60 pl-3">
          <div className="font-rajdhani text-[length:var(--fs-meta)] font-semibold uppercase tracking-[0.15em] text-text-dim">
            correlation
          </div>
          <div className="mt-1 font-jetbrains-mono text-xl font-semibold leading-none tracking-[0.08em] text-ink-cc">
            {r == null ? "—" : r.toFixed(4)}
          </div>
          <div className="mt-1.5 font-jetbrains-mono text-[length:var(--fs-meta)] leading-[var(--lh-tight)] text-text-dim">
            daily returns
            <br />
            all {s.fullBars} bars
          </div>
        </div>
      </div>
      <Caption>
        Candidate cumulative return against SPY&rsquo;s own, from{" "}
        <span className="text-ink-cc">get_returns</span> (adjusted close, the only sanctioned
        price path). THE TEST: if the candidate rises when SPY rises and falls when it
        falls, it is not a strategy — it is a long position with extra steps.{" "}
        {r == null ? "The correlation could not be computed." : correlationReading(r)}
      </Caption>
    </Panel>
  );
}

/* ---------- the four charts, as one registry ----------
 *
 * One list drives both slots: the expanded view renders `view`, the row beneath renders
 * `thumb`. Splitting them into two hand-maintained lists is how a thumbnail ends up
 * promoting a different chart than the one it drew.
 *
 * A THUMBNAIL IS NOT THE EXPANDED CHART SHRUNK — that is the unreadability this layout
 * exists to fix. Axes, gridlines, tooltips, legends and captions are all stripped; what is
 * left is the SHAPE of the series and the one number that names it. Captions in
 * particular appear ONLY when expanded: at thumbnail width a sentence of prose is a grey
 * smear, and these captions are the honest-state text, which must never be rendered
 * illegibly rather than not at all.
 */
type ChartThumb = {
  // The single most important number. "—" when there is nothing honest to put here — never
  // a zero, which would read as a measured result.
  headline: string;
  // What the number IS. The bare figure is ambiguous: +0.5479 could be a Sharpe bar or a
  // correlation, and the reader has no axis to tell them apart at this size.
  unit: string;
  // null when there is no series to draw. Rendered as a dim dash with the reason on hover
  // rather than an EmptyNote, which is a block element built for a panel body and would
  // dwarf a 44px shape. The FULL explanation is still shown, in the expanded view.
  shape: React.ReactNode | null;
  reason: string | null;
};

const CHARTS: {
  label: string;
  view: (c: QuantCandidate, q: QuantPayload) => React.ReactNode;
  thumb: (c: QuantCandidate, q: QuantPayload) => ChartThumb;
}[] = [
  {
    label: "Equity Curve",
    view: (c, q) => <EquityPanel c={c} q={q} />,
    thumb: (c) => {
      const s = c.returns.series;
      return {
        headline: s ? pct(s.equityPct[s.equityPct.length - 1]) : "—",
        unit: "cumulative",
        reason: s ? null : c.returns.reason,
        shape: s ? (
          <LineChart data={s.equityPct.map((v) => ({ v }))} margin={THUMB_MARGIN} accessibilityLayer={false}>
            <Line
              type="monotone"
              dataKey="v"
              stroke={SERIES}
              strokeWidth={1.3}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        ) : null,
      };
    },
  },
  {
    label: "Underwater",
    view: (c) => <UnderwaterPanel c={c} />,
    thumb: (c) => {
      const s = c.returns.series;
      return {
        // The drawdown comes from `stats`, computed on all bars — not from the thinned
        // series drawn beside it, which steps over troughs and reports a shallower loss.
        headline: pct(c.returns.stats?.maxDrawdownPct),
        unit: "max drawdown",
        reason: s ? null : c.returns.reason,
        shape: s ? (
          <AreaChart data={s.underwaterPct.map((v) => ({ v }))} margin={THUMB_MARGIN} accessibilityLayer={false}>
            <Area
              type="monotone"
              dataKey="v"
              stroke={SERIES}
              strokeWidth={1.2}
              fill={SERIES}
              fillOpacity={0.16}
              isAnimationActive={false}
            />
          </AreaChart>
        ) : null,
      };
    },
  },
  {
    label: "Parameter Cliff",
    view: (c) => <CliffPanel c={c} />,
    thumb: (c) => {
      const g = c.gate4;
      const pts = g.neighbours;
      return {
        headline: sharpe(g.bindingBar),
        unit: "binding bar",
        reason:
          pts && pts.length > 0
            ? null
            : (g.reason ?? "never reached gate 4 — no gate 4 result recorded"),
        shape:
          pts && pts.length > 0 ? (
            <ScatterChart margin={THUMB_MARGIN} accessibilityLayer={false}>
              {/* Hidden, but present: a ScatterChart has no scale to place a point on
                  without its axes. `hide` removes the ticks and the line, not the maths. */}
              <XAxis type="number" dataKey="value" hide domain={["dataMin", "dataMax"]} />
              <YAxis type="number" dataKey="sharpe" hide domain={["dataMin", "dataMax"]} />
              {/* THE BAR IS THE SHAPE. Three dots alone say nothing; three dots straddling
                  the line that killed the candidate is the whole chart. extendDomain keeps
                  the bar in frame even when every neighbour sits on one side of it. */}
              {g.bindingBar != null && (
                <ReferenceLine
                  y={g.bindingBar}
                  stroke={WARN}
                  strokeDasharray="3 2"
                  ifOverflow="extendDomain"
                />
              )}
              <Scatter
                data={pts.map((p) => ({ value: p.value, sharpe: p.sharpeExcess }))}
                line={{ stroke: DIM, strokeWidth: 1 }}
                shape="circle"
                isAnimationActive={false}
              >
                {pts.map((p, i) => (
                  <Cell
                    key={i}
                    fill={p.isBase ? SERIES : p.passed === false ? WARN : OK}
                    r={p.isBase ? 4 : 3}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          ) : null,
      };
    },
  },
  {
    label: "Beta Overlay",
    view: (c, q) => <BetaPanel c={c} q={q} />,
    thumb: (c, q) => {
      const s = c.returns.series;
      const spy = q.spy.series;
      const r = c.returns.spyCorrelation;
      return {
        headline: r == null ? "—" : r.toFixed(4),
        unit: "SPY correlation",
        // Two ways to have no shape, and they are different facts: the candidate has no
        // series, or SPY does. The correlation can still exist without either drawn.
        reason: s ? (spy ? null : q.spy.reason) : c.returns.reason,
        shape:
          s && spy ? (
            <LineChart data={betaData(s, spy)} margin={THUMB_MARGIN} accessibilityLayer={false}>
              <Line
                type="monotone"
                dataKey="spy"
                stroke={DIM}
                strokeWidth={1}
                dot={false}
                strokeDasharray="3 2"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="candidate"
                stroke={SERIES}
                strokeWidth={1.3}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          ) : null,
      };
    },
  },
];

function ChartRegion({
  c,
  q,
  chart,
  setChart,
}: {
  c: QuantCandidate;
  q: QuantPayload;
  chart: number;
  setChart: (i: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Client-side promotion only. The payload already holds all four charts for every
          candidate, so switching is a view change and never a refetch.

          The floor is what keeps the thumbnail row STILL. An honest state is a couple of
          lines tall and a chart is 420, so without it the row a reader is clicking jumps
          up under their cursor the moment they promote a chart with no series — and
          arrowing across a candidate like acc_03_coinflip, where all four are empty, would
          make the whole region flicker between two heights.

          A FLEX column, not a grid: each Panel still carries the `gridArea` it needed under
          the old 2x2 layout, and inside a grid container that stale name places the panel
          into an implicit track — it renders half-width and off to one side. Flex ignores
          gridArea, so the child variant is what stretches the panel to the floor. */}
      <div className="flex flex-col [&>section]:flex-1" style={{ minHeight: CHART_H }}>
        {CHARTS[chart].view(c, q)}
      </div>

      <div
        role="group"
        aria-label="Select chart"
        // Arrows cycle. NUMBER KEYS ARE DELIBERATELY NOT BOUND: 1-4 already switch tabs at
        // the app level, and that shortcut list is derived from TABS — binding them here
        // would shadow navigation from inside one tab.
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          const step = e.key === "ArrowRight" ? 1 : CHARTS.length - 1;
          setChart((chart + step) % CHARTS.length);
        }}
        className="flex gap-2"
      >
        {CHARTS.map((ch, i) => {
          const t = ch.thumb(c, q);
          const on = i === chart;
          return (
            <button
              key={ch.label}
              type="button"
              onClick={() => setChart(i)}
              aria-pressed={on}
              // The accessible name carries what the picture cannot: the headline number,
              // or the reason there is no picture. The shape itself is aria-hidden.
              aria-label={
                t.reason
                  ? `${ch.label} — unavailable: ${t.reason}`
                  : `${ch.label} — ${t.headline} ${t.unit}`
              }
              title={t.reason ?? undefined}
              // Border + background tint, the pattern this app already uses to mark a
              // selected row (bg-blue/10 in the sidebar, the palette, and the candidate
              // selector directly above). Not a side stripe.
              className={`flex min-w-0 flex-1 basis-0 flex-col gap-1 rounded-sm border px-2.5 py-2 text-left transition-colors ${
                on
                  ? "border-blue-bright/50 bg-blue/10"
                  : "border-border-dim hover:border-blue-bright/40"
              }`}
            >
              {/* The label brightens on selection, the way the candidate selector above
                  brightens its own. Border-plus-tint alone is a 2.39:1 border over a tint
                  that is barely above the base — the text step is what actually carries
                  the state at a glance, and it is the same step the sibling control makes. */}
              <span
                className={`truncate font-rajdhani text-[length:var(--fs-meta)] font-semibold uppercase tracking-[0.15em] ${
                  on ? "text-ink-cc" : "text-text-dim"
                }`}
              >
                {ch.label}
              </span>
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="shrink-0 font-jetbrains-mono text-[length:var(--fs-body)] text-ink-cc">
                  {t.headline}
                </span>
                <span className="truncate font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
                  {t.unit}
                </span>
              </span>
              <div style={{ height: THUMB_H }} aria-hidden>
                {t.shape ? (
                  <ResponsiveContainer width="100%" height="100%">
                    {t.shape}
                  </ResponsiveContainer>
                ) : (
                  // The honest state at thumbnail scale. The reason is on hover and in the
                  // accessible name; the full explanation is in the expanded view.
                  <div className="flex h-full items-center justify-center font-jetbrains-mono text-[length:var(--fs-body)] text-text-dim">
                    —
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- the tab section ---------- */

export default function QuantCharts({ q }: { q: QuantPayload }) {
  // The selection is DERIVED, not stored outright: useState's initialiser runs once, and
  // this component can mount while the artifact is still offline (no candidates) and be
  // re-rendered when it comes back. A stored default captured from that first empty render
  // would stick at "" forever and the panel would sit on "no candidate selected" with a
  // full artifact behind it. Deriving also self-heals when a selected id disappears from a
  // later artifact.
  const [picked, setPicked] = useState<string | null>(null);
  // Which chart is expanded. Held HERE rather than inside ChartRegion so that changing the
  // candidate — or stepping through a draft-only family, which unmounts the region because
  // it has no charts at all — keeps the reader on the chart they were reading. Index 0 is
  // the equity curve, the default.
  const [chart, setChart] = useState(0);
  // acc_05_ts_trend is the default because it is the only candidate that ever beat the
  // benchmark and the only one that reached gate 4 — the most instructive failure here.
  const fallback =
    q.candidates.find((x) => x.id === "acc_05_ts_trend")?.id ?? q.candidates[0]?.id ?? null;
  const stillExists =
    picked !== null &&
    (q.candidates.some((x) => x.id === picked) ||
      q.draftFamilies.some((f) => f.familyTag === picked));
  const selected = stillExists ? picked : fallback;
  const c = q.candidates.find((x) => x.id === selected) ?? null;
  // acc_01_overfit has NO strategy_candidates row — it is 2,349 backtested grid tuples in
  // generator_drafts. Selecting it must show that state, not an error and not zeros.
  const family = q.draftFamilies.find((f) => f.familyTag === selected) ?? null;

  if (q.candidates.length === 0 && q.draftFamilies.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      {/* 4e · MANDATORY FRAMING. This sits above the charts and outside any panel, so it
          cannot be scrolled away inside one. Without it the tab starts reading like a
          trading terminal the moment a curve appears on it. */}
      <div className="cc-panel px-3.5 py-2.5">
        <p className="max-w-[92ch] font-jetbrains-mono text-[length:var(--fs-body)] leading-[var(--lh-tight)] text-ink-cc">
          THESE ARE POST-MORTEMS OF REJECTED HYPOTHESES. Nothing below is live, nothing
          holds a position, and nothing is trading.
        </p>
        <p className="mt-1 max-w-[92ch] font-jetbrains-mono text-[length:var(--fs-meta)] leading-[var(--lh-tight)] text-text-dim">
          Every series here shows what a candidate DID before it was killed — not what
          anything is doing now. A dead candidate&rsquo;s equity curve looks exactly like a
          live one, which is why this line exists. These charts are a record of things that
          did not work, and that is the system functioning.
        </p>
      </div>

      <div
        role="group"
        aria-label="Select candidate"
        className="flex flex-wrap items-center gap-2 px-1"
      >
        <span aria-hidden className="font-rajdhani text-[length:var(--fs-meta)] font-semibold uppercase tracking-[0.15em] text-text-dim">
          candidate
        </span>
        {q.candidates.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setPicked(x.id)}
            aria-pressed={x.id === selected}
            className={`rounded-sm border px-2.5 py-1 font-jetbrains-mono text-[length:var(--fs-meta)] transition-colors ${
              x.id === selected
                ? "border-blue-bright/50 bg-blue/10 text-ink-cc"
                : "border-border-dim text-text-dim hover:text-ink-cc"
            }`}
          >
            {x.id}
          </button>
        ))}
        {/* Draft-only families are selectable and LABELLED as not being candidates. */}
        {q.draftFamilies
          .filter((f) => f.countsTowardDsrN)
          .map((f) => (
            <button
              key={f.familyTag}
              type="button"
              onClick={() => setPicked(f.familyTag)}
              aria-pressed={f.familyTag === selected}
              className={`rounded-sm border border-dashed px-2.5 py-1 font-jetbrains-mono text-[length:var(--fs-meta)] transition-colors ${
                f.familyTag === selected
                  ? "border-warn/60 bg-warn/10 text-warn"
                  : "border-border-dim text-text-dim hover:text-ink-cc"
              }`}
            >
              {f.familyTag} · drafts only
            </button>
          ))}
      </div>

      {family ? (
        // V8's honest state. Not an error, and emphatically not zeros: this family really
        // did run 2,349 backtests, and every one of them still counts against any future
        // survivor's deflated-Sharpe bar.
        <div className="cc-panel px-3.5 py-3">
          <p className="font-jetbrains-mono text-[length:var(--fs-body)] leading-[var(--lh-tight)] text-warn">
            NO CANDIDATE ROW · {family.familyTag}
          </p>
          <p className="mt-1.5 max-w-[92ch] font-jetbrains-mono text-[length:var(--fs-body)] leading-[var(--lh-tight)] text-text-dim">
            {family.note}
          </p>
          <p className="mt-2 max-w-[92ch] font-jetbrains-mono text-[length:var(--fs-meta)] leading-[var(--lh-tight)] text-text-dim">
            {family.drafts} drafts · {family.backtested} backtested ·{" "}
            {family.promoted} promoted · best Sharpe {sharpe(family.bestSharpe)}. There are
            no charts for this family because there is nothing journalled to draw: no gate
            verdict, no kill reason, and no return series. That is a real state, not a
            missing one.
          </p>
        </div>
      ) : !c ? (
        <div className="cc-panel px-3.5 py-3">
          <EmptyNote text="no candidate selected" />
        </div>
      ) : (
        <ChartRegion c={c} q={q} chart={chart} setChart={setChart} />
      )}

      {q.downsample && (
        <p className="max-w-[100ch] px-1 font-jetbrains-mono text-[length:var(--fs-meta)] leading-[var(--lh-tight)] text-text-dim">
          PLOTTED SERIES ARE DOWNSAMPLED — {q.downsample.basis} (factor{" "}
          {q.downsample.factor}). Every statistic quoted above — drawdown, duration,
          correlation — is computed on the full series before thinning, never on the drawn
          one.
        </p>
      )}
    </section>
  );
}
