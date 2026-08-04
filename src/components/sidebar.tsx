"use client";

// Left rail: wordmark, primary nav (our three real tabs), and the re-housed
// voice panel. The panel toggles hands-free wake mode and mutes ambient sfx
// (Focus Mode); push-to-talk stays on Ctrl+Space (owned by <Flow/>).

import { useJarvis, type Tab } from "@/lib/store";
import { sfx } from "@/lib/audio";
import { TABS } from "@/components/hud";
import { IconBrain, IconTrading, IconOps, IconMic, IconBolt } from "@/components/cc-icons";

const TAB_ICON: Record<Tab, React.ComponentType<{ className?: string }>> = {
  brain: IconBrain,
  trading: IconTrading,
  ops: IconOps,
};

export default function Sidebar() {
  const tab = useJarvis((s) => s.tab);
  const wakeMode = useJarvis((s) => s.wakeMode);
  const muted = useJarvis((s) => s.muted);
  const set = useJarvis((s) => s.set);

  return (
    <aside className="cc-glass flex w-[232px] shrink-0 flex-col gap-4 p-4">
      {/* wordmark */}
      <div className="flex items-center gap-3 px-1 pt-1">
        <span className="grid h-9 w-9 place-items-center rounded-full border border-gold/60 text-gold">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-gold" />
        </span>
        <span className="leading-tight">
          <span className="block font-rajdhani text-lg font-bold tracking-[0.28em] text-gold">
            JARVIS
          </span>
          <span className="block font-rajdhani text-[length:var(--fs-meta)] font-medium tracking-[0.34em] text-text-dim">
            COMMAND CENTER
          </span>
        </span>
      </div>

      {/* nav */}
      <nav className="mt-1 flex flex-col gap-1" aria-label="Sections">
        {TABS.map((t, i) => {
          const Icon = TAB_ICON[t.key];
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => {
                sfx.tick();
                set({ tab: t.key });
              }}
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-3 rounded-md border px-3 py-2.5 text-left font-rajdhani text-[13px] font-medium tracking-[0.14em] transition-colors ${
                active
                  ? "border-gold/50 bg-blue/10 text-gold"
                  : "border-transparent text-text-dim hover:text-ink-cc"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-gold" />
              )}
              <Icon className="text-base" />
              <span className="uppercase">{t.label}</span>
              <span className="ml-auto font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim/70">
                {i + 1}
              </span>
            </button>
          );
        })}
      </nav>

      {/* voice panel */}
      <div className="mt-auto rounded-lg border border-border-dim p-4">
        <div className="flex items-center justify-between">
          <span className="font-rajdhani text-[length:var(--fs-meta)] font-semibold uppercase tracking-[0.2em] text-text-dim">
            Voice Status
          </span>
          <span
            className={`status-dot ${wakeMode ? "is-live" : "is-ok"}`}
            aria-hidden
          />
        </div>

        <div className="mt-4 flex h-7 items-center justify-center">
          {wakeMode ? (
            <div className="voice-wave h-full" aria-hidden>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          ) : (
            <span className="font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
              standby
            </span>
          )}
        </div>

        <button
          onClick={() => {
            sfx.tick();
            set({ wakeMode: !wakeMode });
          }}
          aria-pressed={wakeMode}
          className="mx-auto mt-3 flex h-16 w-16 items-center justify-center rounded-full border border-blue-bright/50 bg-blue/10 text-2xl text-blue-bright transition-colors hover:border-blue-bright"
        >
          <IconMic />
        </button>
        <p className="mt-2 text-center font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
          {wakeMode ? "listening — say “jarvis”" : "tap to enable wake word"}
        </p>
        <p className="mt-0.5 text-center font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim/70">
          hold Ctrl+Space to speak
        </p>

        <button
          onClick={() => {
            sfx.tick();
            set({ muted: !muted });
          }}
          aria-pressed={muted}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 font-rajdhani text-[11px] font-medium uppercase tracking-[0.18em] transition-colors ${
            muted
              ? "border-gold/50 text-gold"
              : "border-border-dim text-text-dim hover:text-ink-cc"
          }`}
        >
          <IconBolt className="text-sm" />
          Focus Mode{muted ? " · on" : ""}
        </button>
      </div>
    </aside>
  );
}
