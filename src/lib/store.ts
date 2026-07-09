import { create } from "zustand";
import { persist } from "zustand/middleware";
// type-only import: erased at compile time, no server code in the client bundle
import type { TradingSnapshot } from "@/lib/strategy-adapters";

export type Health = {
  rebuild: {
    status: "ok" | "stale" | "failed" | "unknown";
    lastRun: string | null;
    stale: boolean;
  };
  hermes: { running: boolean; jobs: number; stale: boolean };
  weeklyReview: { lastLine: string | null; stale: boolean };
  git: { uncommitted: number | null };
  nextJob: { name: string; time: string | null };
  ticker: string[];
  cached?: boolean;
};
export type Vitals = {
  cpu: number;
  ramUsed: number;
  ramTotal: number;
  osUptime: number;
  procUptime: number;
};
export type Hub = {
  portfolio: { product: string; status: string; index: string }[];
  checklist: { text: string; checked: boolean }[];
  cached?: boolean;
};
export type Roadmap = {
  projects: { project: string; now: string[]; next: string[]; later: string[] }[];
  cached?: boolean;
};
export type GraphNode = {
  id: string;
  label: string;
  community: number;
  degree: number;
  filePath: string;
};
export type GraphData = {
  nodes: GraphNode[];
  links: { source: string; target: string }[];
  cached?: boolean;
};

export type GraphMode = "brain" | "tactical" | "graphify";
export type Tab = "brain" | "trading" | "ops";

export type TradingPayload = TradingSnapshot & {
  stale: boolean;
  fetchedAt: number;
};
export type CostsPayload = {
  fixed: { name: string; eur: number; TODO?: boolean }[];
  fixedTotalEur: number;
  fixedCurrency: string;
  needsSetup: boolean;
  monthlyModelCosts: { month: string; cost: number }[];
  totalModelCostUsd: number;
  resolvedCount: number;
  costPerResolvedUsd: number | null;
  stale: boolean;
  fetchedAt: number;
};
export type AlertEvent = { t: string; msg: string };

type JarvisState = {
  health: Health | null;
  vitals: Vitals | null;
  hub: Hub | null;
  roadmap: Roadmap | null;
  graph: GraphData | null;
  tab: Tab;
  trading: TradingPayload | null;
  tradingError: string | null;
  costs: CostsPayload | null;
  costsError: string | null;
  alertHistory: AlertEvent[];
  mode: GraphMode;
  engine: "graphify" | "claude";
  muted: boolean;
  wakeMode: boolean;
  voiceLang: "sl-SI" | "en-US";
  speakAnswers: boolean;
  thinking: boolean;
  paletteOpen: boolean;
  booted: boolean;
  selectedNode: GraphNode | null;
  refreshGraph: () => void;
  set: (patch: Partial<JarvisState>) => void;
};

export const useJarvis = create<JarvisState>()(
  persist(
    (set) => ({
      health: null,
      vitals: null,
      hub: null,
      roadmap: null,
      graph: null,
      tab: "brain",
      trading: null,
      tradingError: null,
      costs: null,
      costsError: null,
      alertHistory: [],
      mode: "brain",
      engine: "graphify",
      muted: false,
      wakeMode: false,
      voiceLang: "en-US",
      speakAnswers: false,
      thinking: false,
      paletteOpen: false,
      booted: false,
      selectedNode: null,
      refreshGraph: () => {},
      set: (patch) => set(patch),
    }),
    {
      name: "jarvis-prefs",
      partialize: (s) => ({
        mode: s.mode,
        muted: s.muted,
        wakeMode: s.wakeMode,
        voiceLang: s.voiceLang,
        speakAnswers: s.speakAnswers,
      }),
      // rehydrated manually after mount to avoid SSR hydration mismatch
      skipHydration: true,
    }
  )
);
