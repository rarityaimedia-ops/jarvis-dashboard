"use client";

// Shared command-center bits: tab registry, the ring Gauge (reused by the
// System Monitor), and byte/duration formatters. The old HUD header/rails/
// ticker were replaced by the sidebar + topbar + bottom-bar shell.

import type { Tab } from "@/lib/store";

export const TABS: { key: Tab; label: string }[] = [
  { key: "brain", label: "COMMAND" },
  { key: "trading", label: "TRADING" },
  { key: "ops", label: "OPS" },
  { key: "quant", label: "QUANT" },
];

/* ring gauge — blue arc (atmosphere/data) on a dim track, cool-white value */
export function Gauge({
  label,
  pct,
  display,
}: {
  label: string;
  pct: number; // 0..1
  display: string;
}) {
  const R = 30;
  const C = 2 * Math.PI * R;
  const ARC = 0.75 * C;
  const off = ARC * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 84 84" role="img" aria-label={`${label} ${display}`}>
        <g transform="rotate(135 42 42)">
          <circle
            cx="42"
            cy="42"
            r={R}
            fill="none"
            stroke="var(--border-dim)"
            strokeWidth="5"
            strokeDasharray={`${ARC} ${C}`}
          />
          <circle
            className="gauge-arc"
            cx="42"
            cy="42"
            r={R}
            fill="none"
            stroke="var(--blue-bright)"
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
          className="fill-ink-cc font-jetbrains-mono text-[12px]"
        >
          {display}
        </text>
      </svg>
      <span className="font-jetbrains-mono text-[length:var(--fs-meta)] tracking-[0.15em] text-text-dim">
        {label}
      </span>
    </div>
  );
}

export function gb(bytes: number): string {
  return `${(bytes / 2 ** 30).toFixed(1)}G`;
}
export function fmtDur(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}
