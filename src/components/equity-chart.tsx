"use client";

// lightweight-charts v5 equity curve — blue series on navy panel (chart
// geometry stays atmosphere-blue, never gold), crosshair on.

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
        background: { color: "#0d1526" },
        textColor: "#9fb2d4",
        fontFamily: "var(--font-jetbrains-mono), monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(90, 130, 220, 0.14)" },
        horzLines: { color: "rgba(90, 130, 220, 0.14)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(90, 130, 220, 0.5)", labelBackgroundColor: "#1e3a66" },
        horzLine: { color: "rgba(90, 130, 220, 0.5)", labelBackgroundColor: "#1e3a66" },
      },
      timeScale: { borderColor: "rgba(90, 130, 220, 0.38)", timeVisible: true },
      rightPriceScale: { borderColor: "rgba(90, 130, 220, 0.38)" },
    });
    const series = chart.addSeries(LineSeries, {
      color: "#6b8cff",
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
