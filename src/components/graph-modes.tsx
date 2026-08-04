"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useJarvis, type GraphMode } from "@/lib/store";
import { openInObsidian } from "@/lib/obsidian";
import { brainBus } from "@/lib/brain-bus";
import { sfx } from "@/lib/audio";

// lazy-load per mode — only the active mode's bundle is fetched
const Brain3D = dynamic(() => import("@/components/brain-3d"), {
  ssr: false,
  loading: () => <Loading label="waking the brain…" />,
});
const Tactical2D = dynamic(() => import("@/components/tactical-2d"), {
  ssr: false,
  loading: () => <Loading label="loading tactical view…" />,
});

function Loading({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center font-jetbrains-mono text-xs text-text-dim">
      {label}
    </div>
  );
}

const MODES: { key: GraphMode; label: string }[] = [
  { key: "brain", label: "3D BRAIN" },
  { key: "tactical", label: "2D TACTICAL" },
  { key: "graphify", label: "GRAPHIFY" },
];

export default function GraphModes() {
  const mode = useJarvis((s) => s.mode);
  const graph = useJarvis((s) => s.graph);
  const selected = useJarvis((s) => s.selectedNode);
  const set = useJarvis((s) => s.set);
  const refreshGraph = useJarvis((s) => s.refreshGraph);
  const [toast, setToast] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setSize({ w: el.clientWidth, h: el.clientHeight })
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <section className="cc-panel flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border-dim px-4 py-2">
        <h2 className="panel-label flex items-center gap-2">
          KNOWLEDGE CORE
          <span className="status-dot is-live" aria-hidden />
          {graph?.cached && (
            <span className="text-warn normal-case tracking-normal">▲ cached</span>
          )}
        </h2>
        <div className="flex items-center gap-2 font-rajdhani text-[11px] font-medium uppercase tracking-[0.15em]">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => {
                sfx.tick();
                set({ mode: m.key });
              }}
              className={`border px-2.5 py-1 transition-colors ${
                mode === m.key
                  ? "border-gold bg-bg-base text-gold"
                  : "border-transparent text-text-dim hover:text-ink"
              }`}
            >
              {m.label}
            </button>
          ))}
          <button
            onClick={() => {
              sfx.tick();
              refreshGraph();
            }}
            className="border border-transparent px-2.5 py-1 text-text-dim transition-colors hover:text-gold"
            title="Re-fetch graph.json"
          >
            SYNC
          </button>
        </div>
      </div>

      {/* isolate: own stacking context so no backdrop-filter elsewhere on
          the page can ever composite over the WebGL canvas's coordinate space */}
      <div ref={wrapRef} className="relative isolate min-h-0 flex-1 overflow-hidden">
        {mode === "graphify" ? (
          <iframe
            src="/api/graph-html"
            title="graphify graph"
            className="h-full w-full border-0 bg-bg-base"
          />
        ) : !graph ? (
          <Loading label="loading graph…" />
        ) : size.w > 0 ? (
          mode === "brain" ? (
            <Brain3D data={graph} width={size.w} height={size.h} />
          ) : (
            <Tactical2D
              data={graph}
              width={size.w}
              height={size.h}
              onToast={showToast}
            />
          )
        ) : null}

        {selected && mode === "brain" && (
          <aside className="cc-panel absolute right-3 top-3 w-64 p-4 font-jetbrains-mono text-xs">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm leading-snug text-gold">
                {selected.label}
              </span>
              <button
                onClick={() => brainBus.emit("clear", undefined)}
                className="text-text-dim transition-colors hover:text-ink-cc"
                aria-label="Close node info"
              >
                ✕
              </button>
            </div>
            <dl className="mt-3 space-y-1 text-text-dim">
              <div className="flex justify-between">
                <dt>community</dt>
                <dd className="text-ink-cc">{selected.community}</dd>
              </div>
              <div className="flex justify-between">
                <dt>degree</dt>
                <dd className="text-ink-cc">{selected.degree}</dd>
              </div>
              <div className="truncate" title={selected.filePath}>
                {selected.filePath}
              </div>
            </dl>
            <button
              onClick={() => openInObsidian(selected.filePath, showToast)}
              className="mt-3 w-full border border-border-dim px-3 py-1.5 text-gold transition-colors hover:border-gold hover:bg-bg-base"
            >
              OPEN IN OBSIDIAN
            </button>
          </aside>
        )}

        {toast && (
          <div className="absolute bottom-4 left-1/2 max-w-[90%] -translate-x-1/2 truncate border border-border-dim bg-bg-panel px-4 py-2 font-jetbrains-mono text-xs text-ink-cc">
            {toast}
          </div>
        )}
      </div>
    </section>
  );
}
