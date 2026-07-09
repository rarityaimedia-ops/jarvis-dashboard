# Jarvis Dashboard

Local-only command center for the Claude Brain vault. Reads the vault, never
writes it. Binds to 127.0.0.1 — never deploy.

## Start

```
npm install
npm run dev
```

Open http://127.0.0.1:3000. The dev script pins the host to 127.0.0.1.

## Setup

`.env.local`:

```
VAULT_PATH=C:\Users\kranj\jarvis\brain
```

The query box shells out to `graphify` and `claude` (both must be on PATH);
spawned without a shell, cwd = vault. The health strip reads Windows
scheduled tasks `claude-brain-nightly-graph-rebuild` and
`claude-hermes-daemon` via `schtasks`.

## Panel → vault file mapping

| Panel | Source |
|---|---|
| Health: rebuild chip | `00_System/logs/graph-rebuild.log` (+ schtasks next-run) |
| Health: hermes chip | `00_System/logs/hermes-daemon.log` (UTF-16) + schtasks state |
| Health: git chip | `git -C <vault> status --porcelain` |
| Metric: nodes/communities | `graphify-out/graph.json` |
| Metric: projects | `00_System/rarity-hub.md` portfolio table |
| Metric: next scheduled job | schtasks `claude-brain-nightly-graph-rebuild` |
| Portfolio + weekly review | `00_System/rarity-hub.md` |
| Knowledge graph (Custom) | `graphify-out/graph.json` |
| Knowledge graph (graphify) | `graphify-out/graph.html` (iframe) |
| Roadmap lanes | `00_System/ROADMAP.md` |
| Query box | spawns `graphify query <q>` or `claude -p <q>` in the vault |

Node click opens `obsidian://open?vault=brain&file=<path>`; if the
protocol isn't registered the path is copied to the clipboard with a toast.

All vault reads go through a resolve-prefix guard (no path can escape
`VAULT_PATH`) and keep an in-memory last-good cache — if Obsidian holds a
lock mid-save, routes serve the cached copy flagged `cached: true`.

Health/hub/roadmap poll every 5s (SWR); the graph loads once with a manual
refresh button. Design tokens live in `DESIGN.md`.

## v2 — sci-fi HUD

First visit per session shows a boot screen; the INITIATE click doubles as
the browser gesture that unlocks WebAudio. The typed status lines use real
API values. Any key or click skips; `prefers-reduced-motion` skips boot,
audio, and all ambient animation entirely.

**Features**

- **3D brain** (default graph mode): force graph with bloom, fog, gold
  emissive nodes sized by degree, link particles, idle camera orbit
  (pauses on interaction, resumes after 20s). Random synaptic pulses every
  4–7s. Click a node → camera fly-to + neighborhood highlight + info card
  with "Open in Obsidian". Click empty space → restore.
- **Thinking mode**: while a query answer streams, nodes whose labels
  appear in the text pulse in arrival order.
- **System vitals**: `/api/vitals` — CPU % (two-sample `os.cpus()` delta),
  RAM, OS + process uptime — rendered as radial gauges in the left rail.
- **Alert panel** (right rail): renders only when something needs
  attention (stale rebuild >26h, failed job, uncommitted git, hermes
  down). Healthy = no panel.
- **Ticker**: merged recent events, slow marquee, pauses on hover.
- **Voice**: mic button or palette — Web Speech recognition (sl-SI/en-US,
  persisted; uses the browser's cloud service, online required).
  "Speak answers" reads answers via speechSynthesis; falls back to an
  English voice with a hint if no Slovenian voice is installed.
- **Sound**: synthesized WebAudio (boot sweep, tick, query pulse, answer
  chime, alert blip). No audio files. Master mute persisted.
- **Archive drawer** (bottom toggle): full v1 roadmap lanes + portfolio.

**Toggles** (Ctrl+K palette → TOGGLES): sound mute, speak answers, voice
language sl-SI/en-US. Graph mode 3D/2D/graphify and query engine
Graphify/Claude switch in the palette or in the panel headers.

**Keyboard**

| Key | Action |
|---|---|
| `Ctrl+K` | Command palette (tabs, query, graph mode, focus node fly-to, toggles, copy vault paths, refresh graph) |
| `1` / `2` / `3` | Switch tab: BRAIN / TRADING / OPS |
| `Enter` | Ask (query box focused) |
| any key / click | Skip boot sequence |
| `Esc` | Close palette |

## v3 — trading + ops

Three tabs in the header: **BRAIN** (the v2 experience, unchanged),
**TRADING**, **OPS**. The 3D scene stays mounted across tabs but fully
pauses its render loop when BRAIN is inactive (`[brain] render loop
paused` in the console). A cheap 2D mini-brain stays pinned in the left
rail on every tab — click it to jump back.

**TRADING** (`/api/trading?strategy=polymarket`): read-only observability
for the paper-trading bot — net P&L, win rate, Brier (always shown with
its sample size), AI cost, equity curve (lightweight-charts), calibration
scatter vs the perfect diagonal (recharts), ROI by category, open
positions. Strategy adapters live in `src/lib/strategy-adapters.ts`: a
per-strategy config maps the bot's real columns onto a generic shape, so
a future strategy is a new adapter entry with zero UI changes. P&L uses
the bot's own paper-trading formula (yes → size·(outcome − p), no →
size·(p − outcome)). Thin-data discipline: with few resolved predictions
the panels say so and render only what exists — nothing is extrapolated.

**OPS**: burn rate — fixed monthly costs from vault `00_System/costs.json`
(EUR) beside variable model spend from the bot's `api_costs` table (USD;
no FX conversion is invented), cost per resolved prediction, weekly
checklist, roadmap lanes, full portfolio, session alert history.

### Voice flow (local Whisper)

Hold **Ctrl+Space**, speak, release — Whisper transcribes **on this
machine** (WebGPU, WASM fallback; model downloads once from the HF hub
into browser cache, then works offline). If a text field is focused your
words are typed into it; otherwise they run a command: tab names, graph
modes, `focus ⟨node⟩`, `ask ⟨question⟩`, mute/unmute, refresh — English
and Slovenian. Unmatched speech lands in the query box, ready to send.

**Wake word (hands-free):** toggle "Wake word" in the palette or say
"wake mode on" via push-to-talk. A local Silero VAD then listens
continuously (gold ◉ badge shows while armed) and every utterance is
transcribed locally — only ones starting with "jarvis" act: say
*"jarvis, open trading"* in one breath, or *"jarvis"* alone and follow
with the command within ~12s. "jarvis sleep" turns it off. Mic stays hot
only while wake mode is on; nothing is ever sent anywhere.

The un-bundled runtime (`public/flow/transformers.min.js`, `public/ort/`,
`public/vad/`) is copied from node_modules by `scripts/copy-flow-assets.mjs`
(runs automatically via `predev`) — transformers.js stalls if Turbopack
bundles it into a worker, so the worker at `public/flow/whisper-worker.js`
stays outside the bundler on purpose. Model choice is a constant in that
file (`whisper-base`; bump to `whisper-small` for better Slovenian).

Requires `TRADING_DB_URL` in `.env.local` (read-only Postgres role,
SELECT only — the dashboard has no trading controls by design). Both
routes cache in-memory for 60s: the UI polls every 15s but the DB sees
at most one query burst per minute (`db refresh` on stderr). On DB
failure the last-good payload is served with `stale: true` and the
TRADING tab shows a STALE chip; with no cache yet, a clean error panel
renders instead.
