"use client";

// v1 detail panels (full portfolio table + roadmap lanes), kept available
// in the archive drawer — data must not be lost to aesthetics.

import { useJarvis } from "@/lib/store";

function statusPill(status: string): string {
  if (/live/i.test(status)) return "border-ok/40 text-ok";
  if (/active|trading/i.test(status)) return "border-blue-bright/40 text-blue-bright";
  return "border-border-dim text-text-dim";
}

export function PortfolioPanel() {
  const hub = useJarvis((s) => s.hub);
  return (
    <section className="cc-panel">
      <div className="flex items-center justify-between border-b border-border-dim px-5 py-3">
        <h2 className="panel-label">PORTFOLIO</h2>
        {hub?.cached && (
          <span className="font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
            cached
          </span>
        )}
      </div>
      {!hub ? (
        <p className="px-5 py-6 font-jetbrains-mono text-[length:var(--fs-body)] text-text-dim">
          loading…
        </p>
      ) : (
        <div className="flex flex-col">
          <ul>
            {hub.portfolio.map((p) => (
              <li
                key={p.product}
                className="flex items-center justify-between gap-4 border-b border-border-dim px-5 py-2.5 last:border-b-0"
              >
                <span
                  className="min-w-0 truncate font-rajdhani text-[length:var(--fs-body)] text-ink-cc"
                  title={p.index}
                >
                  {p.product}
                </span>
                <span
                  className={`shrink-0 rounded-full border px-3 py-1 font-jetbrains-mono text-[length:var(--fs-meta)] ${statusPill(p.status)}`}
                >
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
          {hub.checklist.length > 0 && (
            <div className="border-t border-border-dim px-5 py-4">
              <h3 className="panel-label">Weekly review</h3>
              <ul className="mt-2 space-y-1 leading-[var(--lh-tight)]">
                {hub.checklist.map((c) => (
                  <li
                    key={c.text}
                    className="flex items-start gap-2 font-jetbrains-mono text-[length:var(--fs-body)]"
                  >
                    <span className={c.checked ? "text-ok" : "text-text-dim"}>
                      {c.checked ? "◆" : "◇"}
                    </span>
                    <span
                      className={c.checked ? "text-text-dim line-through" : "text-ink-cc"}
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
    <section className="cc-panel">
      <div className="flex items-center justify-between border-b border-border-dim px-5 py-3">
        <h2 className="panel-label">ROADMAP</h2>
        {roadmap?.cached && (
          <span className="font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
            cached
          </span>
        )}
      </div>
      {!roadmap ? (
        <p className="px-5 py-6 font-jetbrains-mono text-[length:var(--fs-body)] text-text-dim">
          loading…
        </p>
      ) : (
        <div className="grid gap-px bg-border-dim/30 md:grid-cols-3">
          {lanes.map((lane) => (
            <div key={lane.key} className="bg-bg-panel px-5 py-4">
              <h3 className="panel-label">{lane.title}</h3>
              <ul className="mt-3 space-y-3">
                {roadmap.projects.flatMap((p) =>
                  p[lane.key].map((item) => (
                    <li
                      key={`${p.project}-${item}`}
                      className="font-rajdhani text-[length:var(--fs-body)] leading-[var(--lh-tight)]"
                    >
                      <span className="mr-2 rounded border border-blue-bright/40 bg-blue/10 px-1.5 py-0.5 font-jetbrains-mono text-[length:var(--fs-meta)] text-blue-bright">
                        {shortName(p.project)}
                      </span>
                      <span className="text-ink-cc/90">{item}</span>
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
