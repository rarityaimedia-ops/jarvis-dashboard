"use client";

// Inline "start hermes" action, shared by every spot that shows hermes
// offline (AI Core Overview row, ALERT panel entry, OPS status line) plus
// its own entry in Quick Commands. Phase lives in the store so all
// instances stay in sync — clicking one disables/updates the others.

import { useJarvis } from "@/lib/store";
import { sfx } from "@/lib/audio";

export function HermesStartControl({ className = "" }: { className?: string }) {
  const phase = useJarvis((s) => s.hermesStartPhase);
  const startHermes = useJarvis((s) => s.startHermes);

  if (phase === "starting") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-border-dim px-2.5 py-1 font-jetbrains-mono text-[length:var(--fs-meta)] uppercase tracking-[0.1em] text-text-dim ${className}`}
      >
        <span
          className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-blue-bright/30 border-t-blue-bright"
          aria-hidden
        />
        STARTING…
      </span>
    );
  }

  if (phase === "failed") {
    return (
      <button
        onClick={() => {
          sfx.tick();
          void startHermes();
        }}
        title="Click to retry"
        className={`inline-flex items-center gap-1.5 rounded-full border border-err/50 px-2.5 py-1 font-jetbrains-mono text-[length:var(--fs-meta)] text-err transition-colors hover:border-err ${className}`}
      >
        ■ START FAILED — check Task Scheduler
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        sfx.tick();
        void startHermes();
      }}
      className={`inline-flex items-center gap-1.5 rounded-full border border-blue-bright/40 bg-blue/10 px-2.5 py-1 font-jetbrains-mono text-[length:var(--fs-meta)] uppercase tracking-[0.1em] text-blue-bright transition-colors hover:border-blue-bright ${className}`}
    >
      START
    </button>
  );
}
