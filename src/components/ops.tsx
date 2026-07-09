"use client";

// OPS tab: burn rate (fixed EUR + variable USD model costs), weekly
// checklist, roadmap lanes, full portfolio, session alert history.

import { useJarvis } from "@/lib/store";
import { PortfolioPanel, RoadmapLanes } from "@/components/v1-panels";

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hud-panel p-4">
      <h3 className="font-mono text-[10px] tracking-[0.25em] text-muted">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function BurnRate() {
  const costs = useJarvis((s) => s.costs);
  const costsError = useJarvis((s) => s.costsError);

  if (!costs) {
    return (
      <Panel title="BURN RATE">
        <p className="font-mono text-xs text-muted">
          {costsError ? `costs unavailable — ${costsError}` : "loading…"}
        </p>
      </Panel>
    );
  }

  const maxMonthly = Math.max(...costs.monthlyModelCosts.map((m) => m.cost), 0);

  return (
    <Panel title="BURN RATE">
      {costs.stale && (
        <p className="mb-2 font-mono text-[10px] text-warning">
          STALE — showing last good data
        </p>
      )}
      {costs.needsSetup && (
        <p className="mb-3 border border-warning/60 px-3 py-1.5 font-mono text-[11px] text-warning">
          fill in 00_System/costs.json — fixed costs still have TODO flags
        </p>
      )}
      <dl className="space-y-1.5 font-mono text-[11px]">
        {costs.fixed.map((c) => (
          <div key={c.name} className="flex justify-between gap-3">
            <dt className="text-muted">
              {c.name}
              {c.TODO && <span className="ml-1.5 text-warning">TODO</span>}
            </dt>
            <dd className="text-ink">€{c.eur.toFixed(0)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-hairline pt-1.5">
          <dt className="text-muted">fixed / month</dt>
          <dd className="text-gold">€{costs.fixedTotalEur.toFixed(0)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">model spend, all time</dt>
          <dd className="text-gold">${costs.totalModelCostUsd.toFixed(2)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">cost / resolved prediction</dt>
          <dd className="text-ink">
            {costs.costPerResolvedUsd === null
              ? "— (0 resolved)"
              : `$${costs.costPerResolvedUsd.toFixed(3)}`}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <div className="font-mono text-[10px] tracking-[0.25em] text-muted">
          MODEL COST BY MONTH (USD)
        </div>
        {costs.monthlyModelCosts.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {costs.monthlyModelCosts.map((mo) => (
              <li key={mo.month} className="flex items-center gap-2 font-mono text-[11px]">
                <span className="w-14 shrink-0 text-muted">{mo.month}</span>
                <span
                  className="h-2 bg-gold"
                  style={{
                    width: `${maxMonthly > 0 ? Math.max(2, (mo.cost / maxMonthly) * 100) : 2}%`,
                  }}
                />
                <span className="text-ink">${mo.cost.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 font-mono text-xs text-muted">
            no model spend recorded yet.
          </p>
        )}
      </div>
    </Panel>
  );
}

function WeeklyChecklist() {
  const hub = useJarvis((s) => s.hub);
  const items = hub?.checklist ?? [];
  return (
    <Panel title="WEEKLY CHECKLIST">
      {items.length > 0 ? (
        <ul className="space-y-1.5 font-mono text-[11px]">
          {items.map((c) => (
            <li key={c.text} className="flex items-start gap-2">
              <span className={c.checked ? "text-emerald" : "text-muted"}>
                {c.checked ? "▣" : "▢"}
              </span>
              <span className={c.checked ? "text-muted line-through" : "text-ink"}>
                {c.text}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-mono text-xs text-muted">no checklist in hub.</p>
      )}
    </Panel>
  );
}

function AlertHistory() {
  const history = useJarvis((s) => s.alertHistory);
  return (
    <Panel title="ALERT HISTORY — this session">
      {history.length > 0 ? (
        <ul className="space-y-1.5 font-mono text-[11px]">
          {history.map((a) => (
            <li key={a.t + a.msg} className="flex gap-3">
              <span className="shrink-0 text-muted">
                {new Date(a.t).toLocaleTimeString("en-GB")}
              </span>
              <span className="text-warning">{a.msg}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-mono text-xs text-muted">
          no alerts this session. silence is a feature.
        </p>
      )}
    </Panel>
  );
}

export default function OpsPanel() {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
      <div className="grid gap-3 lg:grid-cols-2">
        <BurnRate />
        <div className="flex flex-col gap-3">
          <WeeklyChecklist />
          <AlertHistory />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <RoadmapLanes />
        <PortfolioPanel />
      </div>
    </section>
  );
}
