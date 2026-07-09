// Synthesized WebAudio sounds — no files. Context is created and resumed
// only from the boot INITIATE click (the user gesture). Gain cap 0.15
// (≈ −18dBFS); every sound ≤150ms except the boot sweep.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Call from a user gesture. Returns the context state for verification. */
export function initAudio(): string {
  if (reducedMotion()) return "disabled(reduced-motion)";
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.15;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx.state;
}

export function audioState(): string {
  return ctx?.state ?? "uninitialized";
}

export function setAudioMuted(m: boolean) {
  muted = m;
}

function tone(
  freq: number,
  durMs: number,
  peak: number,
  type: OscillatorType = "sine",
  startDelayMs = 0,
  freqEnd?: number
) {
  if (!ctx || !master || muted || reducedMotion() || ctx.state !== "running")
    return;
  const t0 = ctx.currentTime + startDelayMs / 1000;
  const dur = durMs / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, dur / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  /** boot sweep, ~1.2s — the one sound allowed past 150ms */
  boot() {
    tone(70, 1200, 0.08, "sine", 0, 480);
    tone(210, 900, 0.04, "triangle", 250, 720);
  },
  /** soft UI tick — hover/select */
  tick() {
    tone(1750, 30, 0.03, "sine");
  },
  querySent() {
    tone(440, 60, 0.08, "sine");
    tone(660, 70, 0.08, "sine", 70);
  },
  answerDone() {
    tone(660, 120, 0.09, "sine");
    tone(990, 140, 0.06, "sine", 40);
  },
  alert() {
    tone(230, 120, 0.1, "square");
  },
};
