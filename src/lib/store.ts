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

export type AgentMetric = {
  key: string;
  current: number;
  // null = NO_BASELINE (no prior window to compare); a number = a real delta,
  // including a genuine 0. The UI must render these differently ("—" vs "0").
  delta: number | null;
  baselineStatus: "VALID" | "NO_BASELINE";
};
export type AgentSkill = {
  name: string;
  lastRun: string | null;
  freshness: "ok" | "warn" | "err";
  metrics: AgentMetric[];
  anomalies: string[];
  digestDate: string | null;
};
export type AgentsPayload = {
  online: boolean;
  generatedAt: string | null;
  skills: AgentSkill[];
};

// Command-bus run records, surfaced by /api/runs (reads queue/running + queue/done).
export type RunStatus = "ok" | "error" | "timeout" | "rejected";
export type RunEntry = {
  job_id: string;
  skill: string;
  status: RunStatus;
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
  output_path: string | null;
};
export type RunsPayload = {
  running: { job_id: string; ageMs: number }[];
  recent: RunEntry[];
};
export type AlertItem = { msg: string; level: "warn" | "err"; kind?: "hermes-down" };
export type HermesStartPhase = "idle" | "starting" | "failed";

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
  agents: AgentsPayload | null;
  runs: RunsPayload | null;
  alerts: AlertItem[];
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
  refreshHealth: () => void;
  hermesStartPhase: HermesStartPhase;
  startHermes: () => Promise<void>;
  set: (patch: Partial<JarvisState>) => void;
};

// module-level, not store state: a client-side nicety only (avoids firing a
// redundant request while one is in flight) — the *real* single-execution
// guarantee is the 10s debounce enforced server-side in the route itself.
let hermesStartInFlight = false;

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
      agents: null,
      runs: null,
      alerts: [],
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
      refreshHealth: () => {},
      hermesStartPhase: "idle",
      startHermes: async () => {
        if (hermesStartInFlight) return;
        hermesStartInFlight = true;
        set({ hermesStartPhase: "starting" });
        try {
          const res = await fetch("/api/ops/hermes/start", { method: "POST" });
          if (res.status === 429) return; // already in flight elsewhere — leave "starting", the poll resolves truth
          const data = (await res.json()) as { triggered: boolean; online: boolean };
          set({ hermesStartPhase: data.online ? "idle" : "failed" });
          useJarvis.getState().refreshHealth(); // don't wait for the next 5s poll interval

        } catch {
          set({ hermesStartPhase: "failed" });
        } finally {
          hermesStartInFlight = false;
        }
      },
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
