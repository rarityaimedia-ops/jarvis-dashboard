"use client";

// QUANT — the research system's state, and specifically its REJECTIONS.
//
// THE GOVERNING DESIGN CONSTRAINT, because it explains choices that otherwise look wrong:
// the output of the quant pipeline is rejections, not trade recommendations, and a UI that
// renders kills as alarms teaches the operator to avoid producing them. So a kill is drawn
// as the ORDINARY, EXPECTED state in plain text, the kill rate is the number that gets the
// gold, and --err is reserved for actual malfunction. Nothing here celebrates a survivor.
//
// The second constraint is that ABSENCE MUST BE VISIBLE. A candidate nothing judged is not
// a candidate that passed, a gate that was abandoned is not a gate that is protecting you,
// and "no detective control for look-ahead" is a fact the tab states rather than omits.

import dynamic from "next/dynamic";
import useSWR from "swr";
import { Panel, EmptyNote } from "@/components/command-center";
import type { QuantPayload, QuantCandidate, QuantGate } from "@/app/api/quant/route";

// Charts are BELOW the kill log and are loaded that way too: recharts is a large bundle,
// and the kill log is the primary screen. It renders without waiting for the charts.
const QuantCharts = dynamic(() => import("@/components/quant-charts"), { ssr: false });

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
};

const GRID_STYLE: React.CSSProperties = {
  gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
  gridTemplateRows: "minmax(0, 1.35fr) minmax(0, 1fr)",
  gridTemplateAreas: ['"killlog holdout"', '"killlog gates"'].join(" "),
};

function stamp(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

/* ---------- status treatment ----------
 *
 * Three readings, and keeping them apart is the whole point:
 *
 *   killed       a VERDICT was rendered. Ordinary text. This is the system working.
 *   no verdict   quarantined or unjudgeable. Nothing judged it. --warn, because an
 *                unanswered question needs attention -- but NOT --err, because nothing
 *                malfunctioned, and never a neutral grey that would let it pass for a kill.
 *   passed       got through the gauntlet. Deliberately understated: --blue-bright, no
 *                gold, no glow. Celebrating survivors is how an operator learns to
 *                manufacture them.
 */
function verdictOf(c: QuantCandidate): {
  label: string;
  cls: string;
  judged: boolean;
} {
  if (c.status === "killed") {
    return {
      label: c.killGate != null ? `KILLED · GATE ${c.killGate}` : "KILLED",
      cls: "border-border-dim text-text-dim",
      judged: true,
    };
  }
  if (c.status === "unjudgeable") {
    return {
      label:
        c.refusedAtGate != null
          ? `NO VERDICT · GATE ${c.refusedAtGate} REFUSED TO JUDGE`
          : "NO VERDICT · UNJUDGEABLE",
      cls: "border-warn/50 text-warn",
      judged: false,
    };
  }
  if (c.status === "quarantined") {
    return { label: "NO VERDICT · QUARANTINED", cls: "border-warn/50 text-warn", judged: false };
  }
  return {
    label: "PASSED THE GAUNTLET",
    cls: "border-blue-bright/40 text-blue-bright",
    judged: true,
  };
}

function KillLog({ q }: { q: QuantPayload }) {
  const t = q.totals;
  const noVerdict = t ? t.quarantined + t.unjudgeable : 0;

  return (
    <Panel
      area="killlog"
      title="Kill Log"
      right={
        t ? (
          <span className="font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
            {t.candidates} tested
          </span>
        ) : undefined
      }
    >
      {q.candidates.length === 0 ? (
        <EmptyNote
          text={
            q.degraded
              ? "journal not readable — no candidates read"
              : q.online
                ? "no candidates journalled yet"
                : "quant artifact offline"
          }
          sub={
            q.degraded?.detail ??
            (q.online ? "the gauntlet has not recorded a candidate" : "quant-stats has not run")
          }
        />
      ) : (
        <>
          {/* The headline. The promotable count is the number that gets the gold, because
              it is the one the system is actually trying to keep at zero. */}
          {t && (
            <div className="mb-3 border-b border-border-dim/60 pb-2.5">
              <div className="flex items-baseline gap-2">
                <span className="font-jetbrains-mono text-xl font-semibold leading-none tracking-[0.12em] text-gold-bright">
                  {t.promotable}
                </span>
                <span className="font-rajdhani text-[length:var(--fs-body)] font-semibold uppercase tracking-[0.15em] text-gold">
                  of {t.candidates} promotable
                </span>
              </div>
              <p className="mt-1.5 max-w-[78ch] font-jetbrains-mono text-[length:var(--fs-meta)] leading-[var(--lh-tight)] text-text-dim">
                {t.killed} killed · {noVerdict} no verdict · {t.promotable} survived. The
                output of this pipeline is REJECTIONS. A kill is the system working as
                designed, not a failure — and “no verdict” is not a pass.
              </p>
            </div>
          )}

          <ul className="flex flex-col gap-3">
            {q.candidates.map((c) => {
              const v = verdictOf(c);
              // The prose IS the content. kill_reason for a verdict, refusal_reason for a
              // refusal. A QUARANTINED row has neither by schema — its evidence is the
              // deleted detector's metrics — so it gets its own sentence rather than the
              // "unauditable" fallback, which would be a false accusation. Only a row that
              // genuinely carries nothing gets that.
              const ev = c.noVerdictEvidence;
              const prose =
                c.killReason ??
                c.refusalReason ??
                (ev
                  ? `Quarantined by the look-ahead detector${
                      ev.testsFired.length ? ` (test ${ev.testsFired.join(", ")})` : ""
                    }${
                      ev.peakDominance != null && ev.peakCurvature != null
                        ? `: peak dominance ${ev.peakDominance.toFixed(4)}, curvature ${ev.peakCurvature.toFixed(4)}`
                        : ""
                    }. THAT DETECTOR NO LONGER EXISTS — it was deleted on measurement (2.5% true-positive rate, anti-informative AUC), and no gate replaced it. Nothing in the current gauntlet would stop this candidate.`
                  : "no reason recorded — this row is unauditable");
              // A background tint, not a left stripe: a tinted block is the pattern this
              // app already uses to mark a row (bg-blue/10 in the sidebar, palette and
              // bottom bar), and it reads as "this row is different" without the
              // decorative accent-bar look. Killed rows get no tint — they are the normal
              // case, and normal should be quiet.
              return (
                <li
                  key={c.id}
                  className={`rounded-sm px-2.5 py-1.5 ${v.judged ? "" : "bg-warn/10"}`}
                >
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="font-jetbrains-mono text-[length:var(--fs-body)] text-ink-cc">
                      {c.id}
                    </span>
                    <span className="font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
                      {c.familyTag}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 font-jetbrains-mono text-[length:var(--fs-meta)] ${v.cls}`}
                    >
                      {v.label}
                    </span>
                  </div>
                  {/* Capped at 78ch. These reasons are prose, not table cells — at full
                      panel width they run past 110 characters and stop being readable. */}
                  <p
                    className={`mt-1 max-w-[78ch] font-jetbrains-mono text-[length:var(--fs-body)] leading-[var(--lh-tight)] ${
                      v.judged ? "text-text-dim" : "text-warn"
                    }`}
                  >
                    {prose}
                  </p>
                  {!v.judged && (
                    <p className="mt-1 max-w-[78ch] font-jetbrains-mono text-[length:var(--fs-meta)] leading-[var(--lh-tight)] text-warn/80">
                      NOTHING JUDGED THIS CANDIDATE. It carries no gate verdict, and its
                      absence of one must not be read as having passed.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Panel>
  );
}

function Holdout({ q }: { q: QuantPayload }) {
  const h = q.holdout;
  return (
    <Panel area="holdout" title="Holdout Budget">
      {!h ? (
        <EmptyNote
          text={q.degraded ? "budget not readable" : "no holdout budget read"}
          sub={q.degraded?.detail ?? "quant-stats has not run"}
        />
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-jetbrains-mono text-xl font-semibold leading-none tracking-[0.12em] text-gold-bright">
              {h.remaining}
            </span>
            <span className="font-rajdhani text-[length:var(--fs-body)] font-semibold uppercase tracking-[0.15em] text-gold">
              of {h.budget} remaining
            </span>
          </div>

          <p className="mt-2 font-jetbrains-mono text-[length:var(--fs-meta)] leading-[var(--lh-tight)] text-text-dim">
            This is the total number of candidates that may EVER be tested out-of-sample,
            across the entire life of the system — not a per-phase or per-snapshot
            allowance. The out-of-sample window cannot be regenerated once spent. The
            per-candidate PSR bar is{" "}
            <span className="text-ink-cc">{h.psrThreshold}</span>.
          </p>

          <div className="mt-3 border-t border-border-dim/60 pt-2">
            <div className="font-rajdhani text-[length:var(--fs-meta)] font-semibold uppercase tracking-[0.15em] text-text-dim">
              Spent by
            </div>
            {h.spentBy.length === 0 ? (
              <p className="mt-1.5 font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
                nothing spent yet
              </p>
            ) : (
              <ul className="mt-1.5 flex flex-col gap-1">
                {h.spentBy.map((s) => (
                  <li key={s.candidateId} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate font-jetbrains-mono text-[length:var(--fs-body)] text-ink-cc">
                      {s.candidateId}
                    </span>
                    <span className="shrink-0 font-jetbrains-mono text-[length:var(--fs-meta)] text-text-dim">
                      {s.passed === null ? "no result" : s.passed ? "passed" : "did not pass"}
                      {" · "}
                      {stamp(s.evaluatedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

const GATE_STATE_CLS: Record<QuantGate["state"], string> = {
  live: "text-ok",
  // Abandoned and absent are BOTH "this is not protecting you". They are drawn the same
  // way on purpose: the difference between "we built it and retired it" and "we never
  // built it" matters for the record, not for how much cover it provides today.
  abandoned: "text-warn",
  absent: "text-warn",
};
const GATE_STATE_LABEL: Record<QuantGate["state"], string> = {
  live: "LIVE",
  abandoned: "ABANDONED",
  absent: "NOT BUILT",
};

function GateCoverage({ q }: { q: QuantPayload }) {
  const la = q.lookahead;
  return (
    <Panel area="gates" title="Gate Coverage">
      {q.gates.length === 0 ? (
        <EmptyNote text="no gate coverage read" sub="quant-stats has not run" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full font-jetbrains-mono text-[length:var(--fs-body)]">
              <thead>
                <tr className="border-b border-border-dim text-left text-text-dim">
                  <th className="py-1.5 pr-3 font-normal">#</th>
                  <th className="py-1.5 pr-3 font-normal">gate</th>
                  <th className="py-1.5 font-normal">state</th>
                </tr>
              </thead>
              <tbody>
                {q.gates.map((g) => (
                  <tr key={g.gate} className="border-b border-border-dim/50 align-top">
                    <td className="py-1.5 pr-3 text-text-dim">{g.gate}</td>
                    <td className="py-1.5 pr-3 text-ink-cc">
                      {g.name}
                      {/* Clamped, with the full text on hover. Gate 6's reason is a
                          multi-paragraph measurement record — rendering it in full pushes
                          gate 7, gate 8 and the look-ahead row off the panel, which buries
                          the two facts a reader most needs. The reason is not hidden: the
                          title attribute carries it, and the artifact always holds it whole. */}
                      {g.state !== "live" && g.note && (
                        <p
                          title={g.note}
                          className="mt-1 line-clamp-3 max-w-[42ch] font-jetbrains-mono text-[length:var(--fs-meta)] leading-[var(--lh-tight)] text-text-dim"
                        >
                          {g.note}
                        </p>
                      )}
                    </td>
                    <td className={`py-1.5 whitespace-nowrap ${GATE_STATE_CLS[g.state]}`}>
                      {GATE_STATE_LABEL[g.state]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* The look-ahead row. It is NOT a gate, and putting it in the gate table would
              imply one of the gates covers it. None of them do. */}
          <div className="mt-3 border-t border-border-dim pt-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-rajdhani text-[length:var(--fs-meta)] font-semibold uppercase tracking-[0.15em] text-text-dim">
                Look-ahead defence
              </span>
              <span className="font-jetbrains-mono text-[length:var(--fs-meta)] text-warn">
                DETECTIVE: {la.detective.length === 0 ? "NONE" : la.detective.length}
              </span>
            </div>

            {la.detective.length === 0 && (
              <p className="mt-1.5 font-jetbrains-mono text-[length:var(--fs-meta)] leading-[var(--lh-tight)] text-warn">
                There is NO detective control for look-ahead. Nothing in the gauntlet
                detects it. Gate 7 does not catch it either — a code-level leak inflates
                in-sample and out-of-sample identically, because the bug travels with the
                code rather than being fitted to a period.
              </p>
            )}

            <div className="mt-2 font-rajdhani text-[length:var(--fs-meta)] font-semibold uppercase tracking-[0.15em] text-text-dim">
              Preventative · {la.preventative.length}
            </div>
            {la.preventative.length === 0 ? (
              <p className="mt-1 font-jetbrains-mono text-[length:var(--fs-meta)] text-warn">
                none — nothing prevents look-ahead either
              </p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1.5">
                {la.preventative.map((d) => (
                  <li key={d.name}>
                    <span className="font-jetbrains-mono text-[length:var(--fs-body)] text-ok">
                      {d.name}
                    </span>
                    <p className="mt-0.5 font-jetbrains-mono text-[length:var(--fs-meta)] leading-[var(--lh-tight)] text-text-dim">
                      {d.note}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

export default function QuantPanel() {
  // Fetched here rather than in the global DataPoller: this tab is dynamically imported
  // and only mounts when it is open, so its data should not be polled for every session
  // that never opens it.
  const { data, error } = useSWR<QuantPayload>("/api/quant", fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
  });

  if (!data) {
    return (
      <section className="cc-panel flex min-h-0 flex-1 flex-col items-center justify-center p-6 font-jetbrains-mono text-[length:var(--fs-body)]">
        <p className="text-text-dim">
          {error ? "quant artifact unavailable" : "reading quant artifact…"}
        </p>
      </section>
    );
  }

  // Freshness comes from the route, which owns the clock. Reading it during render would
  // be impure and produce a value that changes on an unrelated re-render.
  const stale = data.freshness === "warn";

  return (
    // Scrolls as one column now that the charts sit below the fold. The kill log keeps
    // flex-1 so it still fills the viewport on open — the charts are something you scroll
    // DOWN to, which is the whole point of §9: the kill rate is the primary screen and the
    // performance pictures are secondary to it, structurally and not just by styling.
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      {/* One status line, and it distinguishes the two ways this tab can be empty:
          the dashboard could not read the artifact (offline), or quant-stats read the
          artifact fine and reported that IT could not read the journal (degraded). */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1">
        <span className="font-rajdhani text-[length:var(--fs-meta)] font-semibold uppercase tracking-[0.15em] text-text-dim">
          quant journal
          {data.schemaVersion != null && (
            <span className="ml-2 font-jetbrains-mono normal-case tracking-normal">
              schema v{data.schemaVersion}
            </span>
          )}
        </span>
        <span
          className={`font-jetbrains-mono text-[length:var(--fs-meta)] ${
            !data.online || stale ? "text-warn" : "text-text-dim"
          }`}
        >
          {data.online ? `generated ${stamp(data.generatedAt)}` : "artifact offline"}
          {data.online && stale && " · past 24h SLA"}
        </span>
      </div>

      {data.degraded && (
        <div className="cc-panel px-3.5 py-2">
          <p className="font-jetbrains-mono text-[length:var(--fs-body)] leading-[var(--lh-tight)] text-warn">
            DEGRADED READ · {data.degraded.reason}
          </p>
          <p className="mt-1 font-jetbrains-mono text-[length:var(--fs-meta)] leading-[var(--lh-tight)] text-text-dim">
            {data.degraded.detail} — the numbers below are withheld rather than estimated.
          </p>
        </div>
      )}

      <div className="grid min-h-[520px] flex-1 shrink-0 gap-3" style={GRID_STYLE}>
        <KillLog q={data} />
        <Holdout q={data} />
        <GateCoverage q={data} />
      </div>

      <QuantCharts q={data} />
    </div>
  );
}
