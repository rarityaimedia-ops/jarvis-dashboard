"use client";

// BRAIN tab = the command deck. A dense filled grid: AI-core status rail, the
// dominant 3D core (+ query console), the live intelligence feed, active
// agents, mission timeline, quick commands, system monitor, memory insights,
// portfolio and alerts. Every panel binds to a real source or shows an honest
// empty state — no invented numbers.

import { useCallback, useEffect, useRef, useState } from "react";
import { useJarvis, type AgentSkill, type RunEntry } from "@/lib/store";
import { sfx } from "@/lib/audio";
import GraphModes from "@/components/graph-modes";
import QueryBox from "@/components/query-box";
import MiniBrain from "@/components/mini-brain";
import { Gauge, gb, fmtDur } from "@/components/hud";
import { HermesStartControl } from "@/components/hermes-start-control";
import {
  IconBrain,
  IconSync,
  IconCommand,
  IconMic,
  IconChip,
  IconBolt,
} from "@/components/cc-icons";

/* ---------- shared bits ---------- */

// 4-col grid. The core spans rows 1-2 (~60% height) so the graph is the
// dominant cell; the two new panels (voice, run history) fill without dead
// space — left column reads SYSTEM → VOICE → AGENTS, agents spans the bottom
// two rows for the taller run-enabled cards.
const GRID_STYLE: React.CSSProperties = {
  gridTemplateColumns: "228px minmax(0, 1fr) minmax(0, 1fr) 336px",
  gridTemplateRows:
    "minmax(0, 1.5fr) minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr)",
  gridTemplateAreas: [
    '"overview core core feed"',
    '"voice core core commands"',
    '"agents timeline runhistory portfolio"',
    '"agents monitor memory alerts"',
  ].join(" "),
};

// Exported so the QUANT tab renders in the same shell as the command deck rather than
// growing a third Panel implementation (trading.tsx already has its own).
export function Panel({
  area,
  title,
  live,
  right,
  className = "",
  bodyClass = "",
  children,
}: {
  area: string;
  title: string;
  live?: boolean;
  right?: React.ReactNode;
  className?: string;
  bodyClass?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{ gridArea: area }}
      className={`cc-panel flex min-h-0 flex-col ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border-dim/60 px-3.5 py-2">
        <h2 className="panel-label flex items-center gap-2">
          {title}
          {live && <span className="status-dot is-live" aria-hidden />}
        </h2>
        {right}
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto px-3.5 py-2.5 ${bodyClass}`}>
        {children}
      </div>
    </section>
  );
}

function relTime(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function shortStamp(s: string | null): string {
  if (!s) return "—";
  return s.replace(/:\d{2}$/, "").replace(/\s+/g, " ").trim();
}

/* ---------- AI core overview ---------- */

function AiCoreOverview() {
  const graph = useJarvis((s) => s.graph);
  const agents = useJarvis((s) => s.agents);
  const health = useJarvis((s) => s.health);
  const wakeMode = useJarvis((s) => s.wakeMode);
  const alerts = useJarvis((s) => s.alerts);
  const clusters = graph
    ? new Set(graph.nodes.map((n) => n.community)).size
    : null;
  const err = alerts.some((a) => a.level === "err");

  const rows: {
    label: string;
    value: string;
    dot: string;
    action?: React.ReactNode;
  }[] = [
    {
      label: "Knowledge Core",
      value: graph ? `${graph.nodes.length} nodes` : "syncing",
      dot: graph ? "is-ok" : "is-warn",
    },
    {
      label: "Memory",
      value: clusters != null ? `${clusters} clusters` : "—",
      dot: graph ? "is-ok" : "is-warn",
    },
    { label: "Voice", value: wakeMode ? "wake armed" : "ready", dot: "is-live" },
    {
      label: "Agents",
      value: agents
        ? agents.online
          ? `${agents.skills.length} skill${agents.skills.length === 1 ? "" : "s"}`
          : "offline"
        : "—",
      dot: agents?.online ? "is-ok" : "is-err",
    },
    {
      label: "Hermes",
      value: health ? (health.hermes.running ? `${health.hermes.jobs} jobs` : "") : "—",
      dot: health?.hermes.running ? "is-ok" : "is-err",
      action:
        health && !health.hermes.running ? (
          <HermesStartControl className="!py-0.5" />
        ) : undefined,
    },
    {
      label: "System",
      value: alerts.length ? (err ? "degraded" : "attention") : "optimal",
      dot: alerts.length ? (err ? "is-err" : "is-warn") : "is-ok",
    },
  ];

  return (
    <Panel area="overview" title="AI Core Overview">
      <ul className="flex flex-col gap-1 leading-[var(--lh-tight)]">
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex items-center gap-2.5 rounded-md border border-border-dim/50 px-2.5 py-1.5"
          >
            <span className={`status-dot ${r.dot}`} aria-hidden />
            <span className="font-rajdhani text-[length:var(--fs-body)] font-medium tracking-[0.06em] text-ink-cc">
              {r.label}
            </span>
            {r.action ? (
              <span className="ml-auto">{r.action}</span>
            ) : (
              <span className="ml-auto font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
                {r.value}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ---------- live intelligence feed ---------- */

function IntelFeed() {
  const agents = useJarvis((s) => s.agents);
  const online = agents?.online ?? false;

  const lines: { level: "warn" | "info"; text: string }[] = [];
  if (online) {
    for (const sk of agents!.skills) {
      for (const an of sk.anomalies) lines.push({ level: "warn", text: an });
      for (const m of sk.metrics) {
        // Part 4b: a null delta means NO_BASELINE (no prior window to compare) →
        // render "—", never "0". A genuine measured zero renders "0". Numbers are
        // shown plainly — no "activity up/down" language, since a pending
        // created_at diagnostic means deltas may under-report.
        const d =
          m.delta === null
            ? " (—)"
            : m.delta === 0
              ? " (0)"
              : ` (${m.delta > 0 ? "+" : ""}${m.delta})`;
        lines.push({
          level: "info",
          text: `${m.key.replace(/_/g, " ")} · ${m.current}${d}`,
        });
      }
    }
  }
  const digest = online ? agents!.skills[0]?.digestDate ?? null : null;

  return (
    <Panel
      area="feed"
      title="Live Intelligence Feed"
      live={online}
      right={
        <span className="flex items-center gap-1.5 rounded-full border border-blue-bright/40 px-2 py-0.5">
          <span className="status-dot is-live" aria-hidden />
          <span className="font-jetbrains-mono text-[length:var(--fs-meta)] tracking-[0.15em] text-blue-bright">
            {online ? "LIVE" : "OFFLINE"}
          </span>
        </span>
      }
    >
      {online ? (
        <>
          {digest && (
            <p className="mb-1.5 font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
              digest {digest}
            </p>
          )}
          <ul className="flex flex-col gap-1 leading-[var(--lh-tight)]">
            {lines.map((l, i) => (
              <li
                key={i}
                className={`rounded-md border px-2.5 py-1 font-jetbrains-mono text-[length:var(--fs-body)] ${
                  l.level === "warn"
                    ? "border-warn/40 text-warn"
                    : "border-border-dim/40 text-ink-cc"
                }`}
              >
                {l.level === "warn" ? "▲ " : ""}
                {l.text}
              </li>
            ))}
            {lines.length === 0 && (
              <li className="font-jetbrains-mono text-[length:var(--fs-body)] text-text-dim">
                no metrics reported yet.
              </li>
            )}
          </ul>
        </>
      ) : (
        <EmptyNote text="— CONDUCTOR OFFLINE —" sub="summary unavailable" />
      )}
    </Panel>
  );
}

/* ---------- active agents ---------- */

function StaticWave() {
  const bars = [0.4, 0.8, 0.55, 1, 0.5, 0.75, 0.35];
  return (
    <span className="flex h-4 items-center gap-[2px]" aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full bg-blue-bright/70"
          style={{ height: `${h * 100}%` }}
        />
      ))}
    </span>
  );
}

/* ---------- run-button state machine (Part 5) ---------- */

type RunPhase =
  | "idle"
  | "queued"
  | "running"
  | "ok"
  | "err"
  | "rejected"
  | "stalled";

const POLL_MS = 2500; // ≥ 2s (5f)
const STALL_MS = 180_000; // 3 min queued → STALLED (5g)

// Drives one agent card through the command bus: POST /api/command, then poll
// GET /api/command/[id] until a terminal state. Polling stops on terminal — no
// unbounded loops. The terminal state clears once the agents poll reports a
// newer lastRun (i.e. freshness has refreshed), per 5e.
function useRunJob(skill: AgentSkill) {
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [errText, setErrText] = useState<string | null>(null);
  const startLastRun = useRef<string | null>(null);
  const queuedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);
  useEffect(() => stop, [stop]); // clear on unmount

  // reset terminal state when freshness refreshes to a newer run
  useEffect(() => {
    if (
      (phase === "ok" || phase === "err" || phase === "rejected") &&
      skill.lastRun &&
      skill.lastRun !== startLastRun.current
    ) {
      setPhase("idle");
      setJobId(null);
      setErrText(null);
    }
  }, [skill.lastRun, phase]);

  const poll = useCallback(
    (id: string) => {
      stop();
      timer.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/command/${id}`);
          const data = await res.json();
          if (data.status === "running") {
            setPhase("running");
          } else if (data.status === "queued") {
            if (Date.now() - queuedAt.current > STALL_MS) {
              setPhase("stalled");
              stop();
            } else {
              setPhase("queued");
            }
          } else if (data.status === "done") {
            const s = data.result?.status;
            setErrText(data.result?.error ?? null);
            setPhase(s === "ok" ? "ok" : s === "rejected" ? "rejected" : "err");
            stop();
          } else if (data.status === "not_found") {
            setPhase("err");
            setErrText("job not found");
            stop();
          }
        } catch {
          // transient network blip — the interval simply retries
        }
      }, POLL_MS);
    },
    [stop]
  );

  const run = useCallback(async () => {
    if (phase === "queued" || phase === "running") return;
    startLastRun.current = skill.lastRun;
    setErrText(null);
    setPhase("queued");
    queuedAt.current = Date.now();
    try {
      const res = await fetch("/api/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skill: skill.name, args: {} }),
      });
      if (!res.ok) {
        setPhase("err");
        setErrText("rejected by dashboard");
        return;
      }
      const data = await res.json();
      if (!data.job_id) {
        setPhase("err");
        setErrText("no job id");
        return;
      }
      setJobId(data.job_id);
      poll(data.job_id);
    } catch {
      setPhase("err");
      setErrText("request failed");
    }
  }, [phase, skill.name, skill.lastRun, poll]);

  return { phase, jobId, errText, run };
}

function RunControl({ skill }: { skill: AgentSkill }) {
  const { phase, jobId, errText, run } = useRunJob(skill);
  const shortId = jobId ? jobId.slice(0, 8) : "";

  if (phase === "queued" || phase === "running") {
    const running = phase === "running";
    return (
      <span
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-jetbrains-mono text-[length:var(--fs-meta)] tracking-[0.1em] ${
          running
            ? "border-blue-bright/50 text-blue-bright"
            : "border-border-dim text-text-dim"
        }`}
        aria-busy
      >
        <span className={`status-dot ${running ? "is-live" : "is-ok"}`} aria-hidden />
        {running ? "RUNNING" : "QUEUED"}
        <span className="text-text-dim/80">{shortId}</span>
      </span>
    );
  }
  if (phase === "stalled") {
    return (
      <span
        title="job stayed queued 3 min — the queue watcher may not be running"
        className="flex items-center gap-1.5 rounded-full border border-warn/50 px-2.5 py-0.5 font-jetbrains-mono text-[length:var(--fs-meta)] tracking-[0.1em] text-warn"
      >
        ▲ STALLED · watcher?
      </span>
    );
  }
  if (phase === "ok") {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-ok/40 px-2.5 py-0.5 font-jetbrains-mono text-[length:var(--fs-meta)] tracking-[0.1em] text-ok">
        <span className="status-dot is-ok" aria-hidden />
        OK · just now
      </span>
    );
  }
  if (phase === "rejected") {
    // rejected is a validation refusal, NOT a failure — neutral blue, distinct from ERR
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-border-dim px-2.5 py-0.5 font-jetbrains-mono text-[length:var(--fs-meta)] tracking-[0.1em] text-text-dim">
        <span className="status-dot is-warn" aria-hidden />
        REJECTED
      </span>
    );
  }
  if (phase === "err") {
    return (
      <button
        onClick={() => {
          sfx.tick();
          void run();
        }}
        aria-label={`Retry ${skill.name}`}
        title={errText ? `error: ${errText} — click to retry` : "click to retry"}
        className="flex items-center gap-1.5 rounded-full border border-err/50 px-2.5 py-0.5 font-jetbrains-mono text-[length:var(--fs-meta)] tracking-[0.1em] text-err transition-colors hover:border-err"
      >
        ■ ERR · retry
      </button>
    );
  }
  return (
    <button
      onClick={() => {
        sfx.tick();
        void run();
      }}
      aria-label={`Run ${skill.name}`}
      className="rounded-full border border-blue-bright/40 bg-blue/10 px-3 py-1 font-jetbrains-mono text-[length:var(--fs-meta)] uppercase tracking-[0.15em] text-blue-bright transition-colors hover:border-blue-bright"
    >
      Run
    </button>
  );
}

function AgentCard({ skill }: { skill: AgentSkill }) {
  const dot =
    skill.freshness === "ok"
      ? "is-ok"
      : skill.freshness === "warn"
        ? "is-warn"
        : "is-err";
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border-dim/60 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <IconChip className="text-sm text-blue-bright" />
        <span className="truncate font-rajdhani text-[length:var(--fs-body)] font-semibold tracking-[0.04em] text-ink-cc">
          {skill.name}
        </span>
        <span className={`status-dot ${dot} ml-auto`} aria-hidden />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
          {relTime(skill.lastRun)}
        </span>
        <RunControl skill={skill} />
      </div>
    </div>
  );
}

// A never-run skill / unfilled slot renders DIM (not zero), per Part 4a.
function EmptySlot() {
  return (
    <div className="flex items-center justify-center rounded-md border border-dashed border-border-dim/40 px-2.5 py-2.5 opacity-60">
      <span className="font-jetbrains-mono text-[length:var(--fs-meta)] tracking-[0.1em] text-text-dim/70">
        — NO AGENT DEPLOYED —
      </span>
    </div>
  );
}

function ActiveAgents() {
  const agents = useJarvis((s) => s.agents);
  const skills = agents?.online ? agents.skills : [];
  const SLOTS = 4;
  return (
    <Panel
      area="agents"
      title="Active Agents"
      right={
        <span className="font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
          {skills.length}/{SLOTS} deployed
        </span>
      }
    >
      <div className="flex flex-col gap-2">
        {Array.from({ length: Math.max(SLOTS, skills.length) }, (_, i) =>
          skills[i] ? (
            <AgentCard key={skills[i].name} skill={skills[i]} />
          ) : (
            <EmptySlot key={i} />
          )
        )}
      </div>
    </Panel>
  );
}

/* ---------- mission timeline ---------- */

function MissionTimeline() {
  const health = useJarvis((s) => s.health);

  type Entry = { time: string; label: string; state: string };
  const entries: Entry[] = [];
  if (health) {
    entries.push({
      time: shortStamp(health.rebuild.lastRun),
      label: "nightly graph rebuild",
      state:
        health.rebuild.status === "ok"
          ? "done"
          : health.rebuild.status === "failed"
            ? "failed"
            : health.rebuild.status === "stale"
              ? "stale"
              : "unknown",
    });
    entries.push({
      time: shortStamp(health.nextJob.time),
      label: "next graph rebuild",
      state: "upcoming",
    });
    entries.push({
      time: "—",
      label: `hermes · ${health.hermes.jobs} jobs`,
      state: health.hermes.running ? "running" : "failed",
    });
    if (health.weeklyReview.lastLine)
      entries.push({ time: "—", label: "weekly review logged", state: "done" });
  }

  const pill = (state: string) => {
    if (state === "done" || state === "running")
      return { c: "text-ok border-ok/40", t: state === "done" ? "Done" : "Live" };
    if (state === "upcoming")
      return { c: "text-blue-bright border-blue-bright/40", t: "Upcoming" };
    if (state === "failed")
      return { c: "text-err border-err/40", t: "■ Failed" };
    if (state === "stale") return { c: "text-warn border-warn/40", t: "▲ Stale" };
    return { c: "text-text-dim border-border-dim/40", t: "—" };
  };

  return (
    <Panel area="timeline" title="Mission Timeline">
      {entries.length > 0 ? (
        <ul className="flex flex-col gap-1.5 leading-[var(--lh-tight)]">
          {entries.map((e, i) => {
            const p = pill(e.state);
            return (
              <li key={i} className="flex items-center gap-3">
                <span className="w-24 shrink-0 font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
                  {e.time}
                </span>
                <span className="min-w-0 flex-1 truncate font-jetbrains-mono text-[length:var(--fs-body)] text-ink-cc">
                  {e.label}
                </span>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 font-jetbrains-mono text-[length:var(--fs-meta)] ${p.c}`}
                >
                  {p.t}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyNote text="awaiting health sync" />
      )}
    </Panel>
  );
}

/* ---------- quick commands ---------- */

function QuickCommands() {
  const wakeMode = useJarvis((s) => s.wakeMode);
  const health = useJarvis((s) => s.health);
  const hermesPhase = useJarvis((s) => s.hermesStartPhase);
  const startHermes = useJarvis((s) => s.startHermes);
  const set = useJarvis((s) => s.set);

  const cmds: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    run: () => void;
    disabled?: boolean;
    tone?: "err";
  }[] = [
    {
      icon: IconBrain,
      label: "Ask the Brain",
      run: () => {
        set({ tab: "brain" });
        setTimeout(() => document.getElementById("query-input")?.focus(), 0);
      },
    },
    {
      icon: IconSync,
      label: "Sync Graph",
      run: () => useJarvis.getState().refreshGraph(),
    },
    {
      icon: IconCommand,
      label: "Command Palette",
      run: () => set({ paletteOpen: true }),
    },
    {
      icon: IconMic,
      label: wakeMode ? "Wake Word · on" : "Wake Word",
      run: () => set({ wakeMode: !wakeMode }),
    },
  ];

  // appears ONLY while hermes is offline — disappears the moment it's online
  if (health && !health.hermes.running) {
    cmds.push({
      icon: IconBolt,
      label:
        hermesPhase === "starting"
          ? "Starting Hermes…"
          : hermesPhase === "failed"
            ? "■ Retry Start — Failed"
            : "Start Hermes",
      run: () => void startHermes(),
      disabled: hermesPhase === "starting",
      tone: hermesPhase === "failed" ? "err" : undefined,
    });
  }

  return (
    <Panel area="commands" title="Quick Commands">
      <div className="flex flex-col gap-2">
        {cmds.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              onClick={() => {
                if (c.disabled) return;
                sfx.tick();
                c.run();
              }}
              disabled={c.disabled}
              aria-busy={c.disabled}
              className={`cc-panel is-interactive flex items-center gap-3 rounded-md px-3 py-2.5 text-left font-rajdhani text-[12px] font-medium tracking-[0.06em] transition-colors ${
                c.tone === "err"
                  ? "text-err hover:border-err"
                  : "text-ink-cc hover:text-gold"
              } ${c.disabled ? "cursor-wait opacity-60" : ""}`}
            >
              <Icon
                className={`text-base ${c.tone === "err" ? "text-err" : "text-blue-bright"}`}
              />
              {c.label}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

/* ---------- system monitor ---------- */

function SystemMonitor() {
  const vitals = useJarvis((s) => s.vitals);
  return (
    <Panel area="monitor" title="System Monitor">
      <div className="flex items-center justify-around">
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
      <dl className="mt-1 space-y-1 font-jetbrains-mono text-[length:var(--fs-body)]">
        <Row k="ram total" v={vitals ? gb(vitals.ramTotal) : "—"} />
        <Row k="os uptime" v={vitals ? fmtDur(vitals.osUptime) : "—"} />
      </dl>
    </Panel>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-dim">{k}</dt>
      <dd className="text-ink-cc">{v}</dd>
    </div>
  );
}

/* ---------- memory insights ---------- */

function MemoryInsights() {
  const graph = useJarvis((s) => s.graph);
  const set = useJarvis((s) => s.set);
  const clusters = graph
    ? new Set(graph.nodes.map((n) => n.community)).size
    : null;
  return (
    <Panel area="memory" title="Memory Insights">
      <div className="flex items-center gap-3">
        <MiniBrain />
        <dl className="flex-1 space-y-1 font-jetbrains-mono text-[length:var(--fs-body)]">
          <Row k="nodes" v={graph ? String(graph.nodes.length) : "—"} />
          <Row k="clusters" v={clusters != null ? String(clusters) : "—"} />
          <Row k="links" v={graph ? String(graph.links.length) : "—"} />
        </dl>
      </div>
      <button
        onClick={() => {
          sfx.tick();
          set({ tab: "brain", mode: "brain" });
        }}
        className="mt-2 w-full rounded-md border border-border-dim px-3 py-1.5 font-rajdhani text-[11px] font-medium uppercase tracking-[0.14em] text-text-dim transition-colors hover:text-gold"
      >
        View Memory Map →
      </button>
    </Panel>
  );
}

/* ---------- portfolio ---------- */

function PortfolioCards() {
  const hub = useJarvis((s) => s.hub);
  const dot = (status: string) =>
    /live/i.test(status) ? "is-ok" : /active|trading/i.test(status) ? "is-live" : "is-warn";
  return (
    <Panel area="portfolio" title="Portfolio">
      <ul className="flex flex-col gap-1.5 leading-[var(--lh-tight)]">
        {(hub?.portfolio ?? []).map((p) => (
          <li key={p.product} className="flex items-center gap-2.5">
            <span className={`status-dot ${dot(p.status)}`} aria-hidden />
            <span
              className="min-w-0 truncate font-rajdhani text-[length:var(--fs-body)] text-ink-cc"
              title={p.status}
            >
              {p.product.split("—")[0].trim()}
            </span>
            <span className="ml-auto shrink-0 font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
              {p.status.split("(")[0].trim().toLowerCase()}
            </span>
          </li>
        ))}
        {!hub && <EmptyNote text="loading portfolio…" />}
      </ul>
    </Panel>
  );
}

/* ---------- alerts ---------- */

function AlertsPanel() {
  const alerts = useJarvis((s) => s.alerts);
  const worst = alerts.some((a) => a.level === "err")
    ? "is-err"
    : alerts.length > 0
      ? "is-warn"
      : "";
  return (
    <Panel area="alerts" title="Alerts" className={worst}>
      {alerts.length > 0 ? (
        <ul className="flex flex-col gap-1.5 font-jetbrains-mono text-[length:var(--fs-body)] leading-[var(--lh-tight)]">
          {alerts.map((a) => (
            <li
              key={a.msg}
              className={`flex flex-wrap items-center gap-2 ${a.level === "warn" ? "text-warn" : "text-err"}`}
            >
              <span>
                {a.level === "warn" ? "▲" : "■"} {a.msg}
              </span>
              {a.kind === "hermes-down" && <HermesStartControl />}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-2 font-jetbrains-mono text-[length:var(--fs-body)] text-ok">
          <span className="status-dot is-ok" aria-hidden />
          all systems nominal
        </div>
      )}
    </Panel>
  );
}

/* ---------- run history (Part 4d) ---------- */

function clockOf(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function runDuration(a: string | null, b: string | null): string {
  if (!a || !b) return "—";
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`;
  return `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;
}

// Each status is visually distinct; "rejected" (a validation refusal) is neutral,
// deliberately NOT styled like the red error failure (Part 4d / V9).
function RunStatusPill({ status }: { status: RunEntry["status"] }) {
  const map = {
    ok: { c: "text-ok border-ok/40", t: "OK" },
    error: { c: "text-err border-err/50", t: "■ ERR" },
    timeout: { c: "text-warn border-warn/50", t: "▲ TIMEOUT" },
    rejected: { c: "text-text-dim border-border-dim/60", t: "REJECTED" },
  } as const;
  const m = map[status] ?? map.error;
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 font-jetbrains-mono text-[length:var(--fs-meta)] ${m.c}`}
    >
      {m.t}
    </span>
  );
}

function RunHistory() {
  const runs = useJarvis((s) => s.runs);
  const recent = runs?.recent ?? [];
  return (
    <Panel
      area="runhistory"
      title="Run History"
      live={!!runs}
      right={
        <span className="font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
          {recent.length}
        </span>
      }
    >
      {recent.length > 0 ? (
        <ul className="flex flex-col gap-1.5 leading-[var(--lh-tight)]">
          {recent.map((r) => (
            <li key={r.job_id} className="flex items-center gap-2.5">
              <span className="w-10 shrink-0 font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
                {clockOf(r.finished_at)}
              </span>
              <span className="min-w-0 flex-1 truncate font-jetbrains-mono text-[length:var(--fs-body)] text-ink-cc">
                {r.skill}
              </span>
              <span className="shrink-0 font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
                {runDuration(r.started_at, r.finished_at)}
              </span>
              {r.exit_code !== null && (
                <span className="shrink-0 font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim/70">
                  ×{r.exit_code}
                </span>
              )}
              <RunStatusPill status={r.status} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyNote text="— NO RUNS YET —" sub="results appear here after a skill runs" />
      )}
    </Panel>
  );
}

/* ---------- voice status (Part 4e — restyle only, no logic change) ---------- */

function VoiceStatus() {
  const wakeMode = useJarvis((s) => s.wakeMode);
  const voiceLang = useJarvis((s) => s.voiceLang);
  const set = useJarvis((s) => s.set);
  return (
    <Panel area="voice" title="Voice Status" live={wakeMode}>
      <div className="flex h-full flex-col items-center justify-center gap-2.5">
        {wakeMode ? (
          <span className="voice-wave h-6" aria-hidden>
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
        ) : (
          <StaticWave />
        )}
        <button
          onClick={() => {
            sfx.tick();
            set({ wakeMode: !wakeMode });
          }}
          aria-pressed={wakeMode}
          className={`flex items-center gap-2 rounded-full border px-4 py-1 transition-colors ${
            wakeMode
              ? "border-blue-bright bg-blue/15 text-blue-bright"
              : "border-border-dim text-text-dim hover:text-ink-cc"
          }`}
        >
          <IconMic className="text-sm" />
          <span className="font-rajdhani text-[length:var(--fs-meta)] font-semibold uppercase tracking-[0.15em]">
            {wakeMode ? "Listening…" : "Talk to Jarvis"}
          </span>
        </button>
        <span className="font-jetbrains-mono text-[length:var(--fs-meta)] tracking-[0.1em] text-text-dim">
          {voiceLang}
        </span>
      </div>
    </Panel>
  );
}

/* ---------- shared empty ---------- */

export function EmptyNote({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 py-4 text-center">
      <span className="font-jetbrains-mono text-[length:var(--fs-body)] tracking-[0.12em] text-text-dim">
        {text}
      </span>
      {sub && (
        <span className="font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim/70">
          {sub}
        </span>
      )}
    </div>
  );
}

/* ---------- deck ---------- */

export default function CommandCenter() {
  return (
    <div className="boot-stagger grid h-full min-h-0 gap-3" style={GRID_STYLE}>
      <AiCoreOverview />
      {/* dominant core: the 3D graph + query console, stacked */}
      <div className="flex min-h-0 flex-col gap-3" style={{ gridArea: "core" }}>
        <GraphModes />
        <QueryBox />
      </div>
      <IntelFeed />
      <VoiceStatus />
      <ActiveAgents />
      <MissionTimeline />
      <RunHistory />
      <QuickCommands />
      <SystemMonitor />
      <MemoryInsights />
      <PortfolioCards />
      <AlertsPanel />
    </div>
  );
}
