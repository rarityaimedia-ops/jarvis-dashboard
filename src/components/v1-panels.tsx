"use client";

// v1 detail panels (full portfolio table + roadmap lanes), kept available
// in the archive drawer — data must not be lost to aesthetics.

import { useJarvis } from "@/lib/store";

function statusPill(status: string): string {
  if (/live/i.test(status)) return "border-emerald/40 text-emerald";
  if (/active|trading/i.test(status)) return "border-gold-border text-gold";
  return "border-hairline text-muted";
}

export function PortfolioPanel() {
  const hub = useJarvis((s) => s.hub);
  return (
    <section className="hud-panel">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
        <h2 className="font-mono text-xs tracking-widest text-muted">
          PORTFOLIO
        </h2>
        {hub?.cached && (
          <span className="font-mono text-xs text-muted">cached</span>
        )}
      </div>
      {!hub ? (
        <p className="px-5 py-6 font-mono text-sm text-muted">loading…</p>
      ) : (
        <div className="flex flex-col">
          <ul>
            {hub.portfolio.map((p) => (
              <li
                key={p.product}
                className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-3 last:border-b-0"
              >
                <span className="min-w-0 truncate text-sm" title={p.index}>
                  {p.product}
                </span>
                <span
                  className={`shrink-0 rounded-full border px-3 py-1 font-mono text-xs ${statusPill(p.status)}`}
                >
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
          {hub.checklist.length > 0 && (
            <div className="border-t border-hairline px-5 py-4">
              <h3 className="font-mono text-xs text-muted">Weekly review</h3>
              <ul className="mt-2 space-y-1.5">
                {hub.checklist.map((c) => (
                  <li key={c.text} className="flex items-start gap-2 text-xs">
                    <span className={c.checked ? "text-emerald" : "text-gold-dim"}>
                      {c.checked ? "◆" : "◇"}
                    </span>
                    <span
                      className={c.checked ? "text-muted line-through" : "text-ink"}
                    >
                      {c.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function shortName(project: string): string {
  return project.replace(/\s*\(.*\)\s*/g, "").trim();
}

export function RoadmapLanes() {
  const roadmap = useJarvis((s) => s.roadmap);
  const lanes: { key: "now" | "next" | "later"; title: string }[] = [
    { key: "now", title: "Now" },
    { key: "next", title: "Next" },
    { key: "later", title: "Later" },
  ];
  return (
    <section className="hud-panel">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
        <h2 className="font-mono text-xs tracking-widest text-muted">ROADMAP</h2>
        {roadmap?.cached && (
          <span className="font-mono text-xs text-muted">cached</span>
        )}
      </div>
      {!roadmap ? (
        <p className="px-5 py-6 font-mono text-sm text-muted">loading…</p>
      ) : (
        <div className="grid gap-px bg-hairline md:grid-cols-3">
          {lanes.map((lane) => (
            <div key={lane.key} className="bg-panel px-5 py-4">
              <h3
                className={`font-mono text-xs font-semibold tracking-widest uppercase ${
                  lane.key === "now" ? "text-gold" : "text-muted"
                }`}
              >
                {lane.title}
              </h3>
              <ul className="mt-3 space-y-3">
                {roadmap.projects.flatMap((p) =>
                  p[lane.key].map((item) => (
                    <li key={`${p.project}-${item}`} className="text-sm">
                      <span className="mr-2 border border-hairline px-1.5 py-0.5 font-mono text-[11px] text-gold/80">
                        {shortName(p.project)}
                      </span>
                      <span className="text-ink/90">{item}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
