"use client";

// Headless. Derives system alerts from health and publishes them to the store
// (consumed by the command-center ALERT panel + bottom bar), blips once when an
// alert first appears, and records new alerts into session history (OPS reads
// alertHistory). Lives in the shell so it runs on every tab — previously this
// logic sat in the always-mounted RightRail.

import { useEffect, useRef } from "react";
import { useJarvis, type Health, type AlertItem } from "@/lib/store";
import { sfx } from "@/lib/audio";

// colorblind-safe: level drives ▲ (warn) / ■ (err) + dashed/solid border
function deriveAlerts(health: Health | null): AlertItem[] {
  if (!health) return [];
  const out: AlertItem[] = [];
  if (health.rebuild.status === "failed")
    out.push({ msg: "graph rebuild FAILED", level: "err" });
  if (health.rebuild.status === "stale")
    out.push({
      msg: `rebuild stale — last ${health.rebuild.lastRun ?? "?"}`,
      level: "warn",
    });
  if (!health.hermes.running)
    out.push({ msg: "hermes daemon DOWN", level: "err", kind: "hermes-down" });
  if ((health.git.uncommitted ?? 0) > 0)
    out.push({ msg: `${health.git.uncommitted} uncommitted — push`, level: "warn" });
  return out;
}

export default function AlertsWatcher() {
  const health = useJarvis((s) => s.health);
  const prevKey = useRef("");
  const hadAlerts = useRef(false);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const alerts = deriveAlerts(health);
    const key = alerts.map((a) => a.msg).join("|");
    if (key === prevKey.current) return; // unchanged — skip the store write
    prevKey.current = key;

    const { set, alertHistory } = useJarvis.getState();
    set({ alerts });

    // blip only on the transition into an alerting state (silence is a feature)
    if (alerts.length > 0 && !hadAlerts.current) sfx.alert();
    hadAlerts.current = alerts.length > 0;

    const fresh = alerts.filter((a) => !seen.current.has(a.msg));
    if (fresh.length > 0) {
      fresh.forEach((a) => seen.current.add(a.msg));
      set({
        alertHistory: [
          ...fresh.map((a) => ({ t: new Date().toISOString(), msg: a.msg })),
          ...alertHistory,
        ].slice(0, 50),
      });
    }
  }, [health]);

  return null;
}
