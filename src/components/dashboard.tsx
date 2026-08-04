"use client";

// Command-center shell: fixed sidebar + (topbar / content / bottom bar). The
// whole frame is 100vh, overflow hidden — panels scroll internally, the page
// body never does. The BRAIN deck stays mounted (hidden off-tab) so the WebGL
// core keeps its camera/physics; TRADING/OPS mount their own content and still
// render on the legacy warm tokens (their reskin is a later pass).

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useJarvis, type Tab } from "@/lib/store";
import DataPoller from "@/components/data-poller";
import AlertsWatcher from "@/components/alerts-watcher";
import Boot from "@/components/boot";
import Flow from "@/components/flow";
import Palette from "@/components/palette";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import HealthVerdict from "@/components/health-verdict";
import BottomBar from "@/components/bottom-bar";
import CommandCenter from "@/components/command-center";
import { TABS } from "@/components/hud";
import { sfx } from "@/lib/audio";

// heavy chart bundles load only when their tab first opens
const TradingPanel = dynamic(() => import("@/components/trading"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full flex-1 place-items-center font-jetbrains-mono text-xs text-text-dim">
      loading trading module…
    </div>
  ),
});
const OpsPanel = dynamic(() => import("@/components/ops"), { ssr: false });

export default function Dashboard() {
  const booted = useJarvis((s) => s.booted);
  const tab = useJarvis((s) => s.tab);

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
      <AlertsWatcher />
      <Boot />
      <Flow />
      <Palette />
      <div
        className={`flex h-screen w-full overflow-hidden text-ink-cc ${
          booted ? "" : "invisible"
        }`}
      >
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden p-3">
          <HealthVerdict />
          <Topbar />
          <div className="min-h-0 flex-1 overflow-hidden">
            {/* BRAIN deck stays mounted (hidden) to preserve the WebGL scene */}
            <div className={tab === "brain" ? "h-full" : "hidden"}>
              <CommandCenter />
            </div>
            {tab === "trading" && <TradingPanel />}
            {tab === "ops" && <OpsPanel />}
          </div>
          <BottomBar />
        </div>
      </div>
    </>
  );
}
