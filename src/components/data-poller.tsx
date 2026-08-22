"use client";

// Renders nothing. Owns all SWR polling and syncs results into zustand so
// data consumers (HUD, rails, ticker) update without touching the WebGL
// brain's React tree.

import { useEffect } from "react";
import useSWR from "swr";
import {
  useJarvis,
  type Health,
  type Vitals,
  type Hub,
  type Roadmap,
  type GraphData,
  type TradingPayload,
  type CostsPayload,
  type AgentsPayload,
  type RunsPayload,
  type Verdict,
} from "@/lib/store";
import { setAudioMuted } from "@/lib/audio";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
};
const live = { refreshInterval: 5000, revalidateOnFocus: true };
// route cache TTL is 60s; polling faster only re-reads the server cache
const trading15 = { refreshInterval: 15000, revalidateOnFocus: false };

export default function DataPoller() {
  const set = useJarvis((s) => s.set);

  // rehydrate persisted prefs after mount (skipHydration avoids SSR mismatch)
  useEffect(() => {
    void useJarvis.persist.rehydrate();
    setAudioMuted(useJarvis.getState().muted);
    const unsub = useJarvis.subscribe((s) => setAudioMuted(s.muted));
    return unsub;
  }, []);

  const { data: health, mutate: mutateHealth } = useSWR<Health>(
    "/api/health",
    fetcher,
    live
  );
  const { data: vitals } = useSWR<Vitals>("/api/vitals", fetcher, live);
  const { data: hub } = useSWR<Hub>("/api/hub", fetcher, live);
  const { data: roadmap } = useSWR<Roadmap>("/api/roadmap", fetcher, live);
  const { data: graph, mutate } = useSWR<GraphData>("/api/graph", fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });
  const { data: trading, error: tradingErr } = useSWR<TradingPayload>(
    "/api/trading?strategy=polymarket",
    fetcher,
    trading15
  );
  const { data: costs, error: costsErr } = useSWR<CostsPayload>(
    "/api/costs",
    fetcher,
    trading15
  );
  const { data: agents } = useSWR<AgentsPayload>("/api/agents", fetcher, live);
  const { data: runs } = useSWR<RunsPayload>("/api/runs", fetcher, live);
  const { data: verdict } = useSWR<Verdict>("/api/verdict", fetcher, live);

  useEffect(() => {
    if (health) {
      set({ health });
      if (health.hermes.running) set({ hermesStartPhase: "idle" });
    }
  }, [health, set]);
  useEffect(() => {
    set({ refreshHealth: () => void mutateHealth() });
  }, [mutateHealth, set]);
  useEffect(() => {
    if (vitals) set({ vitals });
  }, [vitals, set]);
  useEffect(() => {
    if (hub) set({ hub });
  }, [hub, set]);
  useEffect(() => {
    if (roadmap) set({ roadmap });
  }, [roadmap, set]);
  useEffect(() => {
    if (graph) set({ graph });
  }, [graph, set]);
  useEffect(() => {
    set({ refreshGraph: () => void mutate() });
  }, [mutate, set]);
  useEffect(() => {
    // SWR keeps last data on error, so trading stays usable; the error
    // string only renders when there was never a successful payload
    if (trading) set({ trading, tradingError: null });
    else if (tradingErr) set({ tradingError: String(tradingErr.message ?? tradingErr) });
  }, [trading, tradingErr, set]);
  useEffect(() => {
    if (costs) set({ costs, costsError: null });
    else if (costsErr) set({ costsError: String(costsErr.message ?? costsErr) });
  }, [costs, costsErr, set]);
  useEffect(() => {
    if (agents) set({ agents });
  }, [agents, set]);
  useEffect(() => {
    if (runs) set({ runs });
  }, [runs, set]);
  useEffect(() => {
    if (verdict) set({ verdict });
  }, [verdict, set]);

  return null;
}
