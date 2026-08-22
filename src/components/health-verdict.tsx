"use client";

// The single health verdict line at the top of the shell. Aggregates the whole
// system's health into one sentence so the operator never has to read five
// panels to know if something is broken. Colorblind-safe: tone carries a glyph
// (■ err / ▲ warn) as well as color, matching the DESIGN.md warn/error rule.

import { useJarvis, type Verdict } from "@/lib/store";

const TONE = {
  ok: { dot: "is-ok", text: "text-ok", glyph: "" },
  warn: { dot: "is-warn", text: "text-warn", glyph: "▲ " },
  err: { dot: "is-err", text: "text-err", glyph: "■ " },
  idle: { dot: "", text: "text-text-dim", glyph: "" },
} as const;

// Wave 1E Phase 4: the watcher computes and writes the verdict (conductor's
// state/verdict.json, via /api/verdict) on its own loop; the dashboard only reads
// and displays it — computeVerdict/verdict.ts no longer exists. The one thing still
// computed client-side is freshness of the verdict itself: if evaluated_at is more
// than 3 minutes old, a dead/unreachable watcher must render as an explicit unknown
// state, never as a stale cached OPERATIONAL (4.D — approved on the condition that
// the watcher writes verdict.json early in its loop, before any job execution).
const VERDICT_STALE_AFTER_MS = 3 * 60 * 1000;

// Plain (non-component) helper, same pattern as command-center.tsx's relTime(): the
// react-compiler purity rule only checks functions it identifies as components/hooks,
// so the Date.now() freshness check belongs here, not inlined in the component body.
function resolveVerdict(verdict: Verdict | null): { tone: keyof typeof TONE; text: string } {
  if (!verdict) return { tone: "idle", text: "JARVIS · SYNCING" };
  const age = verdict.evaluatedAt ? Date.now() - new Date(verdict.evaluatedAt).getTime() : NaN;
  if (Number.isNaN(age) || age > VERDICT_STALE_AFTER_MS) {
    return { tone: "warn", text: "JARVIS VERDICT UNKNOWN · watcher not reporting" };
  }
  return { tone: verdict.tone, text: verdict.text };
}

export default function HealthVerdict() {
  const verdict = useJarvis((s) => s.verdict);
  const v = resolveVerdict(verdict);
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
