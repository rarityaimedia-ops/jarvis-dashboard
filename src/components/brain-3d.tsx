"use client";

// The Brain — 3D force graph centerpiece. This file is loaded via
// next/dynamic ssr:false, so three/WebGL imports are safe here.
//
// Performance contract: this component is memo'd on node/link COUNTS only.
// SWR/zustand churn must never re-render it — all runtime behavior
// (pulses, dim/focus, orbit) mutates three.js materials directly.

import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import ForceGraph3D from "react-force-graph-3d";
import type { ForceGraphMethods, NodeObject } from "react-force-graph-3d";
import * as THREE from "three";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader.js";
import gsap from "gsap";
import { brainBus } from "@/lib/brain-bus";
import { useJarvis, type GraphData, type GraphNode } from "@/lib/store";

// gold family only — rotated by community (DESIGN.md)
const EMISSIVE = [0xd4af37, 0xb8963b, 0x8a7326, 0xe8c766];

type BrainNode = NodeObject &
  GraphNode & {
    __material?: THREE.MeshStandardMaterial;
  };
type BrainLink = {
  source: string | BrainNode;
  target: string | BrainNode;
  __lineObj?: THREE.Line & { material: THREE.LineBasicMaterial };
};

const idOf = (e: string | BrainNode) => (typeof e === "string" ? e : e.id);

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function BrainInner({
  data,
  width,
  height,
}: {
  data: GraphData;
  width: number;
  height: number;
}) {
  const fgRef = useRef<ForceGraphMethods<BrainNode, BrainLink> | undefined>(
    undefined
  );
  // clone once — the graph lib mutates node objects (x/y/z, __refs)
  const graphData = useMemo(
    () => ({
      nodes: data.nodes.map((n) => ({ ...n })) as BrainNode[],
      links: data.links.map((l) => ({ ...l })) as BrainLink[],
    }),
    [data]
  );
  const adj = useMemo(() => {
    const neighbors = new Map<string, Set<string>>();
    const linksOf = new Map<string, BrainLink[]>();
    for (const l of graphData.links) {
      const s = idOf(l.source);
      const t = idOf(l.target);
      (neighbors.get(s) ?? neighbors.set(s, new Set()).get(s)!).add(t);
      (neighbors.get(t) ?? neighbors.set(t, new Set()).get(t)!).add(s);
      (linksOf.get(s) ?? linksOf.set(s, []).get(s)!).push(l);
      (linksOf.get(t) ?? linksOf.set(t, []).get(t)!).push(l);
    }
    const byId = new Map(graphData.nodes.map((n) => [n.id, n]));
    return { neighbors, linksOf, byId };
  }, [graphData]);

  const focusedRef = useRef<string | null>(null);
  const orbitPausedRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const restingIntensity = useCallback(
    (node: BrainNode) => {
      const f = focusedRef.current;
      // 0.7 rides just over the bloom threshold: soft resting glow
      if (!f) return 0.7;
      const bright = node.id === f || adj.neighbors.get(f)?.has(node.id);
      return bright ? 1.2 : 0.05;
    },
    [adj]
  );

  const pulse = useCallback(
    (node: BrainNode) => {
      const mat = node.__material;
      if (!mat || reducedMotion()) return;
      gsap.killTweensOf(mat);
      gsap
        .timeline()
        .to(mat, { emissiveIntensity: 3.5, duration: 0.4, ease: "power2.out" })
        .to(mat, {
          emissiveIntensity: restingIntensity(node),
          duration: 1,
          ease: "power2.inOut",
        });
      for (const l of adj.linksOf.get(node.id) ?? []) {
        const lm = l.__lineObj?.material;
        if (!lm) continue;
        gsap.killTweensOf(lm);
        gsap
          .timeline()
          .to(lm, { opacity: 0.7, duration: 0.3 })
          .to(lm, {
            opacity: focusedRef.current ? lm.opacity : 0.25,
            duration: 0.8,
          });
      }
    },
    [adj, restingIntensity]
  );

  const applyFocus = useCallback(
    (focusId: string | null) => {
      focusedRef.current = focusId;
      for (const n of graphData.nodes) {
        if (n.__material) {
          gsap.killTweensOf(n.__material);
          gsap.to(n.__material, {
            emissiveIntensity: restingIntensity(n),
            duration: 0.5,
          });
        }
      }
      for (const l of graphData.links) {
        const lm = l.__lineObj?.material;
        if (!lm) continue;
        const bright =
          focusId && (idOf(l.source) === focusId || idOf(l.target) === focusId);
        gsap.killTweensOf(lm);
        gsap.to(lm, {
          opacity: focusId ? (bright ? 0.55 : 0.04) : 0.25,
          duration: 0.5,
        });
      }
    },
    [graphData, restingIntensity]
  );

  const flyTo = useCallback((node: BrainNode) => {
    const fg = fgRef.current;
    if (!fg || node.x === undefined) return;
    const d = Math.hypot(node.x!, node.y!, node.z!) || 1;
    const ratio = 1 + 110 / d;
    fg.cameraPosition(
      { x: node.x! * ratio, y: node.y! * ratio, z: node.z! * ratio },
      { x: node.x!, y: node.y!, z: node.z! },
      reducedMotion() ? 0 : 1200
    );
  }, []);

  const handleNodeClick = useCallback(
    (node: BrainNode) => {
      orbitPausedRef.current = true;
      flyTo(node);
      applyFocus(node.id);
      useJarvis.getState().set({
        selectedNode: {
          id: node.id,
          label: node.label,
          community: node.community,
          degree: node.degree,
          filePath: node.filePath,
        },
      });
    },
    [flyTo, applyFocus]
  );

  const clearFocus = useCallback(() => {
    applyFocus(null);
    useJarvis.getState().set({ selectedNode: null });
    orbitPausedRef.current = false;
  }, [applyFocus]);

  // scene setup: bloom, fog. The composer's buffer already holds
  // display-encoded values here, so the chain must end with a raw
  // CopyShader — an encoding final pass (bloom-to-screen, GammaCorrection,
  // OutputPass) double-encodes and washes the whole scene out to olive.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const composer = fg.postProcessingComposer();
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(width || 800, height || 600),
      1.2,
      0.5,
      0.55
    );
    composer.addPass(bloom);
    const copy = new ShaderPass(CopyShader);
    composer.addPass(copy);
    // 0.0015: nearest nodes ~full brightness, farthest fade like deep
    // memory but stay faintly visible (0.008 fogged the whole scene black)
    fg.scene().fog = new THREE.FogExp2(0x000000, 0.0015);
    return () => {
      composer.removePass(bloom);
      composer.removePass(copy);
    };
    // mount-only: pass resolution updates aren't worth a composer rebuild
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fully pause the render loop while the BRAIN tab is inactive — the
  // scene stays mounted (camera/physics preserved) but the GPU idles
  const tab = useJarvis((s) => s.tab);
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    if (tab === "brain") {
      fg.resumeAnimation();
      console.log("[brain] render loop resumed");
    } else {
      fg.pauseAnimation();
      console.log("[brain] render loop paused (tab inactive)");
    }
  }, [tab]);

  // synaptic pulse: every 4-7s a random node flares
  useEffect(() => {
    if (reducedMotion()) return;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => {
        const nodes = graphData.nodes;
        // skip while the render loop is paused off-tab
        if (nodes.length && useJarvis.getState().tab === "brain")
          pulse(nodes[Math.floor(Math.random() * nodes.length)]);
        loop();
      }, 4000 + Math.random() * 3000);
    };
    loop();
    return () => clearTimeout(timer);
  }, [graphData, pulse]);

  // idle camera orbit — pauses on interaction, resumes after 20s
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || reducedMotion()) return;
    const controls = fg.controls() as unknown as {
      addEventListener: (e: string, h: () => void) => void;
      removeEventListener: (e: string, h: () => void) => void;
    };
    const onInteract = () => {
      orbitPausedRef.current = true;
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = setTimeout(() => {
        if (!focusedRef.current) orbitPausedRef.current = false;
      }, 20_000);
    };
    controls.addEventListener("start", onInteract);
    const spin = setInterval(() => {
      if (orbitPausedRef.current || !fgRef.current) return;
      const cam = fgRef.current.camera();
      const r = Math.hypot(cam.position.x, cam.position.z);
      if (r < 1) return;
      const a = Math.atan2(cam.position.x, cam.position.z) + 0.0009;
      fgRef.current.cameraPosition({
        x: r * Math.sin(a),
        y: cam.position.y,
        z: r * Math.cos(a),
      });
    }, 40);
    return () => {
      controls.removeEventListener("start", onInteract);
      clearInterval(spin);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  // external commands: thinking-mode pulses, palette fly-to, info-card close
  useEffect(() => {
    const offs = [
      brainBus.on("pulse", ({ nodeId }) => {
        const n = adj.byId.get(nodeId);
        if (n) pulse(n);
      }),
      brainBus.on("flyTo", ({ nodeId }) => {
        const n = adj.byId.get(nodeId);
        if (n) handleNodeClick(n);
      }),
      brainBus.on("clear", clearFocus),
    ];
    return () => offs.forEach((off) => off());
  }, [adj, pulse, handleNodeClick, clearFocus]);

  const nodeThreeObject = useCallback((node: BrainNode) => {
    const r = 2 + Math.cbrt(node.degree || 1) * 1.8;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x171204,
      emissive: EMISSIVE[Math.abs(node.community) % EMISSIVE.length],
      emissiveIntensity: 0.7,
      metalness: 0.9,
      roughness: 0.35,
    });
    node.__material = mat;
    return new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), mat);
  }, []);

  return (
    <ForceGraph3D<BrainNode, BrainLink>
      ref={fgRef}
      width={width}
      height={height}
      graphData={graphData}
      backgroundColor="#070604"
      showNavInfo={false}
      nodeThreeObject={nodeThreeObject}
      nodeLabel={(n) => `<span class="brain-tip">${n.label}</span>`}
      linkColor={() => "#d4af37"}
      linkOpacity={0.25}
      linkDirectionalParticles={reducedMotion() ? 0 : 2}
      linkDirectionalParticleSpeed={0.004}
      linkDirectionalParticleWidth={1.2}
      linkDirectionalParticleColor={() => "#d4af37"}
      onNodeClick={handleNodeClick}
      onBackgroundClick={clearFocus}
    />
  );
}

// SWR churn must never rebuild the WebGL scene — compare counts only.
export default memo(
  BrainInner,
  (prev, next) =>
    prev.data.nodes.length === next.data.nodes.length &&
    prev.data.links.length === next.data.links.length &&
    prev.width === next.width &&
    prev.height === next.height
);
