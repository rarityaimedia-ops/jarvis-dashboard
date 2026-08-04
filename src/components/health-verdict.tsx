"use client";

// The single health verdict line at the top of the shell. Aggregates the whole
// system's health into one sentence so the operator never has to read five
// panels to know if something is broken. Colorblind-safe: tone carries a glyph
// (■ err / ▲ warn) as well as color, matching the DESIGN.md warn/error rule.

import { useJarvis } from "@/lib/store";
import { computeVerdict } from "@/lib/verdict";

const TONE = {
  ok: { dot: "is-ok", text: "text-ok", glyph: "" },
  warn: { dot: "is-warn", text: "text-warn", glyph: "▲ " },
  err: { dot: "is-err", text: "text-err", glyph: "■ " },
  idle: { dot: "", text: "text-text-dim", glyph: "" },
} as const;

export default function HealthVerdict() {
  const health = useJarvis((s) => s.health);
  const agents = useJarvis((s) => s.agents);
  const runs = useJarvis((s) => s.runs);

  const v = computeVerdict(health, agents, runs);
  const t = TONE[v.tone];

  return (
    <div
      className="flex items-center gap-2.5 rounded-lg border border-border-dim px-4 py-1.5"
      role="status"
      aria-live="polite"
    >
      {t.dot && <span className={`status-dot ${t.dot}`} aria-hidden />}
      <span
        className={`font-jetbrains-mono text-[length:var(--fs-body)] font-semibold tracking-[0.16em] ${t.text}`}
      >
        {t.glyph}
        {v.text}
      </span>
    </div>
  );
}
