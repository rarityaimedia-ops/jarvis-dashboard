"use client";

// HUD chrome: header (clock/uptime), left rail (vitals gauges + system
// status), right rail (compact portfolio + situational ALERT), bottom ticker.

import { useEffect, useRef, useState } from "react";
import { useJarvis, type Tab } from "@/lib/store";
import { sfx } from "@/lib/audio";
import MiniBrain from "@/components/mini-brain";

export const TABS: { key: Tab; label: string }[] = [
  { key: "brain", label: "BRAIN" },
  { key: "trading", label: "TRADING" },
  { key: "ops", label: "OPS" },
];

/* ---------- header ---------- */

export function HudHeader() {
  const vitals = useJarvis((s) => s.vitals);
  const tab = useJarvis((s) => s.tab);
  const set = useJarvis((s) => s.set);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clock must render client-side only to avoid hydration mismatch
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-1">
      <div className="flex items-baseline gap-6">
        <span className="text-base font-semibold tracking-[0.4em] text-gold">
          RARITY&nbsp;//&nbsp;JARVIS
        </span>
        <nav className="flex items-baseline gap-1 font-mono text-[11px]" aria-label="Sections">
          {TABS.map((t, i) => (
            <button
              key={t.key}
              onClick={() => {
                sfx.tick();
                set({ tab: t.key });
              }}
              aria-current={tab === t.key ? "page" : undefined}
              title={`Switch section (${i + 1})`}
              className={`border px-3 py-1 tracking-[0.2em] transition-colors ${
                tab === t.key
                  ? "border-gold-border bg-bg text-gold"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex items-baseline gap-5 font-mono text-xs text-muted">
        {vitals && <span>sys {fmtDur(vitals.procUptime)}</span>}
        <span suppressHydrationWarning className="text-ink">
          {now
            ? now.toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })
            : "—"}
        </span>
        <span suppressHydrationWarning className="text-sm text-gold">
          {now ? now.toLocaleTimeString("en-GB") : "--:--:--"}
        </span>
      </div>
    </header>
  );
}

/* ---------- gauges + left rail ---------- */

function Gauge({
  label,
  pct,
  display,
}: {
  label: string;
  pct: number; // 0..1
  display: string;
}) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const ARC = 0.75 * C;
  const off = ARC * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`${label} ${display}`}>
        <g transform="rotate(135 42 42)">
          <circle
            cx="42"
            cy="42"
            r={R}
            fill="none"
            stroke="#24211B"
            strokeWidth="5"
            strokeDasharray={`${ARC} ${C}`}
          />
          <circle
            className="gauge-arc"
            cx="42"
            cy="42"
            r={R}
            fill="none"
            stroke="#D4AF37"
            strokeWidth="5"
            strokeDasharray={`${ARC} ${C}`}
            strokeDashoffset={off}
            strokeLinecap="butt"
          />
        </g>
        <text
          x="42"
          y="46"
          textAnchor="middle"
          className="fill-[#E8E4D8] font-mono text-[13px]"
        >
          {display}
        </text>
      </svg>
      <span className="font-mono text-[10px] tracking-[0.25em] text-muted">
        {label}
      </span>
    </div>
  );
}

export function LeftRail() {
  const vitals = useJarvis((s) => s.vitals);
  const health = useJarvis((s) => s.health);
  const graph = useJarvis((s) => s.graph);
  const hub = useJarvis((s) => s.hub);
  const communities = graph
    ? new Set(graph.nodes.map((n) => n.community)).size
    : null;
  return (
    <aside className="hud-panel flex flex-col gap-5 p-4">
      <div className="flex justify-around">
        <Gauge
          label="CPU"
          pct={(vitals?.cpu ?? 0) / 100}
          display={vitals ? `${vitals.cpu}%` : "—"}
        />
        <Gauge
          label="RAM"
          pct={vitals ? vitals.ramUsed / vitals.ramTotal : 0}
          display={vitals ? gb(vitals.ramUsed) : "—"}
        />
      </div>
      <dl className="space-y-1.5 font-mono text-[11px]">
        <Row k="ram total" v={vitals ? gb(vitals.ramTotal) : "—"} />
        <Row k="os uptime" v={vitals ? fmtDur(vitals.osUptime) : "—"} />
        <Row k="nodes" v={graph ? String(graph.nodes.length) : "—"} />
        <Row k="communities" v={communities != null ? String(communities) : "—"} />
        <Row k="projects" v={hub ? String(hub.portfolio.length) : "—"} />
        <Row
          k="next job"
          v={health?.nextJob.time?.replace(/:\d{2}$/, "") ?? "—"}
        />
      </dl>
      <MiniBrain />
    </aside>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  );
}

/* ---------- right rail: portfolio dots + ALERT ---------- */

function dotColor(status: string): string {
  if (/live/i.test(status)) return "bg-emerald";
  if (/active|trading/i.test(status)) return "bg-gold";
  return "bg-muted";
}

export function RightRail() {
  const hub = useJarvis((s) => s.hub);
  const health = useJarvis((s) => s.health);

  const alerts: string[] = [];
  if (health) {
    if (health.rebuild.status === "failed") alerts.push("graph rebuild FAILED");
    if (health.rebuild.status === "stale")
      alerts.push(`rebuild stale — last ${health.rebuild.lastRun ?? "?"}`);
    if (!health.hermes.running) alerts.push("hermes daemon DOWN");
    if ((health.git.uncommitted ?? 0) > 0)
      alerts.push(`${health.git.uncommitted} uncommitted — push`);
  }

  // alert blip only when the panel APPEARS (silence is a feature)
  const hadAlerts = useRef(false);
  useEffect(() => {
    if (alerts.length > 0 && !hadAlerts.current) sfx.alert();
    hadAlerts.current = alerts.length > 0;
  }, [alerts.length]);

  // record newly-appeared alerts into session history (OPS tab)
  const seenRef = useRef<Set<string>>(new Set());
  const alertsKey = alerts.join("|");
  useEffect(() => {
    const fresh = alertsKey
      ? alertsKey.split("|").filter((a) => !seenRef.current.has(a))
      : [];
    if (fresh.length === 0) return;
    fresh.forEach((a) => seenRef.current.add(a));
    const { alertHistory, set } = useJarvis.getState();
    set({
      alertHistory: [
        ...fresh.map((msg) => ({ t: new Date().toISOString(), msg })),
        ...alertHistory,
      ].slice(0, 50),
    });
  }, [alertsKey]);

  return (
    <aside className="flex flex-col gap-4">
      <div className="hud-panel p-4">
        <h2 className="font-mono text-[10px] tracking-[0.25em] text-muted">
          PORTFOLIO
        </h2>
        <ul className="mt-3 space-y-2.5">
          {(hub?.portfolio ?? []).map((p) => (
            <li key={p.product} className="flex items-center gap-2.5 text-xs">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor(p.status)}`}
              />
              <span className="min-w-0 truncate" title={p.status}>
                {p.product.split("—")[0].trim()}
              </span>
              <span className="ml-auto shrink-0 font-mono text-[10px] text-muted">
                {p.status.split("(")[0].trim().toLowerCase()}
              </span>
            </li>
          ))}
          {!hub && (
            <li className="font-mono text-xs text-muted">loading…</li>
          )}
        </ul>
      </div>

      {alerts.length > 0 && (
        <div className="hud-panel border-warning/60 p-4">
          <h2 className="font-mono text-[10px] tracking-[0.25em] text-warning">
            ⚠ ALERT
          </h2>
          <ul className="mt-2 space-y-1.5 font-mono text-xs text-warning">
            {alerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

/* ---------- bottom ticker ---------- */

export function Ticker() {
  const health = useJarvis((s) => s.health);
  const trading = useJarvis((s) => s.trading);
  const items = [...(health?.ticker ?? [])];
  if (trading?.lastResolved) {
    const r = trading.lastResolved;
    items.push(
      `${trading.strategy} · ${r.label} resolved ${r.outcome === 1 ? "YES" : "NO"} · pnl ${r.pnl >= 0 ? "+" : ""}${r.pnl.toFixed(2)}`
    );
  }
  if (items.length === 0) return null;
  const row = items.join("   ◆   ");
  return (
    <div className="ticker hud-panel overflow-hidden py-1.5" aria-hidden>
      <div className="ticker-track font-mono text-[11px] text-muted">
        <span className="px-6">{row}</span>
        <span className="px-6">{row}</span>
      </div>
    </div>
  );
}

/* ---------- shared fmt ---------- */

function gb(bytes: number): string {
  return `${(bytes / 2 ** 30).toFixed(1)}G`;
}
function fmtDur(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}
