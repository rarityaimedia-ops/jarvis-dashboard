"use client";

// Boot sequence + audio unlock — one system. The INITIATE click is the
// user gesture that resumes the AudioContext. framer-motion is used ONLY
// here (DESIGN.md rule); ambient effects elsewhere are pure CSS.

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { initAudio, sfx } from "@/lib/audio";
import { useJarvis } from "@/lib/store";

const KEY = "jarvis-booted";
const TYPE_MS = 14; // per character

export default function Boot() {
  const [phase, setPhase] = useState<"pending" | "init" | "seq" | "done">(
    "pending"
  );
  const set = useJarvis((s) => s.set);
  const [typed, setTyped] = useState("");
  const linesRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const finish = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("done");
    set({ booted: true });
  }, [set]);

  useEffect(() => {
    if (
      sessionStorage.getItem(KEY) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage/matchMedia are client-only; must resolve after hydration
      finish(); // reduced-motion: straight to dashboard, no audio
    } else {
      setPhase("init");
    }
  }, [finish]);

  // skip on any key/click during the sequence
  useEffect(() => {
    if (phase !== "seq") return;
    const skip = () => finish();
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [phase, finish]);

  function initiate() {
    const state = initAudio(); // THE user gesture
    console.log("[boot] AudioContext state:", state);
    sfx.boot();
    sessionStorage.setItem(KEY, "1");

    // REAL values from the store (DataPoller has been polling underneath)
    const { health, graph } = useJarvis.getState();
    const communities = graph
      ? new Set(graph.nodes.map((n) => n.community)).size
      : null;
    linesRef.current = [
      "> vault link ....... ESTABLISHED · claude-brain [read-only]",
      `> knowledge graph .. ${graph ? `${graph.nodes.length} nodes / ${communities} communities` : "awaiting sync"}`,
      `> hermes daemon .... ${health ? (health.hermes.running ? `RUNNING · ${health.hermes.jobs} jobs` : "OFFLINE") : "awaiting sync"}`,
      `> git ............. ${health?.git.uncommitted != null ? `${health.git.uncommitted} uncommitted` : "awaiting sync"}`,
      "> all systems nominal. good " + timeOfDay() + ", ivan.",
    ];
    setPhase("seq");

    const full = linesRef.current.join("\n");
    let i = 0;
    timerRef.current = setInterval(() => {
      i += 2;
      setTyped(full.slice(0, i));
      if (i >= full.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeout(finish, 600);
      }
    }, TYPE_MS);
  }

  return (
    <AnimatePresence>
      {phase !== "done" && (
        <motion.div
          key="boot"
          exit={{ opacity: 0, transition: { duration: 0.5, ease: "easeOut" } }}
          className="fixed inset-0 z-50 grid place-items-center bg-black font-mono"
        >
          {phase === "init" && (
            <div className="flex flex-col items-center gap-10">
              <div className="text-xl tracking-[0.5em] text-gold">
                RARITY&nbsp;//&nbsp;JARVIS
              </div>
              <button
                onClick={initiate}
                className="border border-gold-border px-10 py-3 text-sm tracking-[0.3em] text-gold transition-colors hover:bg-panel"
              >
                INITIATE
              </button>
            </div>
          )}
          {phase === "seq" && (
            <motion.pre
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-[min(90vw,560px)] whitespace-pre-wrap text-sm leading-7 text-gold"
            >
              {typed}
              <span className="animate-pulse">▌</span>
            </motion.pre>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function timeOfDay(): string {
  const h = new Date().getHours();
  return h < 6 ? "night" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}
