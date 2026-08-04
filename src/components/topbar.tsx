"use client";

// Top bar: system-status pill (driven by real alerts), live date + clock,
// and utilities — search opens the command palette, the bell shows the live
// alert count and jumps to the command deck.

import { useEffect, useState } from "react";
import { useJarvis } from "@/lib/store";
import { sfx } from "@/lib/audio";
import { IconSearch, IconBell } from "@/components/cc-icons";

export default function Topbar() {
  const alerts = useJarvis((s) => s.alerts);
  const set = useJarvis((s) => s.set);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only clock, avoids hydration mismatch
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hasErr = alerts.some((a) => a.level === "err");
  const status = hasErr
    ? { label: "DEGRADED", dot: "is-err" as const }
    : alerts.length > 0
      ? { label: "ATTENTION", dot: "is-warn" as const }
      : { label: "OPTIMAL", dot: "is-ok" as const };

  return (
    <header className="cc-glass flex items-center justify-between gap-4 rounded-lg px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="font-rajdhani text-[11px] font-semibold uppercase tracking-[0.2em] text-text-dim">
          System Status
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-border-dim px-2.5 py-1">
          <span className={`status-dot ${status.dot}`} aria-hidden />
          <span className="font-jetbrains-mono text-[length:var(--fs-meta)] tracking-[0.15em] text-ink-cc">
            {status.label}
          </span>
        </span>
      </div>

      <div className="flex flex-col items-center leading-none">
        <span suppressHydrationWarning className="font-rajdhani text-[11px] tracking-[0.2em] text-text-dim">
          {now
            ? now.toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : "—"}
        </span>
        <span
          suppressHydrationWarning
          className="mt-1 font-jetbrains-mono text-xl font-semibold tracking-[0.12em] text-blue-bright"
        >
          {now ? now.toLocaleTimeString("en-GB") : "--:--:--"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            sfx.tick();
            set({ paletteOpen: true });
          }}
          title="Search / command palette (Ctrl+K)"
          className="flex items-center gap-2 rounded-md border border-border-dim px-3 py-1.5 font-jetbrains-mono text-[11px] text-text-dim transition-colors hover:text-ink-cc"
        >
          <IconSearch className="text-sm" />
          <span className="hidden sm:inline">Search…</span>
          <span className="hidden rounded border border-border-dim px-1 text-[length:var(--fs-meta)] md:inline">
            ⌘K
          </span>
        </button>
        <button
          onClick={() => {
            sfx.tick();
            set({ tab: "brain" });
          }}
          title={`${alerts.length} active alert(s)`}
          aria-label={`${alerts.length} active alerts`}
          className="relative flex h-8 w-8 items-center justify-center rounded-md border border-border-dim text-text-dim transition-colors hover:text-ink-cc"
        >
          <IconBell className="text-sm" />
          {alerts.length > 0 && (
            <span
              className={`absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 font-jetbrains-mono text-[length:var(--fs-meta)] leading-none text-bg-base ${
                hasErr ? "bg-err" : "bg-warn"
              }`}
            >
              {alerts.length}
            </span>
          )}
        </button>
        <span className="ml-1 flex items-center gap-2 rounded-md border border-border-dim px-2.5 py-1.5">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-gold/50 font-jetbrains-mono text-[length:var(--fs-meta)] leading-none text-gold">
            I
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block font-rajdhani text-[length:var(--fs-meta)] font-semibold tracking-[0.12em] text-ink-cc">
              OPERATOR
            </span>
            <span className="block font-jetbrains-mono text-[length:var(--fs-meta)] tracking-[0.1em] text-text-dim">
              commander
            </span>
          </span>
        </span>
      </div>
    </header>
  );
}
