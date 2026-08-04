"use client";

// Ctrl+K command palette (cmdk). Rendered in a plain fixed overlay so we
// fully control HUD styling.

import { useEffect } from "react";
import { Command } from "cmdk";
import { useJarvis } from "@/lib/store";
import { brainBus } from "@/lib/brain-bus";
import { sfx } from "@/lib/audio";

const VAULT_PATHS = [
  "00_System/rarity-hub.md",
  "00_System/ROADMAP.md",
  "00_System/logs/graph-rebuild.log",
  "00_System/logs/hermes-daemon.log",
];

export default function Palette() {
  const open = useJarvis((s) => s.paletteOpen);
  const graph = useJarvis((s) => s.graph);
  const muted = useJarvis((s) => s.muted);
  const speakAnswers = useJarvis((s) => s.speakAnswers);
  const wakeMode = useJarvis((s) => s.wakeMode);
  const voiceLang = useJarvis((s) => s.voiceLang);
  const set = useJarvis((s) => s.set);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        sfx.tick();
        set({ paletteOpen: !useJarvis.getState().paletteOpen });
      } else if (e.key === "Escape" && useJarvis.getState().paletteOpen) {
        set({ paletteOpen: false });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [set]);

  if (!open) return null;

  const close = () => set({ paletteOpen: false });
  const run = (fn: () => void) => () => {
    sfx.tick();
    fn();
    close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-[18vh]"
      onClick={close}
    >
      <div
        className="cc-panel w-[min(92vw,560px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Jarvis command palette" className="font-jetbrains-mono text-sm">
          <Command.Input
            autoFocus
            placeholder="command or node name…"
            className="w-full border-b border-border-dim bg-bg-base px-4 py-3 text-ink-cc placeholder:text-text-dim focus:outline-none"
          />
          <Command.List className="max-h-[50vh] overflow-auto p-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[length:var(--fs-meta)] [&_[cmdk-group-heading]]:tracking-[0.2em] [&_[cmdk-group-heading]]:text-text-dim">
            <Command.Empty className="px-3 py-6 text-center text-xs text-text-dim">
              nothing matches.
            </Command.Empty>

            <Command.Group heading="QUERY">
              <Item
                onSelect={run(() => {
                  set({ tab: "brain", engine: "graphify" });
                  // input mounts with the tab switch
                  setTimeout(() => document.getElementById("query-input")?.focus(), 0);
                })}
              >
                Query brain — Graphify (fast)
              </Item>
              <Item
                onSelect={run(() => {
                  set({ tab: "brain", engine: "claude" });
                  setTimeout(() => document.getElementById("query-input")?.focus(), 0);
                })}
              >
                Query brain — Claude (deep)
              </Item>
            </Command.Group>

            <Command.Group heading="TABS">
              <Item onSelect={run(() => set({ tab: "brain" }))}>
                Tab: BRAIN (1)
              </Item>
              <Item onSelect={run(() => set({ tab: "trading" }))}>
                Tab: TRADING (2)
              </Item>
              <Item onSelect={run(() => set({ tab: "ops" }))}>
                Tab: OPS (3)
              </Item>
            </Command.Group>

            <Command.Group heading="GRAPH">
              <Item onSelect={run(() => set({ mode: "brain" }))}>
                Mode: 3D brain
              </Item>
              <Item onSelect={run(() => set({ mode: "tactical" }))}>
                Mode: 2D tactical
              </Item>
              <Item onSelect={run(() => set({ mode: "graphify" }))}>
                Mode: graphify
              </Item>
              <Item onSelect={run(() => useJarvis.getState().refreshGraph())}>
                Refresh graph data
              </Item>
            </Command.Group>

            <Command.Group heading="TOGGLES">
              <Item onSelect={run(() => set({ muted: !muted }))}>
                Sound: {muted ? "unmute" : "mute"}
              </Item>
              <Item onSelect={run(() => set({ speakAnswers: !speakAnswers }))}>
                Speak answers: {speakAnswers ? "off" : "on"}
              </Item>
              <Item onSelect={run(() => set({ wakeMode: !wakeMode }))}>
                Wake word: {wakeMode ? "off" : 'on — say "jarvis, …"'}
              </Item>
              <Item
                onSelect={run(() =>
                  set({ voiceLang: voiceLang === "sl-SI" ? "en-US" : "sl-SI" })
                )}
              >
                Voice language: switch to{" "}
                {voiceLang === "sl-SI" ? "en-US" : "sl-SI"}
              </Item>
            </Command.Group>

            <Command.Group heading="VAULT PATHS (copy)">
              {VAULT_PATHS.map((p) => (
                <Item
                  key={p}
                  onSelect={run(() => {
                    void navigator.clipboard.writeText(p).catch(() => {});
                  })}
                >
                  {p}
                </Item>
              ))}
            </Command.Group>

            <Command.Group heading="FOCUS NODE">
              {(graph?.nodes ?? []).map((n) => (
                <Item
                  key={n.id}
                  value={`node ${n.label}`}
                  onSelect={run(() => {
                    set({ tab: "brain", mode: "brain" });
                    brainBus.emit("flyTo", { nodeId: n.id });
                  })}
                >
                  ◆ {n.label}
                </Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function Item({
  children,
  onSelect,
  value,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  value?: string;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="cursor-pointer rounded px-3 py-2 text-xs text-ink-cc data-[selected=true]:bg-blue/10 data-[selected=true]:text-gold"
    >
      {children}
    </Command.Item>
  );
}
