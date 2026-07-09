# PRODUCT.md — Jarvis Dashboard

Local-only (127.0.0.1, never deployed) command center for Ivan's Rarity
company brain. Single user: Ivan, at a desk, dark room, dark-only UI.

**Register:** product — design serves the data. Sci-fi HUD aesthetic
(Rarity black/gold FUI), but functional-first: every effect supports
information, never obscures it.

**Surfaces (v3):**
- BRAIN tab — 3D knowledge-graph centerpiece with query console (v2).
- TRADING tab — read-only observability for the Polymarket paper-trading
  bot: P&L, win rate, Brier + sample size, equity curve, calibration,
  ROI by category, open positions. Never any trading controls.
- OPS tab — burn rate (fixed + variable costs), weekly checklist,
  roadmap lanes, portfolio, alert history.
- Global: left-rail vitals + mini-brain, ALERT panel (only when something
  is wrong), bottom ticker, Ctrl+K palette, voice in/out, synth sounds.

**Data sources:** Obsidian vault (read-only), local system metrics,
Supabase Postgres (read-only role) for trading.

Design source of truth: DESIGN.md (Rarity black/gold tokens).
