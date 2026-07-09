"use client";

// lightweight-charts v5 equity curve — gold on panel black, crosshair on.

import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  CrosshairMode,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";

export default function EquityChart({
  data,
}: {
  data: { t: string; equity: number }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = createChart(el, {
      height: 220,
      autoSize: true,
      layout: {
        background: { color: "#141210" },
        textColor: "#8A8578",
        fontFamily: "var(--font-geist-mono), monospace",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#24211B" },
        horzLines: { color: "#24211B" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#4A3F1E", labelBackgroundColor: "#4A3F1E" },
        horzLine: { color: "#4A3F1E", labelBackgroundColor: "#4A3F1E" },
      },
      timeScale: { borderColor: "#24211B", timeVisible: true },
      rightPriceScale: { borderColor: "#24211B" },
    });
    const series = chart.addSeries(LineSeries, {
      color: "#D4AF37",
      lineWidth: 2,
      priceLineVisible: false,
    });
    // ascending unique timestamps (dedupe same-second resolutions, keep last)
    const byTime = new Map<number, number>();
    for (const p of data) {
      byTime.set(Math.floor(new Date(p.t).getTime() / 1000), p.equity);
    }
    series.setData(
      [...byTime.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([time, value]) => ({ time: time as UTCTimestamp, value }))
    );
    chart.timeScale().fitContent();
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [data]);

  return <div ref={ref} className="h-[220px] w-full" />;
}
