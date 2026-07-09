# DESIGN.md — Jarvis Dashboard (v2 FUI)

Dark-only, single-page command center. Rarity brand: black & gold luxury,
thin borders, generous spacing, no gradients. Emerald is NOT a brand color
here — it is reserved semantics (see below).

## Tokens

| Token | Value | Use |
|---|---|---|
| `bg` | `#0A0A0A` | Page background |
| `panel` | `#141210` | Panels, cards, chips |
| `gold` | `#D4AF37` | Brand accent: wordmark, active pills, primary values, node palette anchor |
| `gold-dim` | `#8A7326` | Secondary gold: glyphs, borders, dim graph nodes. NOT for text on panel (4.06:1 — below AA); use `gold/80` for dim gold text |
| `text` | `#E8E4D8` | Body text |
| `muted` | `#8A8578` | Secondary text, labels, timestamps |
| `hairline` | `#24211B` | Default 1px borders, dividers |
| `gold-border` | `#4A3F1E` | Emphasized 1px borders (focused input, active toggle) |
| `warning` | `#E3B341` | Amber: stale/attention states |
| `emerald` | `#34D399` | RESERVED: INTAKE "Live" status pill + healthy health-chips ONLY |

Red for failure states: use `#F87171` (chips only, no large surfaces).

## Rules

- Dark only. No light theme, no `prefers-color-scheme` branching.
- Borders are always 1px (`hairline` default, `gold-border` for emphasis).
- No gradients, no glassmorphism, no shadows heavier than a subtle black.
- Spacing: generous — panels `p-5`+, page gutter `px-6`+, sections `gap-6`+.
- Typography: Geist Sans body, Geist Mono for numbers/timestamps/log-ish
  content. Wordmark: gold, uppercase, letterspaced (`tracking-[0.3em]`).
- Status pill semantics: emerald = live/healthy, gold = active, gray
  (`muted`) = planning/idle, `warning` amber = stale/needs attention,
  red = failed.
- Numbers displayed are always rounded integers.
- Errors render as styled muted/amber text in-panel — never raw stack traces.
- Motion: subtle only — opacity/color transitions ≤200ms ease-out;
  respect `prefers-reduced-motion` (disable transitions).

## FUI layer (v2)

| Token / spec | Value |
|---|---|
| `bg-deep` | `#070604` — page background behind the HUD |
| Grid | CSS `repeating-linear-gradient` both axes, gold, opacity ≤ 0.04 |
| Scanline | one slow CSS-keyframe sweep, opacity ≤ 0.03, compositor-only (transform) |
| HUD panels | `.hud-panel`: radius 0, `panel` bg, hairline border, corner brackets 1.5px gold, 14px arms |
| Data readouts | Geist Mono for ALL numbers, labels, statuses, ticker, gauges |
| Gauges | 5px SVG arc, gold on `#24211B` track, CSS transition on stroke-dashoffset |
| Brain emissive | gold family only: `#D4AF37` `#B8963B` `#8A7326` `#E8C766`, rotated by community |
| Sound | WebAudio synth only, gain ≤ 0.15 (≈ −18dBFS), every sound ≤ 150ms except boot sweep |

Rules:
- CSS keyframes for ambient effects (scanline, ticker, glows) — compositor
  thread, zero contention with WebGL. framer-motion ONLY for the boot overlay.
- Effects support information, never obscure it. Reduced-motion = static and
  fully usable, no audio.
- ALERT panel exists only when something is wrong. Silence is a feature.
- Emerald unchanged: healthy/Live only.

## Graph palette

Node colors by community: gold-scale ramp from `gold-dim` → `gold` →
lightened gold (`#E8CB6A`, `#F0DC9A`), cycled. Node size by degree.
Background matches `bg` so the canvas blends into its panel.
