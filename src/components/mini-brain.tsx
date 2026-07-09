"use client";

// Ambient mini-render of the graph pinned in the left rail on every tab.
// Deliberately cheap: one small 2D canvas, dots + occasional pulse flicker,
// redrawn on a slow interval — no three.js, no bloom, no rAF loop.

import { useEffect, useRef } from "react";
import { useJarvis } from "@/lib/store";
import { sfx } from "@/lib/audio";

const GOLD = ["#D4AF37", "#B8963B", "#8A7326", "#E8C766"];

// deterministic position from node id — stable across polls/reloads
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export default function MiniBrain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graph = useJarvis((s) => s.graph);
  const tab = useJarvis((s) => s.tab);
  const set = useJarvis((s) => s.set);
  const nodeCount = graph?.nodes.length ?? 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    const nodes = useJarvis.getState().graph?.nodes;
    if (!canvas || !nodes?.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    const dots = nodes.map((n) => {
      const h = hash(n.id);
      return {
        x: 4 + (h % 1000) / 1000 * (W - 8),
        y: 4 + ((h >> 10) % 1000) / 1000 * (H - 8),
        r: Math.min(2, 0.8 + Math.cbrt(n.degree || 1) * 0.35),
        color: GOLD[Math.abs(n.community) % GOLD.length],
      };
    });

    let flare = -1;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      dots.forEach((d, i) => {
        ctx.globalAlpha = i === flare ? 1 : 0.55;
        ctx.fillStyle = i === flare ? "#F0DC9A" : d.color;
        ctx.beginPath();
        ctx.arc(d.x, d.y, i === flare ? d.r + 0.8 : d.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    };
    draw();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // pulse flicker: pick a dot every ~2.5s, clear it half a beat later
    const timer = setInterval(() => {
      flare = flare === -1 ? Math.floor(Math.random() * dots.length) : -1;
      draw();
    }, 1250);
    return () => clearInterval(timer);
  }, [nodeCount]);

  if (!nodeCount) return null;
  return (
    <button
      onClick={() => {
        sfx.tick();
        set({ tab: "brain" });
      }}
      title="Open BRAIN tab"
      aria-label={`Mini brain — ${nodeCount} nodes, open BRAIN tab`}
      className={`group mx-auto border transition-colors ${
        tab === "brain"
          ? "border-hairline"
          : "border-hairline hover:border-gold-border"
      }`}
    >
      <canvas ref={canvasRef} width={90} height={60} className="block" />
      <span className="block border-t border-hairline px-1 py-0.5 text-center font-mono text-[9px] tracking-[0.2em] text-muted transition-colors group-hover:text-gold">
        CORE
      </span>
    </button>
  );
}
