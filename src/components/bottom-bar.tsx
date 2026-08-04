"use client";

// Single-line status strip (no marquee): real system facts on the left with
// ellipsis overflow, a central voice trigger, and a palette shortcut.

import { useJarvis } from "@/lib/store";
import { sfx } from "@/lib/audio";
import { fmtDur } from "@/components/hud";
import { IconMic, IconCommand } from "@/components/cc-icons";

export default function BottomBar() {
  const health = useJarvis((s) => s.health);
  const vitals = useJarvis((s) => s.vitals);
  const graph = useJarvis((s) => s.graph);
  const wakeMode = useJarvis((s) => s.wakeMode);
  const set = useJarvis((s) => s.set);

  const facts: string[] = [
    graph ? `VAULT · ${graph.nodes.length} nodes linked` : "VAULT · syncing",
    `HERMES · ${health ? (health.hermes.running ? "running" : "offline") : "—"}`,
    `GIT · ${health?.git.uncommitted ?? "—"} uncommitted`,
    health?.nextJob.time
      ? `NEXT · rebuild ${health.nextJob.time.replace(/:\d{2}$/, "")}`
      : "NEXT · rebuild —",
    vitals ? `SYS · up ${fmtDur(vitals.procUptime)}` : "SYS · —",
  ];

  return (
    <footer className="cc-glass flex items-center gap-4 rounded-lg px-4 py-2">
      <div className="min-w-0 flex-1 truncate font-jetbrains-mono text-[11px] tracking-[0.04em] text-text-dim">
        {facts.join("   ·   ")}
      </div>

      <button
        onClick={() => {
          sfx.tick();
          set({ wakeMode: !wakeMode });
        }}
        aria-pressed={wakeMode}
        className={`flex shrink-0 items-center gap-2.5 rounded-full border px-5 py-1.5 transition-colors ${
          wakeMode
            ? "border-blue-bright bg-blue/15 text-blue-bright"
            : "border-border-dim text-text-dim hover:text-ink-cc"
        }`}
      >
        {wakeMode ? (
          <span className="voice-wave h-3.5" aria-hidden>
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
        ) : (
          <IconMic className="text-sm" />
        )}
        <span className="font-rajdhani text-[11px] font-semibold uppercase tracking-[0.2em]">
          {wakeMode ? "listening…" : "Talk to Jarvis"}
        </span>
      </button>

      <button
        onClick={() => {
          sfx.tick();
          set({ paletteOpen: true });
        }}
        className="flex shrink-0 items-center gap-2 rounded-md border border-border-dim px-3 py-1.5 font-rajdhani text-[11px] font-medium uppercase tracking-[0.16em] text-text-dim transition-colors hover:text-gold"
      >
        <IconCommand className="text-sm" />
        <span className="hidden md:inline">Palette</span>
      </button>
    </footer>
  );
}
