"use client";

// OPS tab: burn rate (fixed EUR + variable USD model costs), weekly
// checklist, roadmap lanes, full portfolio, session alert history.

import { useJarvis } from "@/lib/store";
import { PortfolioPanel, RoadmapLanes } from "@/components/v1-panels";
import { HermesStartControl } from "@/components/hermes-start-control";

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="cc-panel p-4">
      <h3 className="panel-label">{title}</h3>
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
        <p className="font-jetbrains-mono text-[length:var(--fs-body)] text-text-dim">
          {costsError ? `costs unavailable — ${costsError}` : "loading…"}
        </p>
      </Panel>
    );
  }

  const maxMonthly = Math.max(...costs.monthlyModelCosts.map((m) => m.cost), 0);

  return (
    <Panel title="BURN RATE">
      {costs.stale && (
        <p className="mb-2 font-jetbrains-mono text-[length:var(--fs-meta)] text-warn">
          ▲ STALE — showing last good data
        </p>
      )}
      {costs.needsSetup && (
        <p className="mb-3 rounded-md border border-dashed border-warn/60 px-3 py-1.5 font-jetbrains-mono text-[length:var(--fs-meta)] text-warn">
          ▲ fill in 00_System/costs.json — fixed costs still have TODO flags
        </p>
      )}
      <dl className="space-y-1 font-jetbrains-mono text-[length:var(--fs-body)] leading-[var(--lh-tight)]">
        {costs.fixed.map((c) => (
          <div key={c.name} className="flex justify-between gap-3">
            <dt className="text-text-dim">
              {c.name}
              {c.TODO && <span className="ml-1.5 text-warn">▲ TODO</span>}
            </dt>
            <dd className="text-ink-cc">€{c.eur.toFixed(0)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-border-dim pt-1.5">
          <dt className="text-text-dim">fixed / month</dt>
          <dd className="text-gold">€{costs.fixedTotalEur.toFixed(0)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-dim">model spend, all time</dt>
          <dd className="text-gold">${costs.totalModelCostUsd.toFixed(2)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-dim">cost / resolved prediction</dt>
          <dd className="text-ink-cc">
            {costs.costPerResolvedUsd === null
              ? "— (0 resolved)"
              : `$${costs.costPerResolvedUsd.toFixed(3)}`}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <div className="panel-label">MODEL COST BY MONTH (USD)</div>
        {costs.monthlyModelCosts.length > 0 ? (
          <ul className="mt-2 space-y-1 leading-[var(--lh-tight)]">
            {costs.monthlyModelCosts.map((mo) => (
              <li
                key={mo.month}
                className="flex items-center gap-2 font-jetbrains-mono text-[length:var(--fs-body)]"
              >
                <span className="w-14 shrink-0 text-text-dim">{mo.month}</span>
                <span
                  className="h-2 rounded-sm bg-blue-bright"
                  style={{
                    width: `${maxMonthly > 0 ? Math.max(2, (mo.cost / maxMonthly) * 100) : 2}%`,
                  }}
                />
                <span className="text-ink-cc">${mo.cost.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 font-jetbrains-mono text-[length:var(--fs-body)] text-text-dim">
            no model spend recorded yet.
          </p>
        )}
      </div>
    </Panel>
  );
}

function WeeklyChecklist() {
  const hub = useJarvis((s) => s.hub);
  const health = useJarvis((s) => s.health);
  const items = hub?.checklist ?? [];
  return (
    <Panel title="WEEKLY CHECKLIST">
      {health && (
        <div className="mb-3 flex items-center gap-2.5 rounded-md border border-border-dim/50 px-2.5 py-1.5">
          <span
            className={`status-dot ${health.hermes.running ? "is-ok" : "is-err"}`}
            aria-hidden
          />
          <span className="font-rajdhani text-[length:var(--fs-body)] font-medium tracking-[0.06em] text-ink-cc">
            Hermes daemon
          </span>
          {health.hermes.running ? (
            <span className="ml-auto font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
              {health.hermes.jobs} jobs
            </span>
          ) : (
            <span className="ml-auto">
              <HermesStartControl />
            </span>
          )}
        </div>
      )}
      {items.length > 0 ? (
        <ul className="space-y-1 font-jetbrains-mono text-[length:var(--fs-body)] leading-[var(--lh-tight)]">
          {items.map((c) => (
            <li key={c.text} className="flex items-start gap-2">
              <span className={c.checked ? "text-ok" : "text-text-dim"}>
                {c.checked ? "▣" : "▢"}
              </span>
              <span className={c.checked ? "text-text-dim line-through" : "text-ink-cc"}>
                {c.text}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-jetbrains-mono text-[length:var(--fs-body)] text-text-dim">
          no checklist in hub.
        </p>
      )}
    </Panel>
  );
}

function AlertHistory() {
  const history = useJarvis((s) => s.alertHistory);
  return (
    <Panel title="ALERT HISTORY — this session">
      {history.length > 0 ? (
        <ul className="space-y-1 font-jetbrains-mono text-[length:var(--fs-body)] leading-[var(--lh-tight)]">
          {history.map((a) => (
            <li key={a.t + a.msg} className="flex gap-3">
              <span className="shrink-0 text-text-dim">
                {new Date(a.t).toLocaleTimeString("en-GB")}
              </span>
              <span className="text-warn">▲ {a.msg}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-jetbrains-mono text-[length:var(--fs-body)] text-text-dim">
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
