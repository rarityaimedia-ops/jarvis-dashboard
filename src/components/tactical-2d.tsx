"use client";

// 2D tactical mode — the v1 custom graph, kept as an alternate view.
// Loaded lazily by graph-modes; this file is client-only via next/dynamic.

import { useCallback } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { NodeObject } from "react-force-graph-2d";
import { openInObsidian } from "@/lib/obsidian";
import type { GraphData, GraphNode } from "@/lib/store";

const PALETTE = ["#8A7326", "#D4AF37", "#E8CB6A", "#F0DC9A", "#B08D2A"];

export default function Tactical2D({
  data,
  width,
  height,
  onToast,
}: {
  data: GraphData;
  width: number;
  height: number;
  onToast: (msg: string) => void;
}) {
  const handleClick = useCallback(
    (node: NodeObject) => {
      openInObsidian((node as GraphNode).filePath, onToast);
    },
    [onToast]
  );
  return (
    <ForceGraph2D
      width={width}
      height={height}
      graphData={{
        nodes: data.nodes.map((n) => ({ ...n })),
        links: data.links.map((l) => ({ ...l })),
      }}
      backgroundColor="#070604"
      nodeLabel={(n) => (n as GraphNode).label}
      nodeVal={(n) => 1 + (n as GraphNode).degree}
      nodeColor={(n) =>
        PALETTE[Math.abs((n as GraphNode).community) % PALETTE.length]
      }
      linkColor={() => "#3A3428"}
      onNodeClick={handleClick}
    />
  );
}
