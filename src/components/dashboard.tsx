"use client";

// v3 HUD layout: BRAIN | TRADING | OPS tabs. All polling lives in
// DataPoller → zustand. The BRAIN tab stays mounted (hidden) when
// inactive so the WebGL scene keeps its camera/physics; brain-3d pauses
// its render loop off-tab.

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useJarvis, type Tab } from "@/lib/store";
import DataPoller from "@/components/data-poller";
import Boot from "@/components/boot";
import Flow from "@/components/flow";
import Palette from "@/components/palette";
import GraphModes from "@/components/graph-modes";
import QueryBox from "@/components/query-box";
import { HudHeader, LeftRail, RightRail, Ticker, TABS } from "@/components/hud";
import { sfx } from "@/lib/audio";

// heavy chart bundles load only when their tab first opens
const TradingPanel = dynamic(() => import("@/components/trading"), {
  ssr: false,
  loading: () => (
    <div className="grid flex-1 place-items-center font-mono text-xs text-muted">
      loading trading module…
    </div>
  ),
});
const OpsPanel = dynamic(() => import("@/components/ops"), { ssr: false });

export default function Dashboard() {
  const booted = useJarvis((s) => s.booted);
  const tab = useJarvis((s) => s.tab);
  const wakeMode = useJarvis((s) => s.wakeMode);

  // keys 1/2/3 switch tabs (ignored while typing or with modifiers)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
        return;
      const idx = ["1", "2", "3"].indexOf(e.key);
      if (idx === -1) return;
      const next: Tab = TABS[idx].key;
      if (useJarvis.getState().tab !== next) {
        sfx.tick();
        useJarvis.getState().set({ tab: next });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <DataPoller />
      <Boot />
      <Flow />
      <Palette />
      <main
        className={`mx-auto flex h-screen w-full max-w-[1720px] flex-col gap-3 px-4 py-3 ${
          booted ? "boot-stagger" : "invisible"
        }`}
      >
        <HudHeader />

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[230px_minmax(0,1fr)_270px]">
          <LeftRail />

          {/* BRAIN stays mounted to preserve the WebGL scene */}
          <div
            className={
              tab === "brain" ? "flex min-h-0 flex-col gap-3" : "hidden"
            }
          >
            <GraphModes />
            <QueryBox />
          </div>
          {tab === "trading" && <TradingPanel />}
          {tab === "ops" && <OpsPanel />}

          <RightRail />
        </div>

        <div className="flex items-center justify-end px-1">
          <span className="font-mono text-[10px] text-muted">
            {wakeMode && <span className="text-gold">◉ jarvis listening · </span>}
            1/2/3 — tabs · Ctrl+K — palette · hold Ctrl+Space — speak
          </span>
        </div>

        <Ticker />
      </main>
    </>
  );
}
