# DESIGN.md — Jarvis Command Center (v4)

Dark-only, single-user desk command center. Full Iron Man HUD: **navy-black
base, royal-blue atmosphere, scarce gold jewelry.** Governs all dashboard UI.
The reference screenshot (Iron Man "JARVIS Command Center") is the layout
authority for structure/density; the palette is adapted (navy+blue, not cyan)
and all data is real.

Applied everywhere: the shell (sidebar + topbar + bottom bar) and all three
tabs — COMMAND (the deck), TRADING, and OPS — share one visual language. The
v2 warm-black token set is retired except for two tokens (`--panel`,
`--gold-border`) still consumed by the pre-app boot overlay, which was out of
scope for this pass (see "Retired tokens" below).

## The two-role color law

- **Blue is the ATMOSPHERE.** Grid, panel borders + brackets, glass fills,
  status/live glyphs, gauge arcs, waveforms, most iconography.
- **Gold is scarce JEWELRY.** Exhaustive list — nothing else may be gold:
  1. the JARVIS wordmark,
  2. the active nav item (text + left accent),
  3. key numbers,
  4. the 3D graph nodes + their bloom,
  5. hover/active accents (panel border on hover, primary-action buttons,
     selected palette row).
- **Never gold and blue on the same element** for the same meaning.

## Tokens

Command-center tokens (`:root`).

| Token | Value | Role |
|---|---|---|
| `--bg-base` | `#070a14` | Navy-black body + graph canvas background |
| `--bg-panel` | `#0d1526` | Opaque faux-glass panel fill (grid can't bleed through) |
| `--glass-fill` | `rgba(30,58,102,0.5)` | Royal-blue translucent — TRUE glass (blurred chrome) only |
| `--glass-edge` | `rgba(120,160,240,0.1)` | Soft top inner highlight on panels |
| `--border-dim` | `rgba(90,130,220,0.38)` | Blue atmosphere border / bracket |
| `--ink-cc` | `#e2e8f5` | Cool near-white — body/data text (also `body`'s default color) |
| `--text-dim` | `#9fb2d4` | Cool blue-gray — small uppercase labels + meta text |
| `--blue` | `#4169e1` | Royal blue — fills/large areas only, **never text** |
| `--blue-bright` | `#6b8cff` | All blue text/glyphs/status/live/gauge arc |
| `--gold` | `#d4af37` | Gold jewelry (see law above) |
| `--gold-bright` | `#f0dc9a` | Gold hover/accent lift |
| `--ok` `--warn` `--err` | `#34d399` `#ff8c42` `#ff4757` | Semantic state |
| `--grid-line` | `rgba(90,130,220,0.05)` | Blue background grid @ 5% |
| `--fs-body` | `12px` | Panel body / mono data / list rows |
| `--fs-meta` | `11px` | Secondary/meta text + panel labels — **the hard floor** |
| `--lh-tight` | `1.35` | Tightened line-height for dense list content |

### Compact type scale (density pass)

Nothing renders below `--fs-meta` (11px) anywhere in the app — verified by
repo-wide grep. Key numbers (Stat values, the clock, gold jewelry) are exempt
and stay large; everything else in a list, row, card, or meta line uses
`--fs-body` or `--fs-meta` via `text-[length:var(--fs-body)]` /
`text-[length:var(--fs-meta)]` plus
`leading-[var(--lh-tight)]` on the containing list.

### Contrast (computed, WCAG relative luminance)

Measured against the navy base, the solid panel, and the **worst case** —
royal-blue glass @50% composited over a blue-lit grid line. Contrast is a
color-only ratio: shrinking text from 13px to 11–12px does not change these
numbers — it only changes which WCAG tier applies, and 11–12px was already
being held to the stricter "small text" 4.5:1 bar, so nothing needed
re-gating. All clear the Phase-1 gates (gold ≥7:1, text-dim ≥4.5:1,
blue-bright ≥4.5:1) at every size used in the app.

| Token | vs base | vs panel | vs glass-over-grid | Gate |
|---|---|---|---|---|
| `--gold` | 9.40 | 8.67 | 7.18 | ≥7 ✓ |
| `--ink-cc` | 16.09 | 14.83 | 12.30 | — |
| `--text-dim` | 9.22 | 8.50 | 7.04 | ≥4.5 ✓ |
| `--blue-bright` | 6.42 | 5.92 | 4.91 | ≥4.5 ✓ |
| `--ok` | 10.28 | 9.48 | 7.86 | — |
| `--warn` | 8.55 | 7.88 | 6.53 | — |
| `--err` | 5.92 | 5.46 | 4.53 | ≥4.5 ✓ |

No token needed adjustment.

## Themed scrollbars

Applied globally (`* { scrollbar-width: thin; scrollbar-color: ... }` +
`::-webkit-scrollbar*`), not per-container — every internal `overflow-y`
panel on every tab inherits it automatically. 8px thumb, transparent track,
`rgba(65,105,225,0.25)` blue-glass thumb, brightens toward `--blue-bright` on
hover. No native scrollbar chrome renders anywhere in the app.

## Glass vs faux-glass (layout-engineering law)

- **`.cc-glass` (true glass, `backdrop-filter: blur(10px)`)** — ONLY on chrome
  that never overlaps the WebGL canvas: **sidebar, topbar, bottom bar** (3
  surfaces, under the max-5 cap).
- **`.cc-panel` (faux glass)** — every grid panel, including the canvas-adjacent
  core. Opaque navy fill (`--bg-panel`) + soft top highlight + blue border, **no
  blur**. Opacity is what clips the grid behind the panel (grid bleed-through
  kills `--text-dim` readability). No `backdrop-filter` anywhere near the canvas.
- The graph canvas wrapper keeps its own stacking context (`isolate`, from the
  prior phase) so nothing composites over the WebGL coordinate space.

## Layout

- Root: `100vh`, `overflow: hidden`. Panels are flex columns; internal lists
  scroll (`overflow-y: auto`). The page body never scrolls.
- Shell: fixed 232px sidebar | main column (topbar / content / bottom bar).
- BRAIN deck grid (`command-center.tsx`), 4 cols × 3 rows, named areas:

  ```
  overview  core     core      feed
  agents    agents   timeline  commands
  monitor   memory   portfolio alerts
  ```

  Row 1 is `1.55fr` so the **core** (cols 2–3, the 3D graph + query console) is
  the dominant, tallest cell.
- TRADING and OPS keep their own internal layouts (Stat row + chart panels;
  burn-rate/checklist/roadmap/portfolio grid) — only the panel/border/text
  language changed, not their structure, per this pass's "pattern
  application, no new layout decisions" charter.
- Bottom bar: single line, `text-overflow: ellipsis`, **no marquee**.

## Panel inventory → real data

| Panel | Source | Empty/degraded state |
|---|---|---|
| AI Core Overview | graph / agents / health / alerts status rows | per-row "—" + warn dot |
| Central Core | 3D graph (`brain-3d`) + query console | graph loading label |
| Live Intelligence Feed | `/api/agents` `latest_metrics` deltas + anomalies (▲) + digest date | "— CONDUCTOR OFFLINE —" |
| Active Agents | `/api/agents` skills, one card each + freshness dot | dashed "— NO AGENT DEPLOYED —" slots |
| Mission Timeline | `/api/health` rebuild (last/next 03:00) + hermes jobs + weekly review | "awaiting health sync" |
| Quick Commands | real UI actions (ask brain, sync graph, palette, wake) | — |
| System Monitor | `/api/vitals` CPU + RAM rings (no Disk — we have none) | "—" |
| Memory Insights | graph node/cluster/link counts + mini-brain | "—" |
| Portfolio | `/api/hub` portfolio | "loading portfolio…" |
| Alerts | derived from health (`alerts-watcher`) | "all systems nominal" ok-state |
| LLM provider grid | **permanently excluded** | — |

Invented numbers are never acceptable; every figure traces to a source above.

## `/api/agents` security (audit-mandated)

- Reads exactly ONE file: `CONDUCTOR_SUMMARY_PATH` from `.env.local`
  (documented in `.env.local.example`). No client parameter influences any
  filesystem path.
- The configured path is `realpath`-canonicalized (parent-dir realpath +
  basename at module load; full-path realpath on every read). The resolved path
  must equal the configured canonical (lowercased both sides). A symlink /
  junction that resolves elsewhere is rejected.
- In-memory cache, 5s TTL — polling never hammers NTFS.
- Malformed / missing summary → `{ online: false }` (HTTP 200, honest
  "CONDUCTOR OFFLINE"), never a crash or 5xx.

## Execute routes (audit-mandated)

`POST /api/ops/hermes/start` is **the dashboard's only execute-capable
route** — every other route is read-only (vault files, `schtasks /query`,
Postgres SELECT). Any future route that runs a command, writes a file
outside the vault's own read path, or otherwise changes system state needs
the same treatment as this one, **plus explicit owner sign-off before
merging** — this is a hard rule, not a suggestion.

Why this one is safe:

- **Fixed command, zero input.** The command and task name
  (`schtasks /Run /TN "claude-hermes-daemon"`) are a hardcoded module-level
  constant. `POST()` takes no `Request` parameter at all — it is
  structurally impossible for a body, query string, or header to reach
  `execFile`, not just unvalidated-and-ignored.
- **`execFile`, never a shell.** No string concatenation, no
  `exec`/`shell: true`. Same no-shell discipline as every other process
  call in this codebase (`lib/vault.ts`'s `run()`, used by the read-only
  `schtasks /query` calls).
- **Debounced server-side.** A module-level timestamp rejects re-execution
  with 429 for 10s after a trigger — this is the actual single-execution
  guarantee; the UI's disabled-button state is just a courtesy, not a
  security boundary.
- **Truth before action.** If hermes is already running, the route returns
  `{ triggered: false, online: true }` and never calls `execFile` at all.
- **Truth after action.** The route polls the same `schtasks /query` status
  source `/api/health` already uses, up to 8s, and reports the real
  `online` state — never `{ triggered: true }` alone, which would let the
  UI claim success it hasn't observed.
- **GET → 405.** Only `POST` executes; every other verb is refused.
- **Localhost-only.** `next dev` binds `-H 127.0.0.1` (see `package.json`);
  this app is local-only and never deployed per `PRODUCT.md`. (Note: the
  `next start` production script does not pass `-H`, which would default to
  binding all interfaces — irrelevant today since `npm start` is never
  used here, but worth fixing if that ever changes.)

## Warn/error states (colorblind-safe — hard rule)

Color never carries meaning alone:
- **Warn**: `--warn` + `▲` glyph + dashed border (`.cc-panel.is-warn`).
- **Error**: `--err` + `■` glyph + solid border (`.cc-panel.is-err`).

Applied in the Alerts panel, the intelligence feed's anomaly lines, and the
mission-timeline state pills.

## The 3D core (centerpiece)

At rest it must be the brightest object on screen: bloom strength `1.8` /
radius `0.6` / threshold `0.42`, node emissive `1.0` and larger radii
(`2.6 + cbrt(deg)·2.4`), link opacity `0.4`, canvas background `#070a14` to
blend into its faux-glass panel. Node palette stays the gold ramp (`#d4af37`
`#b8963b` `#8a7326` `#e8c766`) — this is the one place gold glows.

Idle auto-rotate **~0.15 rad/s**, timed by frame delta (`performance.now()`) so
speed is framerate-independent; the delta tracker resets on `visibilitychange`
so a hidden gap doesn't snap the camera. Halts on user interaction (resumes
20s later) and on `prefers-reduced-motion`. The framebuffer draw-skip guard
(skip `composer.render` when the canvas is 0-size or off-tab, keep the rAF
loop ticking) stays.

## Chart-library color exemption

`equity-chart.tsx` (lightweight-charts, renders to `<canvas>`) and
`trading.tsx`'s Recharts config objects (`AXIS`, `GRID_STROKE`, `REF_STROKE`,
`SERIES_BLUE`, `TOOLTIP_STYLE`) hold literal hex/rgba strings, not
`var(--token)` references. This is a hard technical constraint, not drift:
lightweight-charts paints to a canvas 2D context and Recharts passes colors
as SVG presentation attributes at chart-init time — neither resolves CSS
custom properties the way DOM element styles do. The literals are kept in
sync with the token palette by value (`#0d1526` = `--bg-panel`, `#9fb2d4` =
`--text-dim`, `#6b8cff` = `--blue-bright`, `#ff4757` = `--err`) and grouped
into named constants at the top of each file specifically so a future token
change has one obvious place to update. Same exemption class as the WebGL
graph palette (`brain-3d.tsx`, `mini-brain.tsx`, `tactical-2d.tsx`).

## Effects rules (hard constraints)

1. CSS keyframes, `transform`/`opacity` only. Glow pulses ride opacity over a
   **static** box-shadow.
2. Steady-state budget ~4 simultaneously-animating DOM elements: scanline
   sweep, active-tab-equivalent accent, live status-dot pulse, one live badge.
   The **voice waveform** (5 bars) animates only while listening and counts as
   one intentional cluster. The WebGL core's internal loops are a separate
   layer, exempt from the DOM budget.
3. Gold glow lives in exactly one place: the 3D graph's bloom. All other glow
   is blue (`--blue-bright`, status dots / live badges).
4. No `backdrop-filter` overlapping the WebGL canvas (see glass law).
5. `prefers-reduced-motion: reduce` disables every loop (scanline, pulses,
   waveform, graph orbit + synaptic pulse); single-shot transitions stay.

## Typography

- **Rajdhani** (500/600/700) — wordmark, nav, panel labels, headings, card
  titles. Labels: uppercase, `0.15–0.2em`, 10–12px, `--text-dim`.
- **JetBrains Mono** (400/600) — all numbers, deltas, timestamps, clock, feed
  lines, status strings.
- Body/legacy copy stays Geist. Fallbacks: `var(--font-rajdhani), system-ui,
  sans-serif` / `var(--font-jetbrains-mono), monospace`.

## Retired tokens

TRADING and OPS (and a handful of leftover references inside already-migrated
COMMAND-tab files: `graph-modes.tsx`, `query-box.tsx`) were the last
consumers of the v2 warm-black token set. After migrating them, a repo-wide
grep for every v2 token name found exactly one remaining consumer:

- **`--panel` (`#141210`) and `--gold-border` (`#4a3f1e`)** — still used by
  `boot.tsx`, the pre-app boot overlay. Boot was explicitly out of scope for
  this pass (it isn't a tab), so it keeps rendering in the original
  warm-black palette. These two tokens stay defined for that one consumer.

Deleted (zero consumers): `--bg-deep`, `--bg`, `--gold-dim`, `--text`,
`--muted`, `--hairline`, `--warning`, `--emerald`, `--failure`, and their
`@theme` color mappings. `--ok` was aliased to `--emerald`'s value; it now
holds the same hex (`#34d399`) inlined directly. `body`'s default text color
moved from the retired `--text` to `--ink-cc`. The `.hud-panel` CSS rule
(sharp corner-bracket FUI panel, superseded by `.cc-panel`) had zero
consumers and was deleted.
